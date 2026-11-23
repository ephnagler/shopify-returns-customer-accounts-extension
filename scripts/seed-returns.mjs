#!/usr/bin/env node
/**
 * Seeds a development store with one order per return scenario, all owned by the
 * customer you log in to customer accounts with.
 *
 *   shopify store auth -s <store>.myshopify.com --scopes <SCOPES below>
 *   node scripts/seed-returns.mjs --store <store>.myshopify.com --email you@example.com --dry-run
 *   node scripts/seed-returns.mjs --store <store>.myshopify.com --email you@example.com
 *   node scripts/seed-returns.mjs --store <store>.myshopify.com --email you@example.com --only A,L
 *   node scripts/seed-returns.mjs --store <store>.myshopify.com --email you@example.com --only N,O,P,Q --batch 2   # a fresh test set
 *
 * Every Admin API call goes through `shopify store execute`, which uses the
 * per-store online token from `shopify store auth`. The script holds no token.
 *
 * Why draft orders: `orderCreate` only accepts offline tokens, and
 * `store auth` issues an online one. A completed draft order is a normal paid
 * order, which is all the return flow needs. Order dates can't be backdated
 * this way; delivery dates can (fulfillmentEventCreate.happenedAt), and the
 * 30-day window counts from delivery.
 *
 * Re-runs are safe: each order is tagged `returns-seed-<key>` and skipped if it
 * already exists. To redo a scenario, delete its order in admin and re-run.
 *
 * Do this in admin BEFORE seeding, or the rule-based scenarios won't behave:
 * return rules (30 days from delivery, $10 return shipping fee, final sale
 * = the sale collection), and the order metafield definitions
 * custom.exchange_order and custom.no_returns.
 */

import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run = promisify(execFile);

export const SCOPES = [
  'write_products',
  'read_customers',
  'write_draft_orders',
  'write_orders',
  'write_merchant_managed_fulfillment_orders',
  'write_fulfillments',
].join(',');

const API_VERSION = '2026-10';
const SEED_TAG = 'returns-seed';

// ---- Catalog: three example products ----
// Long titles, so the return page shows how long names wrap. Each has a Shopify taxonomy
// category: suggested return reasons follow it, so the boot and the jacket get different
// reasons. Sizes are variants; scenarios name a variant.

const PRODUCTS = {
  boot: {
    handle: 'returns-seed-leather-boot',
    title: 'Example Leather Work Boot - Brown Waxed Leather with Commando Sole',
    vendor: 'Example Boot Co.',
    productType: 'Boots',
    category: 'gid://shopify/TaxonomyCategory/aa-8-3', // Shoes > Boots
    price: '200.00',
    variants: {
      boot9: {size: '9', sku: 'EX-BOOT-9'},
      boot10: {size: '10', sku: 'EX-BOOT-10'},
      // Final Sale by SKU (the app's rule, not Shopify's).
      boot11: {size: '11', sku: 'EX-BOOT-11-Final Sale'},
    },
  },
  jacket: {
    handle: 'returns-seed-varsity-jacket',
    title: 'Example Varsity Jacket - Brown Plaid Wool Flannel with Leather Sleeves',
    vendor: 'Example Outerwear',
    productType: 'Outerwear',
    category: 'gid://shopify/TaxonomyCategory/aa-1-10-2-15', // Outerwear > Coats & Jackets > Varsity Jackets
    price: '250.00',
    variants: {
      jacket40: {size: '40', sku: 'EX-JACKET-40'},
      jacket42: {size: '42', sku: 'EX-JACKET-42'},
    },
  },
  // On sale (compare-at price set): the return rules' sale collection makes it final sale.
  socks: {
    handle: 'returns-seed-crew-socks',
    title: 'Example Organic Cotton Crew Socks - Wheat',
    vendor: 'Example Socks',
    productType: 'Socks',
    category: 'gid://shopify/TaxonomyCategory/aa-1-18-3', // Socks > Crew Socks
    price: '20.00',
    compareAtPrice: '30.00',
    variants: {socks: {size: 'One Size', sku: 'EX-SOCKS-CREW'}},
  },
};

