import '@shopify/ui-extensions/preact';
import {render} from 'preact';

import {customerAccountQuery, customerAllowed} from '../../../shared/returns/api.ts';
import {showReturnButton, type OrderButtonData} from '../../../shared/returns/eligibility.ts';
import {ORDER_BUTTON_QUERY} from '../../../shared/returns/graphql.ts';
import {parseCopy} from '../../../shared/returns/copy.ts';
import {parsePolicy} from '../../../shared/returns/policy.ts';

// "Start return" in the order action menu. Renders nothing unless the
// order passes the return rules (see eligibility.ts) and the customer passes
// customerAllowed (customer no_returns, test mode).
export default async () => {
  let show = false;
  let label = String(shopify.i18n.translate('menu.button'));
  try {
    const data = await customerAccountQuery<{
      shop: {copy: {value: string} | null; policy: {value: string} | null};
      order: OrderButtonData | null;
    }>(ORDER_BUTTON_QUERY, {orderId: shopify.orderId});
    const policy = parsePolicy(data.shop?.policy?.value);
    show = !!data.order && showReturnButton(data.order, new Date(), policy) && (await customerAllowed(policy));
    label = parseCopy(data.shop?.copy?.value)['menu.button'] ?? label;
  } catch (error) {
    console.error('[return-item] eligibility check failed', error);
  }

  render(show ? <MenuButton label={label} /> : null, document.body);
};

// Opens the return-page extension for this order. It is a separate extension
// because Shopify does not allow customer-account.order.page.render to share
// an extension with other targets. Order pages need the target and order ID in
// the URL: extension:<handle>/customer-account.order.page.render/<orderId>/
// shopify.orderId is a GID (gid://shopify/Order/123); the path takes the number.
function MenuButton({label}: {label: string}) {
  const orderId = shopify.orderId.split('/').pop();
  const href = `extension:return-page/customer-account.order.page.render/${orderId}/`;
  return <s-button href={href}>{label}</s-button>;
}
