# Shopify returns in customer accounts (example app)

A reference app for self-serve returns and exchanges in Shopify customer accounts. It uses
Shopify's native returns APIs. It has no server and no database: Shopify hosts every part.

Use it to learn the pattern, or as a starting point for your own app. It is an example, not a
supported product.

## What it shows

### Three extensions

| Extension | Target | What it does |
|---|---|---|
| `extensions/return-item` | `customer-account.order.action.menu-item.render` | A **Start return** button on the order. It shows only when the order passes the return rules. |
| `extensions/return-page` | `customer-account.order.page.render` | A full-page return flow: select items, give a reason, choose a return or an exchange, see the refund estimate, and send the request. |
| `extensions/copy-editor` | `admin.app.home.render` | The app's admin page. Staff edit the customer-facing text and the return rules. It also has staff docs and a test list. |

The shared logic is in `shared/returns/`. It is plain TypeScript with no Shopify globals, so
the tests run it under `node --test`.

| File | Contents |
|---|---|
| `eligibility.ts` | Which items can be returned, and the fee the customer sees. |
| `policy.ts` | The return rules: defaults, parsing, and the admin form. |
| `copy.ts` | The editable customer-facing text. |
| `graphql.ts` | The Customer Account API queries and mutation. |
| `api.ts` | The Customer Account API client, with retry on throttling. |

### Native APIs

- **Customer Account API**
  - `order.returnInformation`: the items that Shopify's return rules accept, with suggested
    return reasons for each item.
  - `returnCalculate`: the refund estimate, with tax, return shipping fee, and restocking fee.
  - `orderRequestReturn`: sends the return request. Staff approve it in Shopify admin.
- **Shopify return rules** set the return window, the standard return fee, final sale
  collections, and fees for each market. The app adds its own rules on top (see below).
- **App-owned shop metafields** hold the settings. Customer accounts can read them. There is
  no database.
- **Shopify Flow** sets order metafields that a customer account extension cannot set. See
  [`flows/README.md`](flows/README.md).
- **Direct API access** from the admin page (`shopify.query`), as the signed-in staff member.

### Settings in metafields

| Metafield | Type | Contents |
|---|---|---|
| `$app:copy` | JSON | Edited text, keyed by locale key. A missing key uses the extension's `locales/en.default.json`. |
| `$app:policy` | JSON | The return rules. A missing or bad setting uses the default in `shared/returns/policy.ts`. |
| `$app:testing` | JSON | The checked items in the admin test list. |

The app also reads these merchant-owned metafields (`custom` namespace, True or false):

| Owner | Key | Set by |
|---|---|---|
| Order | `exchange_order` | Flow, when a customer places the new order of an exchange |
| Order | `exchange_requested` | Flow, when a customer requests an exchange |
| Order | `store_credit_requested` | Flow, when a customer requests store credit |
| Order | `no_returns` | Staff, to block returns on one order |
| Customer | `no_returns` | Staff, to block all returns for one customer |

### Return rules

Shopify's return rules do the first check. The app adds these rules. Staff turn each rule on
or off in **Settings > Policy rules**.

| Rule | Default |
|---|---|
| Return window, days after delivery | 30 days |
| Holiday window: items bought between two dates can be returned until a set date | On. Bought November 15 to December 31, return by January 31 |
| Store credit has no return fee (except on exchange orders) | On |
| Exchanges | On |
| A SKU that contains a text makes the item final sale | On, text `Final Sale` |
| Remote states: a different return fee for some US states, and no exchange | On. AK and HI, $20, no exchange |
| Outside the US: the customer ships the return, no exchange | On |
| Test mode: only listed customer emails see the button | Off |

The fallback return fee is $10. The app uses it only when Shopify's return rules set no fee.

Shopify's return rules put one standard fee on every return, and `orderRequestReturn` has no
fee input. So the app writes the fee that the customer saw at the start of the first item
note, for example `[FEE $20 AK/HI]`. Staff set the same fee on the return when they approve it.
Exchange and store credit requests also start each item note with `[EXCHANGE]` or
`[STORE CREDIT]`.

## Rules you can build

This app is a base. Each store has its own return policy, so change the rules to match yours.
The examples below show the types of rules that the base supports. They are ideas, not
instructions.

Most rules use one of these parts:

- **A setting** in `$app:policy`, with a switch in **Settings > Policy rules**.
- **A flag** on the order or the customer, as a `custom.` metafield. Staff or Flow set it.
- **A check** in `shared/returns/eligibility.ts`. The button and the return page use the same
  check, so they always agree.
- **A fee** in `returnFees`, and a reason in the `[FEE ...]` note marker.

### Rules in this app

The app has these rules now. Staff turn each one on or off in Policy rules.