/** variant key -> its product spec and variant spec. */
const VARIANTS = Object.fromEntries(
  Object.values(PRODUCTS).flatMap((product) =>
    Object.entries(product.variants).map(([key, variant]) => [key, {product, ...variant}]),
  ),
);

// ---- Scenarios. Items are variant keys. `delivered` = days ago per shipment; null = shipped, not delivered. ----
// Expected results assume the default Policy rules. Settings-dependent cases are noted.

const SCENARIOS = [
  // Eligibility
  {key: 'A', items: ['boot9'], shipments: [{items: 'all', delivered: 3}], expect: 'Button shows'},
  {key: 'B', items: ['boot9'], shipments: [{items: 'all', delivered: 29}], expect: 'Button shows (day 29 of 30)'},
  {key: 'C', items: ['boot9'], shipments: [{items: 'all', delivered: 31}], expect: 'Button hidden (window closed)'},
  {key: 'D', items: ['boot9'], shipments: [{items: 'all', delivered: null}], expect: 'Button hidden (not delivered)'},
  {key: 'G', items: ['boot11', 'socks'], shipments: [{items: 'all', delivered: 3}], expect: 'Button hidden (boot Final Sale SKU, socks on sale)'},
  {key: 'H', items: ['boot11', 'jacket40'], shipments: [{items: 'all', delivered: 3}], expect: 'Button shows; boot locked (Final Sale SKU)'},
  {key: 'I', items: ['socks', 'jacket40'], shipments: [{items: 'all', delivered: 3}], expect: 'Button shows; socks locked by return rules (on sale)'},
  {key: 'K', items: ['boot9'], metafields: {no_returns: true}, shipments: [{items: 'all', delivered: 3}], expect: 'Button hidden (no_returns)'},
  {key: 'L', items: ['boot9', 'jacket40'], shipments: [{items: ['boot9'], delivered: 40}, {items: ['jacket40'], delivered: 2}], expect: 'Button shows; boot locked (its window closed)'},
  {key: 'M', items: ['boot9'], shipments: [], expect: 'Button hidden (unfulfilled)'},
  // Walk the flow end to end.
  {key: 'N', items: ['boot9'], shipments: [{items: 'all', delivered: 2}], expect: 'Return path ($200 - $10); boot return reasons'},
  {key: 'O', items: ['jacket40'], shipments: [{items: 'all', delivered: 2}], expect: 'Exchange path; jacket return reasons'},
  {key: 'P', items: ['boot9', 'jacket40'], shipments: [{items: 'all', delivered: 1}], expect: 'Boot + jacket: different reasons per item, long names'},
  {key: 'Q', items: ['boot9'], quantities: {boot9: 2}, shipments: [{items: 'all', delivered: 1}], expect: 'Quantity picker (2 of one size)'},
  // Remote states (Policy rules, default AK and HI)
  {key: 'R', items: ['boot9'], address: 'AK', shipments: [{items: 'all', delivered: 2}], expect: 'AK: $20 on refund and credit; exchange only if "Offer exchanges to these states" is on'},
  {key: 'Y', items: ['jacket40'], address: 'HI', shipments: [{items: 'all', delivered: 2}], expect: 'HI: $20 on refund and credit, no exchange'},
  // Tax lines (needs NY tax collection on).
  {key: 'S', items: ['boot9'], address: 'NY', shipping: '15.00', shipments: [{items: 'all', delivered: 2}], expect: 'NY tax on a return, refund and store credit'},
  {key: 'T', items: ['boot9', 'jacket40'], address: 'NY', shipping: '15.00', shipments: [{items: 'all', delivered: 2}], expect: 'NY tax, two items'},
  // Exchange order: the second-return case.
  {key: 'AA', items: ['jacket42'], metafields: {exchange_order: true}, shipments: [{items: 'all', delivered: 2}], expect: 'Exchange order: no exchange; store credit pays the fee'},
  // Outside the US
  {key: 'U', items: ['boot9'], address: 'ON', shipping: '45.00', shipments: [{items: 'all', delivered: 2}], expect: 'Canada (Ontario): self-ship steps, no exchange; credit pays the market fee only if that switch is on'},
  {key: 'V', items: ['boot9', 'jacket40'], address: 'BC', shipping: '45.00', shipments: [{items: 'all', delivered: 2}], expect: 'Canada (BC), two items'},
];

