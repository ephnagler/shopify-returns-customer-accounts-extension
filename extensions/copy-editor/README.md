# copy-editor

The app's admin page (`admin.app.home.render`).

- **Home**: staff docs (customer journey, how to process a return or an exchange, the order
  rules, the Flow workflows) and a shared test list.
- **Settings**: the return rules (Policy rules), the customer-facing text (Policy copy, UI
  copy), and a checklist of Shopify settings.

It reads and writes app-owned shop metafields with Direct API access (`shopify.query`):
`$app:policy`, `$app:copy`, and `$app:testing`. Routing uses `preact-iso`.

The docs text is in `src/content.tsx`. The test list is in `src/testList.ts`.
