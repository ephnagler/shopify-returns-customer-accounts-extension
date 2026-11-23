// Staff-facing docs for the app's admin page. Instructions use short,
// active sentences. Add a new setting or doc step by adding an entry here.

import type {ReturnPolicy} from '../../../shared/returns/policy.ts';

export interface DocLink {
  label: string;
  /** shopify:admin/... deep link, or an https URL. */
  href: string;
}

export interface DocBlock {
  heading: string;
  /** Why this matters, one or two sentences. */
  intro?: string;
  steps?: string[];
  links?: DocLink[];
  /** Text to copy exactly, such as a query. Shown in a grey box under the steps. */
  code?: string[];
  /** Optional callout under the steps. */
  note?: string;
  tone?: 'info' | 'warning';
}

// ---- Settings > Shopify settings ----

export const SHOPIFY_SETTINGS: DocBlock[] = [
  {
    heading: 'Return rules',
    intro: 'The return rules set the return window, the return fee, and the final sale items. The app uses them to calculate the refund. AI shopping agents also read the return window from them.',
    steps: [
      'Turn on return rules.',
      'Set the return window to 30 days. Count it from the delivery date. Use the same number as Days after delivery in Policy rules.',
      'Holiday window: on the first holiday day, set the return window to Custom, long enough to reach the return date. After the last holiday day, set it back to 30 days. Policy rules, Return window shows the days for your dates.',
      'Set the return shipping fee to the fee in your return policy.',
      'Add the sale collection as final sale.',
      'For each market outside the US, add a return policy with no return shipping fee. Those customers send the return themselves. Add any restocking fee there too.',
    ],
    links: [{label: 'Open return rules', href: 'shopify:admin/settings/legal'}],
    note: 'Return rules apply only to orders placed after you turn them on or change them. Each order keeps the window it was bought with.',
  },
  {
    heading: 'Self-serve returns',
    intro: 'Shopify has its own return button. Turn it off, so customers see only the Start return button from this app.',
    steps: ['Select Customize.', 'Open Settings in the editor sidebar.', 'Turn off Self-serve returns.', 'Select Save.'],
    links: [{label: 'Open checkout settings', href: 'shopify:admin/settings/checkout'}],
    note: 'Same editor as Return page: Self-serve returns off, Return page on.',
  },
  {
    heading: 'Return page in the checkout and accounts editor',
    intro: 'The return page shows only after you add it in the editor. The Start return button does not work without it.',
    steps: [
      'Select Customize.',
      'Go to a customer accounts page, for example an order.',
      'Open Apps in the sidebar. Add Return page from this app.',
      'Select Save.',
    ],
    links: [{label: 'Open checkout settings', href: 'shopify:admin/settings/checkout'}],
  },
  {
    heading: 'Order metafields',
    intro: 'The app uses four order metafields. Make each one as True or false, with the name and key below. Staff see them on the order, under Metafields.',
    steps: [
      'Exchange Order (custom.exchange_order): a Flow workflow turns it on for the new order that a customer places as an exchange. Customer Account API access: Read. Turn on Filter in admin.',
      'No Returns (custom.no_returns): turn on to block returns on one order. Customer Account API access: Read.',
      'Exchange Requested (custom.exchange_requested): a Flow workflow turns it on when a customer starts an exchange. Customer Account API access: Read. Turn on Filter in admin.',
      'Store Credit Requested (custom.store_credit_requested): a Flow workflow turns it on when a customer asks for store credit. The return emails read it. Customer Account API access: Read.',
    ],
    links: [{label: 'Open order metafields', href: 'shopify:admin/settings/custom_data/order/metafields'}],
  },
  {
    heading: 'Flow workflows',
    intro: 'Shopify Flow workflows mark exchange requests, exchange orders, store credit requests, and orders paid with store credit. The app cannot set these order metafields itself. Go to Docs, then Flow workflows, for each step.',
    steps: [
      'Build Mark exchange requests.',
      'Build Mark exchange orders.',
      'Build Mark store credit requests.',
      'Build Mark store credit orders.',
      'Turn on the workflows.',
    ],
    links: [
      {label: 'Open Flow', href: 'shopify:admin/apps/flow'},
      {label: 'Read the steps', href: '/?tab=flows'},
    ],
  },
  {
    heading: 'Sale collection',
    intro: 'An item is on sale when it has a compare-at price. Items on sale are final sale. A smart collection holds them, and the return rules use it.',
    steps: [
      'Make an automated collection named Final Sale.',
      'Set the condition to Compare-at price is not empty.',
      'Add this collection as final sale in the return rules.',
    ],
    links: [{label: 'Open collections', href: 'shopify:admin/collections'}],
    note: 'The collection holds whole products, not sizes. If one size of a product has a compare-at price, all sizes of that product are final sale, also the sizes at full price. To put only some sizes on sale, make them a separate product, or use a Final Sale SKU instead.',
    tone: 'warning',
  },
  {
    heading: 'Final Sale SKUs',
    intro: 'Some items are final sale at full price. Put "Final Sale" in the SKU of these variants. The app does not let customers return them.',
    links: [{label: 'Open products', href: 'shopify:admin/products'}],
  },
  {
    heading: 'Return address',
    intro: 'Customers outside the US send the return to your address. The default text has the placeholder [Your return address].',
    steps: ['In Settings, UI copy, find How returns work, outside the US.', 'Replace [Your return address] with your address. Select Save.'],
    links: [{label: 'Open Settings', href: '/settings'}],
  },
  {
    heading: 'Notifications',
    intro: 'Edit the Return request approved email so it sends the right text for an exchange, a store credit return, and an order outside the US. Orders outside the US get send-it-yourself steps instead of a label. The email does not write a fee. It shows the fee you set on the return, in the summary. Set the fee before you approve.',
    steps: [
      'Open Return request approved and Return label created in Customer notifications.',
      'Make the edits in notifications/README.md in the app code. Ask your developer if you need help.',
    ],
    links: [{label: 'Open customer notifications', href: 'shopify:admin/settings/notifications/customer'}],
  },
  {
    heading: 'Customer metafield',
    intro: 'Block all returns for one customer. The customer does not see the Start return button on any order. You can still make a return for them in admin.',
    steps: [
      'Make the customer metafield No Returns: True or false, key custom.no_returns. Customer Account API access: Read.',
      'To block a customer, open the customer. Under Metafields, set No Returns to True.',
    ],
    links: [{label: 'Open customer metafields', href: 'shopify:admin/settings/custom_data/customer/metafields'}],
  },
  {
    heading: 'Test mode',
    intro: 'Try the app on your live store before customers see it. Only the customers you list see the Start return button.',
    steps: [
      'In Settings, Policy rules, turn on Only show returns to these customers.',
      'Enter the emails your testers sign in with. Select Save.',
      'Test the returns. When you are ready, turn test mode off. Then all customers see the button.',
    ],
    links: [{label: 'Open Policy rules', href: '/settings'}],
    note: 'Test mode keeps the button away from customers. It is not a security control: the email list can be read through the Customer Account API.',
  },
];

