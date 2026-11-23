# return-page

The return flow, as a full order page (`customer-account.order.page.render`). The
`return-item` button opens it.

Steps:

1. Select items.
2. Tell us why: a reason for each item, optional details, and the return policy.
3. Return or exchange. This step is skipped when no exchange is offered.
4. Confirm: for a return, select store credit or the original payment method.

It uses `returnCalculate` for the refund estimate and `orderRequestReturn` to send the request.
Customer-facing text comes from `locales/en.default.json`, with staff edits from `$app:copy`.