| Rule | Example |
|---|---|
| Return window | Customers can return items for 30 days after delivery. |
| Holiday window | Items bought from November 15 to December 31 can come back until January 31. |
| Fallback return fee | If Shopify's return rules set no fee, the app shows a fee of $10. |
| Store credit has no fee | A refund costs a $10 fee. Store credit costs nothing. |
| Exchanges on or off | Turn off exchanges, and every request is a return. |
| Exchange orders | An order placed as an exchange cannot be exchanged again. Its returns pay the fee, also for store credit. |
| Store credit orders | An order paid fully with store credit counts as an exchange order. A Flow workflow marks it. |
| Final sale by SKU | A SKU that contains a word, for example `Final Sale`, makes that size final sale. |
| Final sale collections | Shopify's return rules make a collection final sale, for example all items on sale. |
| Region fees | Returns from some states cost more, for example $20. By default, these orders get no exchange. |
| International returns | Outside the US, the customer sends the return. The page shows the steps. |
| Order block | A flag on one order hides the Start return button. |
| Customer block | A flag on a customer blocks all of their returns. |
| Test mode | Only the staff emails on a list see the button. Use it to test on a live store. |

### Rules you can add

The app does not have these rules. Add them for your store.

**Combined-item rules.** The rule looks at the items in the order together.

- A customer buys two sizes of the same item to find the fit. One item can come back with no
  fee. If both come back, the customer pays a fee, for example $10.
- These orders get no exchange, because the customer already has the second size.
- The fee can apply to refunds only, or to refunds and store credit.
- Staff or Flow mark these orders with an order flag. The app cannot read order tags.

**Discount rules.** The rule looks at the discounts on the order.

- An order with a discount code is final sale. The Start return button does not show.
- An order with a discount can only be exchanged, not refunded.
- Discounted items get store credit only.
- Exchange orders are an exception. Staff often use a discount to make the new order free.

**Other ideas.**

- A longer holiday window only for gift orders. A cart attribute marks the order as a gift.
- A different return window for one product type, for example 7 days for swimwear.
- No return fee for customers with a tag or a loyalty level. Use a customer flag, because
  the app cannot read tags.

### What a backend adds

Some rules need a server. This app has none. See "Limitations".

- Set the real fee on the return, so staff do not change it by hand.
- Accept holiday returns after Shopify's return window ends.
- Write order flags without Flow, and read order tags.
- Keep the test mode list private.

## Requirements

- A Shopify Partner account and a development store.
- New customer accounts on the store.
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli).
- Node.js 22.18 or later. The tests run TypeScript files with Node's type stripping.
- pnpm.

## Set up

1. Install the packages:

   ```shell
   pnpm install
   ```

2. Create a new app in your Partner account, or link an app that you have. This fills in
   `client_id` in `shopify.app.toml`:

   ```shell
   shopify app config link
   ```

3. Start the app on your development store:

   ```shell
   shopify app dev
   ```

4. Install the app on the store when the CLI asks.
5. In Shopify admin, open the app. Go to **Settings > Shopify settings** and do each step.
   The steps include the return rules, the metafield definitions, and the Flow workflows.
6. In the checkout and accounts editor, add **Return page** from this app to an order page.
7. In **Settings > UI copy**, replace `[Your return address]` with your return address.

### Test orders

The seed script makes one order for each test case. It uses the Shopify CLI and your staff
login. The code holds no token.

1. Create a customer in admin with an email that you can sign in with.
2. Give the CLI access to the store. The scopes are in `scripts/seed-returns.mjs`.

   ```shell
   shopify store auth -s <store>.myshopify.com --scopes <scopes>
   ```

3. Make the orders:

   ```shell
   pnpm seed --store <store>.myshopify.com --email <customer email>
   ```

4. In the app, open **Home > Test list**. Each letter in the list is a seed order.

## Tests

```shell
pnpm test
pnpm typecheck
```

The tests cover the return rules, the fee math, the policy form, and the copy defaults.
`pnpm typecheck` checks the types in the three extensions.

## Limitations

- **No server.** The app runs only when a customer or a staff member opens a page. Anything
  that must run later needs a backend. Examples: set the fee on the return, make return labels,
  or act on webhooks.
- **Staff set the fee by hand.** The app cannot change the fee on a return request. See
  "Return rules" above.
- **Store credit cannot be tested on development stores.** Shopify limits store credit
  payments on development stores. Test the store credit workflows on a live store, with test
  mode on.
- **Order tags are not available** in the Customer Account API. The app reads metafields.
- **Fees show in US dollars.** The fees in Policy rules use one currency, `USD`
  (`FEE_CURRENCY` in `extensions/return-page/src/ReturnPage.tsx`).
- **The settings are public.** Customers can read `$app:policy` and `$app:copy` through the
  Customer Account API. Test mode is not a security control.

## License

MIT. See [LICENSE](LICENSE).