// ---- Home ----

export const CUSTOMER_JOURNEY: DocBlock[] = [
  {
    heading: 'Who sees the Start return button',
    intro: 'The button shows on the order page when all of these are true:',
    steps: [
      'The order was delivered within the return window. See Policy rules, Return window.',
      'At least one item is not final sale. See Order rules, What is final sale.',
      'No Returns is off on the order (metafield).',
      'No Returns is off on the customer (metafield).',
      'Test mode is off. Or the customer\'s email is on the test mode list in Policy rules.',
    ],
  },
  {
    heading: 'Start return',
    intro: 'The customer opens the order in their account and selects Start return. It is next to Buy again.',
  },
  {
    heading: 'Step 1: Select items',
    intro: 'The customer selects the items to send back. Items they cannot return are grey, with the reason under the name. A Final Sale SKU shows "Final sale". An item past the return window shows "The return period is closed." Items that Shopify\'s return rules lock (the sale collection) show "You cannot return this item." without a reason.',
  },
  {
    heading: 'Step 2: Tell us why',
    intro: 'The customer selects a reason for each item and can add details. They read the return policy and agree to it.',
  },
  {
    heading: 'Step 3: Return or exchange',
    intro: 'The customer sees the free return label for an exchange and the estimated refund for a return. They select one. Nothing is sent yet. Some orders cannot be exchanged, so they skip this step. See Order rules.',
  },
  {
    heading: 'Step 4: Confirm',
    intro: 'The customer sees how the option they selected works. For a return, they select original payment method or store credit. Store credit is selected first. Then they send the request. Customers outside the US see steps to send the return themselves: "Returned Goods" on the customs form, and your address.',
  },
  {
    heading: 'Confirmation: return',
    intro: 'If the customer selects Request a refund or Request store credit, they see the next steps. They write the order number, for example #1001, on the packing list.',
  },
  {
    heading: 'Confirmation: exchange',
    intro: 'If the customer selects Request an exchange, they see the next steps and a Shop latest button. When they send the request, a Flow workflow turns on Exchange Requested on the original order. Shop latest puts "Exchange" and the order number in the cart note, to help the customer. When they place the new order, a second workflow turns on Exchange Order and adds the tag exchange.',
  },
];

