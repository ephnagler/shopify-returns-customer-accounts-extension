# return-item

The **Start return** button in the order action menu
(`customer-account.order.action.menu-item.render`).

It runs a small Customer Account API query for each order and checks it with
`showReturnButton` (`shared/returns/eligibility.ts`). It shows nothing when the order fails the
return rules, or when the customer is blocked or not on the test mode list.

The button opens the `return-page` extension for the order.