// ---- CLI plumbing ----

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'dry-run') args.dryRun = true;
    else args[key] = argv[++i];
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

/** One Admin API call via `shopify store execute`. Throws on errors and userErrors. */
async function gql(ctx, query, variables = {}, {mutation = false} = {}) {
  const argv = ['store', 'execute', '-s', ctx.store, '--version', API_VERSION, '--json', '--no-color',
    '--query', query, '--variables', JSON.stringify(variables)];
  if (mutation) argv.push('--allow-mutations');

  for (let attempt = 1; ; attempt++) {
    let stdout;
    try {
      ({stdout} = await run('shopify', argv, {maxBuffer: 16 * 1024 * 1024}));
    } catch (error) {
      stdout = error.stdout || '';
      if (!stdout) throw new Error(`shopify store execute failed: ${error.stderr || error.message}`);
    }
    const out = JSON.parse(stdout);
    if (out.error) throw new Error(out.error.message || JSON.stringify(out.error));

    const errors = out.errors ?? [];
    if (errors.some((e) => /throttl/i.test(e.message ?? '')) && attempt < 6) {
      await sleep(2000 * attempt);
      continue;
    }
    if (errors.length) throw new Error(errors.map((e) => e.message).join('; '));

    const data = out.data ?? out;
    for (const payload of Object.values(data)) {
      const userErrors = payload?.userErrors ?? [];
      if (userErrors.length) throw new Error(userErrors.map((e) => `${(e.field ?? []).join('.')}: ${e.message}`).join('; '));
    }
    return data;
  }
}

// ---- Setup steps (each idempotent) ----

async function findCustomer(ctx, email) {
  const data = await gql(ctx, `query SeedCustomer($q: String!) {
    customers(first: 1, query: $q) { nodes { id defaultEmailAddress { emailAddress } } }
  }`, {q: `email:${email}`});
  const customer = data.customers.nodes[0];
  if (!customer) {
    throw new Error(`No customer with email ${email}. Create it in admin (Customers > Add customer), then re-run.`);
  }
  return {id: customer.id, email: customer.defaultEmailAddress?.emailAddress ?? email};
}

/** Creates or updates one product with its sizes and category. Returns variant key -> IDs. */
async function ensureProduct(ctx, spec) {
  const sizes = Object.values(spec.variants).map((variant) => variant.size);

  const data = await gql(ctx, `mutation SeedProduct($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
    productSet(synchronous: true, identifier: $identifier, input: $input) {
      product { id variants(first: 20) { nodes { id sku } } }
      userErrors { field message }
    }
  }`, {
    identifier: {handle: spec.handle},
    input: {
      handle: spec.handle,
      title: spec.title,
      vendor: spec.vendor,
      productType: spec.productType,
      category: spec.category,
      status: 'ACTIVE',
      tags: [SEED_TAG],
      productOptions: [{name: 'Size', values: sizes.map((name) => ({name}))}],
      variants: Object.values(spec.variants).map((variant) => ({
        optionValues: [{optionName: 'Size', name: variant.size}],
        sku: variant.sku,
        price: spec.price,
        inventoryItem: {tracked: false},
        ...(spec.compareAtPrice ? {compareAtPrice: spec.compareAtPrice} : {}),
      })),
    },
  }, {mutation: true});
  const product = data.productSet.product;
  const idBySku = new Map(product.variants.nodes.map((node) => [node.sku, node.id]));
  return Object.fromEntries(
    Object.entries(spec.variants).map(([key, variant]) => [key, {productId: product.id, variantId: idBySku.get(variant.sku)}]),
  );
}

async function existingScenarioKeys(ctx) {
  const data = await gql(ctx, `query SeedOrders($q: String!) {
    orders(first: 100, query: $q) { nodes { id name tags fulfillments(first: 10) { id } } }
  }`, {q: `tag:${SEED_TAG}`});
  const keys = new Map();
  for (const order of data.orders.nodes) {
    const tag = order.tags.find((t) => t.startsWith(`${SEED_TAG}-`));
    if (tag) keys.set(tag.slice(SEED_TAG.length + 1), {id: order.id, name: order.name, shipped: order.fulfillments.length});
  }
  return keys;
}