export const PROCESS_RETURN: DocBlock[] = [
  {
    heading: 'Find the return request',
    intro: 'A new request shows on the order as Return requested. The return number, the return fee, and each item\'s reason and customer note are on the return. The note on the first item shows the fee the customer saw, for example [FEE $20 AK/HI].',
    links: [{label: 'Open orders', href: 'shopify:admin/orders'}],
  },
  {
    heading: 'Process a return',
    steps: [
      'Open the order with the return request. Read the reason and the note on each item. The first note shows the fee the customer saw, for example [FEE $20 AK/HI].',
      'For a US order, make a return label in Shopify or in your shipping app. Keep the PDF and the tracking number.',
      'On the order, select Review return request.',
      'In Summary, select Return shipping. Change the fee to the [FEE ...] amount, then select Done. See Order rules.',
      'In Return shipping options, select Upload a return label. Add the PDF, the tracking number, and the carrier. For an order outside the US, select No shipping required: the customer sends the box themselves.',
      'Select Approve. The customer gets the approved email with the label, or with the send-it-yourself steps.',
      'When the box arrives, check the order number on the packing list. Examine the items.',
      'On the order, select Process and refund. Keep Restock on.',
      'In Refund method, select Store credit for a store credit return. Keep Original payment for a refund. Check that Refund owed matches the estimate. Select Process and refund.',
    ],
    links: [{label: 'Open orders', href: 'shopify:admin/orders'}],
    note: 'Items must be new and unused, with tags attached. Decline the request or contact the customer if they are not.',
    tone: 'info',
  },
  {
    heading: 'Decline a request',
    intro: 'The customer can still see Start return after a decline, so they can send a correct request. The return window still applies.',
    steps: [
      'On the order, select Review return request, then Decline.',
      'In Decline reason, select the reason. Only staff see the reason.',
      'In Message to customer, select Customize and write the message. If you do not select Customize, Shopify sends its own message for that reason.',
      'Select Decline request. The customer sees the message in the declined email and on their order page.',
      'If no return on this order is possible, turn on No Returns on the order. Start return goes away for this order only.',
      'If the customer must not return anything again, turn on No Returns on the customer. Start return goes away on all of their orders. Use this only for repeat problems.',
    ],
    links: [{label: 'Open orders', href: 'shopify:admin/orders'}],
  },
];

