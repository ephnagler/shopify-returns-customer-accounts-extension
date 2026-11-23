import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/ReturnPage.tsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order.page.render').Api;
  const globalThis: { shopify: typeof shopify };
}
