# Engineering notes

An extension-only Shopify app: three UI extensions and shared TypeScript. No server, no
database. See the README for what each part does.

## Layout

- `extensions/return-item`: the Start return button (customer accounts).
- `extensions/return-page`: the return flow (customer accounts, full page).
- `extensions/copy-editor`: the admin page (App Home).
- `shared/returns/`: rules, fees, copy, and GraphQL used by all three.
- `test/`: `node --test` tests for `shared/returns/` and the test list.
- `scripts/seed-returns.mjs`: seeds a development store with one order per test case.

## Rules

- Keep `shared/returns/` free of Shopify globals, so it runs under `node --test`.
- The Start return button and the return page must agree. Put each order rule in
  `eligibility.ts` and use it from both.
- A new setting goes in `ReturnPolicy`, `DEFAULT_POLICY`, `parsePolicy`, and the Policy rules
  form. Add a test for its default and for a bad value.
- A new customer-facing string goes in the extension's `locales/en.default.json` and in
  `COPY_FIELDS` (`shared/returns/copy.ts`). The copy tests fail if one is missing.
- The note prefixes `[EXCHANGE]` and `[STORE CREDIT]` are matched by Flow workflows. If you
  change one, change `flows/README.md` and the docs in `extensions/copy-editor/src/content.tsx`.
- Keep the Customer Account API query cost low. The orders list runs one button check per order.
- Staff docs and UI text use ASD-STE100 Simplified Technical English: short sentences, active
  voice, one word for one idea.
- Keep code comments short. Explain why, not what.

## Commands

- `pnpm test`: run the tests.
- `pnpm typecheck`: check the types in the three extensions.
- `shopify app dev`: run the app on a development store.
- `pnpm seed --store <store>.myshopify.com --email <customer email>`: make test orders.

Use the [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) or the Shopify
Dev MCP (`mcp.json`) for Shopify API and platform questions.