export const PROCESS_EXCHANGE: DocBlock[] = [
  {
    heading: 'Spot an exchange',
    intro: 'Exchanges come in as return requests, like returns. Follow them in the return status on the order.',
    steps: [
      'Open the return request on the order.',
      'The first item note starts with "[EXCHANGE] [FEE $0]". Other item notes start with "[EXCHANGE]".',
      'Exchange Requested is on for the order (metafield).',
    ],
    links: [{label: 'Open orders', href: 'shopify:admin/orders'}],
  },
  {
    heading: 'Process an exchange',
    steps: [
      'Find the new order: filter Orders by the tag exchange, or search for "Exchange" and the original order number. Its note says "Exchange #1001" and it has Exchange Order on.',
      'Customers are told the new order must cost the same or more. If it costs less, you decide.',
      'Make a return label in Shopify or in your shipping app. The label is free for exchanges.',
      'On the original order, select Review return request. In Summary, change Return shipping to $0. Upload the label with its tracking number, then select Approve.',
      'Ship the new order as normal. It is a normal order.',
      'When the return arrives, examine the items and refund the returned item in full.',
    ],
    note: 'Leave Exchange Requested on. The return emails use it to send the exchange text.',
  },
  {
    heading: 'If no new order arrives',
    intro: 'Customers have the return window. If no new order arrives, contact the customer. You can process it as a normal return, with the return fee.',
    tone: 'warning',
  },
];

// ---- Home > Order rules ----
// Rules the app adds on top of Shopify's return rules. Shopify can't set these fees,
// so the app shows them in the customer's estimate and staff set them on the return.
// Built from the saved Policy rules, so the amounts and on/off rules match the app.

const POLICY_LINK: DocLink = {label: 'Open Policy rules', href: '/settings'};

