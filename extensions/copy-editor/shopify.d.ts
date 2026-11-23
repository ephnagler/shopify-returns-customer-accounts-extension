import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/App.tsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/pages/HomePage.tsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/pages/SettingsPage.tsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/components/Tabs.tsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/components/TestList.tsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/content.tsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/testList.ts' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/components/PolicyRules.tsx' {
  const shopify: import('@shopify/ui-extensions/admin.app.home.render').Api;
  const globalThis: { shopify: typeof shopify };
}