// ---- One scenario ----

/** A draft left open by an earlier failed run, so a re-run doesn't make a second one. */
async function openDraftFor(ctx, scenario) {
  const data = await gql(ctx, `query SeedOpenDraft($q: String!) {
    draftOrders(first: 1, query: $q) { nodes { id } }
  }`, {q: `tag:${SEED_TAG}-${scenario.key} AND status:open`});
  return data.draftOrders.nodes[0]?.id ?? null;
}

/** Drafts calculate in the background; wait until Shopify says ready. */
async function waitUntilReady(ctx, draftId) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const data = await gql(ctx, `query SeedDraftReady($id: ID!) {
      draftOrder(id: $id) { ready }
    }`, {id: draftId});
    if (data.draftOrder?.ready) return;
    await sleep(1000 * attempt);
  }
  throw new Error(`Draft ${draftId} never finished calculating. Re-run to try again.`);
}

async function createOrder(ctx, scenario) {
  const draftId = (await openDraftFor(ctx, scenario)) ?? (await createDraft(ctx, scenario));
  await waitUntilReady(ctx, draftId);

  const completed = await gql(ctx, `mutation SeedComplete($id: ID!) {
    draftOrderComplete(id: $id) {
      draftOrder { order { id name } }
      userErrors { field message }
    }
  }`, {id: draftId}, {mutation: true});
  return completed.draftOrderComplete.draftOrder.order;
}

const ADDRESSES = {
  OR: {city: 'Portland', provinceCode: 'OR', countryCode: 'US', zip: '97209'},
  AK: {city: 'Anchorage', provinceCode: 'AK', countryCode: 'US', zip: '99501'},
  HI: {city: 'Honolulu', provinceCode: 'HI', countryCode: 'US', zip: '96813'},
  NY: {city: 'New York', provinceCode: 'NY', countryCode: 'US', zip: '10001'},
  ON: {city: 'Toronto', provinceCode: 'ON', countryCode: 'CA', zip: 'M5V 2T6'},
  BC: {city: 'Vancouver', provinceCode: 'BC', countryCode: 'CA', zip: 'V6B 1A1'},
};

async function createDraft(ctx, scenario) {
  const draft = await gql(ctx, `mutation SeedDraft($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id }
      userErrors { field message }
    }
  }`, {
    input: {
      customerId: ctx.customer.id,
      email: ctx.customer.email,
      lineItems: scenario.items.map((item) => ({
        variantId: ctx.variants[item].variantId,
        quantity: scenario.quantities?.[item] ?? 1,
      })),
      shippingAddress: {
        firstName: 'Seed', lastName: `Scenario ${scenario.key}`, address1: '123 Test Street',
        ...ADDRESSES[scenario.address ?? 'OR'],
      },
      ...(scenario.shipping
        ? {shippingLine: {title: 'UPS Ground', priceWithCurrency: {amount: scenario.shipping, currencyCode: 'USD'}}}
        : {}),
      tags: [SEED_TAG, `${SEED_TAG}-${scenario.key}`],
      note: `Seed scenario ${scenario.key}: ${scenario.expect}`,
      // Keep the store's own automatic discounts off the test orders.
      acceptAutomaticDiscounts: false,
    },
  }, {mutation: true});
  return draft.draftOrderCreate.draftOrder.id;
}

async function setMetafields(ctx, orderId, metafields) {
  await gql(ctx, `mutation SeedMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key value }
      userErrors { field message }
    }
  }`, {
    metafields: Object.entries(metafields).map(([key, value]) => ({
      ownerId: orderId, namespace: 'custom', key, type: 'boolean', value: String(value),
    })),
  }, {mutation: true});
}

/** Fulfillment orders appear shortly after completion; poll briefly. */
async function fulfillmentOrders(ctx, orderId) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const data = await gql(ctx, `query SeedFOs($id: ID!) {
      order(id: $id) {
        fulfillmentOrders(first: 10) {
          nodes { id status lineItems(first: 20) { nodes { id remainingQuantity sku } } }
        }
      }
    }`, {id: orderId});
    // A partly shipped fulfillment order is IN_PROGRESS, not OPEN.
    const open = data.order.fulfillmentOrders.nodes.filter((fo) => ['OPEN', 'IN_PROGRESS'].includes(fo.status));
    if (open.length) return open;
    await sleep(1500 * attempt);
  }
  throw new Error(`No open fulfillment orders on ${orderId}`);
}

