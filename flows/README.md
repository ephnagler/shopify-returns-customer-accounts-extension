# Shopify Flow workflows

The app needs four Shopify Flow workflows. They set order metafields,
because a customer account extension cannot change order metafields (there is no
`customer_write_orders` scope).

Build them in Shopify admin → Apps → Flow. The names are suggestions. The numbers match the
Flow workflows tab in the app.

| | Workflow | Trigger | Sets |
|---|---|---|---|
| 1 | Mark exchange requests | Return requested | `custom.exchange_requested` = true on the original order |
| 2 | Mark exchange orders | Order created | `custom.exchange_order` = true on the new order |
| 3 | Mark store credit requests | Return requested | `custom.store_credit_requested` = true |
| 4 | Mark store credit orders | Order created | tag `store-credit`; `custom.exchange_order` = true when store credit paid the whole order |

Each metafield is a merchant-owned order definition in `custom.` (True or false). Set Customer
Account API access to **Read**. Turn on **Filter in admin**, so staff can filter orders.

---

## 1. Mark exchange requests

When a customer selects **Request an exchange**, the app sends a normal return request. Each
item's customer note starts with `[EXCHANGE]`. This workflow finds that note and marks the order.

1. **Trigger:** Return requested.
2. **Condition:** Return → Return line items → **At least one of** → Customer note
   **contains** `[EXCHANGE]`
3. **Then → Action:** Update order metafield.
   - Metafield: Exchange Requested (`custom.exchange_requested`)
   - Value: `true`
4. Turn on the workflow.

> The app sets the text `[EXCHANGE]` (`EXCHANGE_NOTE_PREFIX` in
> `extensions/return-page/src/ReturnPage.tsx`). It is not in the copy editor. If you change it,
> change this condition too.

---

## 2. Mark exchange orders

When the customer places the new order, this workflow marks it as an exchange order. Then the
customer cannot exchange that order again. The workflow looks **only at the new order**, so it
cannot match the wrong order. Only the cart attribute marks the order:

- **Cart attribute `Exchange for`:** the Shop latest button on the exchange confirmation goes
  through the storefront's `/cart/update`. It sets the attribute (`Exchange for` = `#1001`) and
  the order note (`Exchange #1001`). Both copy to the order.

The note alone does not mark the order. A condition such as "Note contains Exchange" also matches
notes like "no exchange, just a refund". If a customer shops another way and types the note,
staff turn on `exchange_order` by hand.

1. **Trigger:** Order created.
2. **Condition:** Order → Custom attributes → **At least one of** → Key **is equal to**
   `Exchange for`
3. **Then → Action:** Update order metafield.
   - Metafield: Exchange Order (`custom.exchange_order`)
   - Value: `true`
4. **Then → Action:** Add order tags → `exchange`.
5. Turn on the workflow.

Staff follow exchanges through the return status on the original order. The new order is a
normal order. Its note and attribute name the original order, so staff can find it and check
that it is of equal or greater value. Leave `exchange_requested` on: the return emails read it.

---

## 3. Mark store credit requests

When a customer selects **Request store credit**, each item's customer note starts with
`[STORE CREDIT]`. This workflow marks the order, so the return emails can say store credit.

1. **Trigger:** Return requested.
2. **Condition:** Return → Return line items → **At least one of** → Customer note
   **contains** `[STORE CREDIT]`
3. **Then → Action:** Update order metafield.
   - Metafield: Store Credit Requested (`custom.store_credit_requested`)
   - Value: `true`
4. Turn on the workflow.

> The app sets the text `[STORE CREDIT]` (`STORE_CREDIT_NOTE_PREFIX` in
> `extensions/return-page/src/ReturnPage.tsx`). If you change it, change this condition too.

Return emails cannot read the item customer note, but they can read order metafields. This
flag is how the approved email knows to say store credit.

---

## 4. Mark store credit orders

A customer can return an item for store credit (no fee) and spend the credit on a new item. That
is an exchange, but the new order has no Exchange Order flag, so its next return is free again.

1. **Trigger:** Order created.
2. **Condition:** Order → Payment gateway names → **At least one of** → **is equal to** `shopify_store_credit`.
3. **Then → Action:** Add order tags → `store-credit`.
4. **Then → Condition:** Order → Payment gateway names → **None of** → **Not equal to** `shopify_store_credit`.
   This means store credit paid the whole order.
5. **Then → Action:** Update order metafield → Exchange Order (`custom.exchange_order`) = `true`.
6. Turn on the workflow.

> **Check the gateway name.** `shopify_store_credit` is the gateway on store credit refunds.
> Check the name on the first order paid with store credit (order page → Payment, or
> `paymentGatewayNames` in the Admin API). Change the condition if it is different.

---

## Test

Seed new orders (`pnpm seed --store <store> --email <customer email> --only N,O,P,Q --batch <n>`), then:

1. On the exchange test order, select **Request an exchange**. Workflow 1 sets
   `exchange_requested` on that order.
2. Select **Shop latest** on the confirmation and place an order. The new order has the
   attribute `Exchange for`, the tag `exchange`, and `exchange_order` on.
3. Place another order without the Shop latest button. Type `Exchange #<number>` in the note.
   The workflow does not mark it. Staff mark it by hand.
4. Place an order with no note and no Shop latest button. The workflow does not mark it.

Flow shows the exact field labels. Check them while you build.