/** Fees are in US dollars: $20, $12.50. */
const usd = (amount: number) => `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

export function orderRules(policy: ReturnPolicy): DocBlock[] {
  const zones = policy.remoteZones.join(', ');
  const remoteFee = usd(policy.remoteFee);
  const remoteExchanges = policy.exchanges && policy.remoteExchanges;
  const noExchange = 'The customer does not see the exchange option. They go straight to the return.';
  const off = (what: string) => `This rule is off in Policy rules. ${what} follow the normal rules.`;

  return [
    {
      heading: 'Return fees at a glance',
      intro: 'Shopify return rules add the standard fee to every return. The customer sees the fee from this list. The app writes that fee in the first item note, for example [FEE $0] or [FEE $20 AK/HI]. When you approve, change Return shipping to that amount.',
      steps: [
        `Standard return: the fee from Shopify's return rules. Store credit: ${policy.storeCreditNoFee ? 'no fee' : 'the same fee'}.`,
        ...(policy.exchanges ? ['Exchange: no fee. The label is free.'] : []),
        'Returns on exchange orders: the fee applies to refunds and to store credit.',
        ...(policy.remote ? [`Remote states (${zones}): ${remoteFee}, for refunds and store credit.`] : []),
        ...(policy.international
          ? ["Outside the US: only the fees in that market's return policy. The customer pays return shipping."]
          : []),
      ],
      links: [POLICY_LINK],
      note: policy.remote
        ? `The remote states fee wins over every other fee rule. For example, an exchange order to ${policy.remoteZones[0]} pays ${remoteFee}.`
        : undefined,
    },
    {
      heading: 'Exchange orders',
      intro: 'An exchange order is the order a customer places to get the new item in an exchange. A Flow workflow turns on Exchange Order and adds the tag exchange. The customer cannot exchange that order again. Returns on it pay the return fee, also for store credit, because the free label was used on the first return.',
      steps: [noExchange, 'The return fee applies to refunds and to store credit. The free label was already used.'],
    },
    {
      heading: 'Store credit',
      intro: policy.storeCreditNoFee
        ? 'Store credit is the first choice and selected by default. The estimate shows it with no return fee, to make it the better offer.'
        : 'Store credit is the first choice and selected by default. It has the same return fee as a refund.',
      steps: [
        'The customer selects Store credit or Original payment method before they send the request.',
        'For store credit, each item note starts with "[STORE CREDIT]".',
        ...(policy.storeCreditNoFee
          ? [
              'When you approve, set Return shipping to $0. Exception: returns on exchange orders and remote states keep the fee in the [FEE ...] note.',
            ]
          : []),
        'When you refund, set Refund method to Store credit.',
      ],
    },
    {
      heading: 'What is final sale',
      intro: 'Customers cannot return a final sale item. An item is final sale for one of these reasons:',
      steps: [
        'On sale: the product has a compare-at price, so it is in the Final Sale collection. This applies to all sizes of the product, also sizes at full price.',
        ...(policy.finalSaleSku ? [`Final Sale SKU: the SKU of the size contains "${policy.finalSaleText}". This applies to that size only.`] : []),
      ],
      note: 'A product with a compare-at price on one size only is final sale in all sizes. Remove the compare-at price, or use a Final Sale SKU on the sizes that are on sale.',
      tone: 'warning',
    },
    policy.remote
      ? {
          heading: 'Remote states',
          intro: `Return shipping from these states costs more: ${zones}. Shopify return rules cannot set a fee by state, so the app reads the shipping address.`,
          steps: [
            remoteExchanges
              ? 'The customer can select an exchange. The exchange label is free, as for other US orders.'
              : noExchange,
            `The estimate shows a ${remoteFee} fee, for refunds and for store credit.`,
            `When you approve, set Return shipping to ${remoteFee}.`,
          ],
          note: remoteExchanges ? undefined : 'A customer in these states who wants an exchange must contact you.',
        }
      : {heading: 'Remote states', intro: off('Orders to these states'), links: [POLICY_LINK]},
    policy.international
      ? {
          heading: 'Orders outside the US',
          intro: 'The customer sends the return themselves. There is no return label. The return policy for their market sets any fees, for example a restocking fee.',
          steps: [
            noExchange,
            "The estimate shows only the fees from that market's return policy.",
            'The next steps tell the customer to write "Returned Goods" on the box and the customs form, and send it to your return address. Put your address in these steps in Settings, UI copy.',
            'Do not make a return label. Wait for the box, then refund as normal.',
          ],
          note: "A market's return policy only applies to orders placed after you add it.",
        }
      : {heading: 'Orders outside the US', intro: off('Orders outside the US'), links: [POLICY_LINK]},
  ];
}