async function ship(ctx, orderId, shipment, scenarioKey, index) {
  const wanted = shipment.items === 'all' ? null : new Set(shipment.items.map((item) => VARIANTS[item].sku));
  const fos = await fulfillmentOrders(ctx, orderId);
  const lineItemsByFulfillmentOrder = fos
    .map((fo) => ({
      fulfillmentOrderId: fo.id,
      fulfillmentOrderLineItems: fo.lineItems.nodes
        .filter((li) => li.remainingQuantity > 0 && (!wanted || wanted.has(li.sku)))
        .map((li) => ({id: li.id, quantity: li.remainingQuantity})),
    }))
    .filter((group) => group.fulfillmentOrderLineItems.length);

  const created = await gql(ctx, `mutation SeedFulfill($fulfillment: FulfillmentInput!) {
    fulfillmentCreate(fulfillment: $fulfillment) {
      fulfillment { id }
      userErrors { field message }
    }
  }`, {
    fulfillment: {
      lineItemsByFulfillmentOrder,
      notifyCustomer: false,
      trackingInfo: {company: 'UPS', number: `1ZSEED${scenarioKey}${index}`},
    },
  }, {mutation: true});
  const fulfillmentId = created.fulfillmentCreate.fulfillment.id;

  if (shipment.delivered != null) {
    await gql(ctx, `mutation SeedDelivered($event: FulfillmentEventInput!) {
      fulfillmentEventCreate(fulfillmentEvent: $event) {
        fulfillmentEvent { id status happenedAt }
        userErrors { field message }
      }
    }`, {event: {fulfillmentId, status: 'DELIVERED', happenedAt: daysAgo(shipment.delivered)}}, {mutation: true});
  }
}

// ---- Main ----

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.store) throw new Error('Pass --store <store>.myshopify.com (a development store).');
  if (!args.email) throw new Error('Pass --email <customer email you log in with>.');
  const only = args.only ? new Set(args.only.split(',').map((k) => k.trim().toUpperCase())) : null;
  // --batch 2 makes a new set (tags returns-seed-N-2, ...) instead of skipping the ones that exist.
  const batch = args.batch ? `-${String(args.batch).trim()}` : '';
  const scenarios = SCENARIOS.filter((s) => !only || only.has(s.key)).map((s) => ({...s, key: `${s.key}${batch}`}));

  console.log(`Store: ${args.store}\nScopes for store auth: ${SCOPES}\n`);
  for (const s of scenarios) console.log(`  ${s.key.padEnd(5)} ${s.items.join(' + ').padEnd(26)} ${s.expect}`);
  if (args.dryRun) return;

  const ctx = {store: args.store};
  ctx.customer = await findCustomer(ctx, args.email);
  console.log(`\nCustomer: ${ctx.customer.email}`);

  ctx.variants = {};
  for (const spec of Object.values(PRODUCTS)) {
    Object.assign(ctx.variants, await ensureProduct(ctx, spec));
  }
  console.log(`Products: ${Object.keys(PRODUCTS).length} ready (${Object.keys(ctx.variants).length} sizes)`);

  const existing = await existingScenarioKeys(ctx);
  for (const scenario of scenarios) {
    const found = existing.get(scenario.key);
    if (found) {
      // Finish shipments a failed run left undone; otherwise skip.
      const remaining = scenario.shipments.slice(found.shipped);
      for (const [offset, shipment] of remaining.entries()) {
        await ship(ctx, found.id, shipment, scenario.key, found.shipped + offset);
      }
      console.log(`  ${scenario.key}  ${remaining.length ? 'finished' : 'skip'} (${found.name})`);
      continue;
    }
    const order = await createOrder(ctx, scenario);
    if (scenario.metafields) await setMetafields(ctx, order.id, scenario.metafields);
    for (const [index, shipment] of scenario.shipments.entries()) {
      await ship(ctx, order.id, shipment, scenario.key, index);
    }
    console.log(`  ${scenario.key.padEnd(5)} ${order.name}  ${scenario.expect}`);
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