export const FLOW_WORKFLOWS: DocBlock[] = [
  {
    heading: 'Why Flow',
    intro: 'Customer accounts cannot change order metafields. So Flow workflows set them: when a customer starts an exchange, when the customer places the new order, and when a customer asks for store credit. Each workflow looks only at the order that started it.',
    links: [{label: 'Open Flow', href: 'shopify:admin/apps/flow'}],
  },
  {
    heading: '1. Mark exchange requests',
    intro: 'The app sends a normal return request. For an exchange, each item note starts with "[EXCHANGE]". This workflow sees the note and marks the original order.',
    steps: [
      'Name: Mark exchange requests.',
      'Trigger: Return requested.',
      'Condition: Return, Return line items, At least one of, Customer note contains "[EXCHANGE]".',
      'Then: Update order metafield. Metafield: Exchange Requested (custom.exchange_requested). Value: true.',
      'Turn on the workflow.',
    ],
    note: 'The app sets the text "[EXCHANGE]". It is not in the copy editor. If a developer changes it, change this condition too.',
    tone: 'warning',
  },
  {
    heading: '2. Mark exchange orders',
    intro: 'When the customer places the new order, this workflow marks it as an exchange order. Then the customer cannot exchange that order again. It looks only at the new order, so nothing can match the wrong order.',
    steps: [
      'Name: Mark exchange orders.',
      'Trigger: Order created.',
      'Condition: Order, Custom attributes, At least one of, Key is equal to "Exchange for".',
      'Then: Update order metafield. Metafield: Exchange Order (custom.exchange_order). Value: true.',
      'Then: Add order tags: exchange.',
      'Turn on the workflow.',
    ],
    note: 'The Shop latest button on the exchange screen adds the cart attribute "Exchange for" and the order note. Only the attribute marks the order. If a customer shops another way and types the note, turn on Exchange Order on the new order by hand.',
    tone: 'info',
  },
  {
    heading: '3. Mark store credit requests',
    intro: 'For store credit, each item note starts with "[STORE CREDIT]". This workflow marks the order, so the return emails say store credit.',
    steps: [
      'Name: Mark store credit requests.',
      'Trigger: Return requested.',
      'Condition: Return, Return line items, At least one of, Customer note contains "[STORE CREDIT]".',
      'Then: Update order metafield. Metafield: Store Credit Requested (custom.store_credit_requested). Value: true.',
      'Turn on the workflow.',
    ],
  },
  {
    heading: '4. Mark store credit orders',
    intro: 'A customer can return an item for store credit and spend the credit on a new item. That is an exchange, but the new order is not marked as one. This workflow tags every order paid with store credit. If store credit paid the whole order, it also marks the order as an exchange order: no exchange is offered, and returns pay the return fee, also for store credit.',
    steps: [
      'Name: Mark store credit orders.',
      'Trigger: Order created.',
      'Condition: Order, Payment gateway names, At least one of, is equal to "shopify_store_credit".',
      'Then: Add order tags: store-credit.',
      'Then: a second Condition: Order, Payment gateway names, None of, Not equal to "shopify_store_credit". This means store credit paid the whole order.',
      'Then (second condition true): Update order metafield. Metafield: Exchange Order (custom.exchange_order). Value: true.',
      'Turn on the workflow.',
    ],
    note: 'Check the gateway name. On the first order paid with store credit, check for the tag store-credit. If it is missing, tell your developer. Tag store-credit without Exchange Order means part store credit: check the customer\'s orders and set the fee by judgment.',
    tone: 'warning',
  },
  {
    heading: 'Test the workflows',
    steps: [
      'On a test order, select Request an exchange. Check that Exchange Requested is on for that order.',
      'Select Shop latest on the confirmation and place an order. Check that the new order has the attribute "Exchange for", the tag exchange, and Exchange Order on.',
      'Place another order and type "Exchange" and an order number in the note, without Shop latest. It must not be marked.',
      'Place an order with no note and no Shop latest. It must not be marked.',
    ],
  },
];

// ---- Rendering ----

export function DocBlocks({blocks}: {blocks: DocBlock[]}) {
  return (
    <s-stack gap="base">
      {blocks.map((block) => (
        <s-section key={block.heading} heading={block.heading}>
          <s-stack gap="base">
            {block.intro && <s-paragraph>{block.intro}</s-paragraph>}
            {block.steps && (
              <s-ordered-list>
                {block.steps.map((step) => (
                  <s-list-item key={step}>{step}</s-list-item>
                ))}
              </s-ordered-list>
            )}
            {block.code?.map((line) => (
              <s-box key={line} background="subdued" borderRadius="base" padding="base">
                <s-text>{line}</s-text>
              </s-box>
            ))}
            {block.note && <s-banner tone={block.tone ?? 'info'}>{block.note}</s-banner>}
            {block.links && (
              <s-stack direction="inline" gap="base">
                {block.links.map((link) => (
                  <s-button key={link.href} href={link.href}>
                    {link.label}
                  </s-button>
                ))}
              </s-stack>
            )}
          </s-stack>
        </s-section>
      ))}
    </s-stack>
  );
}
