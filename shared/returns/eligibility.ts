// Return rules, in one place. Pure functions only: no Shopify globals,
// so this file runs under `node --test` without the extension runtime.
//
// Shopify return rules (set in admin) do the first pass: returnInformation
// only lists items Shopify will accept. These checks add the store's own rules on top.

// The store's own rules (fees, which rules are on) are settings: see policy.ts.
import {DEFAULT_POLICY, finalSalePattern, type ReturnPolicy} from './policy.ts';

// Shopify's return rules own the window and the standard fee; staff edit them in
// admin, not in the app. These are fallbacks only:
// - The window: Shopify checks it only on orders placed while the rules were on.
//   Older orders would have no window, so the app checks this too.
export const RETURN_WINDOW_DAYS = 30;
// - The fee: shown when the rules set no return shipping fee (for example, rules
//   turned off on a dev store). Shop currency.
export const FALLBACK_RETURN_FEE = 10;

/**
 * The return fee the estimate shows, for a refund and for store credit. Shopify's return
 * rules can't express these cases, so staff set the same fee on the return by hand.
 * ruleFee: the fee from Shopify's return rules, or null when the rules set none.
 */
export function returnFees(
  eligibility: Pick<Eligibility, 'remoteShipping' | 'international' | 'isExchangeOrder'>,
  ruleFee: number | null,
  policy: ReturnPolicy = DEFAULT_POLICY,
): {fee: number; creditFee: number} {
  // The flags are already false when the rule is off (see evaluateOrder).
  if (eligibility.remoteShipping) return {fee: policy.remoteFee, creditFee: policy.remoteFee};
  // International: the customer ships the return, so only the market's return rules set a fee.
  const fee = ruleFee ?? (eligibility.international ? 0 : FALLBACK_RETURN_FEE);
  // On an exchange order the free label was already used on the first exchange.
  const creditFree = policy.storeCreditNoFee && !eligibility.isExchangeOrder;
  const creditFee = creditFree ? 0 : fee;
  return {fee, creditFee};
}

// The fee marker never takes room from the customer's text: the details field is
// shorter by this much, and a longer marker drops its reason (see feeMarker).
export const FEE_MARKER_MAX = 32;

/**
 * Starts the customer note on the first returned line, for example "[FEE $20 AK/HI]".
 * Shopify's return rules put the standard fee on every return, and the app can't change
 * it. So the note records the fee the customer was quoted, and why. Staff set the same
 * fee on the return. Exchanges are quoted no fee: the label is free.
 */
export function feeMarker(
  eligibility: Pick<Eligibility, 'remoteShipping' | 'international' | 'isExchangeOrder'>,
  quote: {fee: number; creditFee: number},
  path: 'exchange' | 'card' | 'credit',
  {currency = 'USD', zones = DEFAULT_POLICY.remoteZones}: {currency?: string; zones?: string[]} = {},
): string {
  const fee = path === 'exchange' ? 0 : path === 'credit' ? quote.creditFee : quote.fee;
  const number = Number.isInteger(fee) ? String(fee) : fee.toFixed(2);
  const amount = currency === 'USD' ? `$${number}` : `${number} ${currency}`;
  // Same order as returnFees: the first rule that sets the fee names it.
  const why =
    path === 'exchange'
      ? ''
      : eligibility.remoteShipping
        ? zones.join('/')
        : eligibility.international
          ? 'INTERNATIONAL'
          : eligibility.isExchangeOrder
            ? 'EXCHANGE ORDER'
            : '';
  const marker = `[FEE ${amount}${why ? ` ${why}` : ''}]`;
  return marker.length <= FEE_MARKER_MAX ? marker : `[FEE ${amount}]`;
}

/** Shipped outside the US: the customer ships the return, and the market's return rules set any fees. */
export function isInternationalAddress(address: {territoryCode: string | null} | null): boolean {
  return !!address?.territoryCode && address.territoryCode !== 'US';
}

export function isRemoteAddress(
  address: {zoneCode: string | null; territoryCode: string | null} | null,
  zones: string[] = DEFAULT_POLICY.remoteZones,
): boolean {
  return address?.territoryCode === 'US' && zones.includes(address.zoneCode ?? '');
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Shapes of ORDER_BUTTON_QUERY and ORDER_RETURN_QUERY (see graphql.ts) ----

interface Nodes<T> {
  nodes: T[];
}

export interface ReasonNode {
  id: string;
  name: string;
  deleted: boolean;
}

type Delivery = Nodes<{
  events: Nodes<{status: string; happenedAt: string}>;
  fulfillmentLineItems: Nodes<{lineItem: {id: string}}>;
}>;

/** Shape of ORDER_BUTTON_QUERY's `order`: only what the Start return button needs. */
export interface OrderButtonData {
  id: string;
  /** When the order was placed: decides the holiday window. */
  processedAt: string;
  exchangeOrder: {value: string} | null;
  noReturns: {value: string} | null;
  fulfillments: Delivery;
  returnInformation: {
    returnableLineItems: Nodes<{quantity: number; lineItem: {id: string; sku: string | null}}>;
  };
}

export interface OrderReturnData extends OrderButtonData {
  name: string;
  shippingAddress: {zoneCode: string | null; territoryCode: string | null} | null;
  returnInformation: {
    hasReturnShippingFee: boolean;
    nonReturnableSummary: {nonReturnableReasons: string[]} | null;
    returnableLineItems: Nodes<{
      quantity: number;
      lineItem: {
        id: string;
        title: string;
        variantTitle: string | null;
        sku: string | null;
        vendor: string | null;
        productType: string | null;
        image: {url: string; altText: string | null} | null;
        suggestedReturnReasonDefinitions: Nodes<ReasonNode> | null;
      };
    }>;
    nonReturnableLineItems: Nodes<{
      quantity: number;
      lineItem: {
        id: string;
        title: string;
        variantTitle: string | null;
        sku: string | null;
        image: {url: string; altText: string | null} | null;
      };
    }>;
  };
}

// ---- Result ----

export type ItemStatus = 'eligible' | 'final_sale' | 'not_delivered' | 'window_expired';

export interface ReturnItem {
  lineItemId: string;
  title: string;
  variantTitle: string | null;
  vendor: string | null;
  productType: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  quantity: number;
  deliveredAt: string | null;
  reasons: {id: string; name: string}[];
  status: ItemStatus;
}

export interface LockedItem {
  lineItemId: string;
  title: string;
  variantTitle: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  quantity: number;
}

export type HiddenReason = 'blocked' | 'no_eligible_items';

export interface Eligibility {
  /** Show the "Return item" button. */
  show: boolean;
  hiddenReason: HiddenReason | null;
  /** Bought in the holiday window: the end of its return date. Null otherwise. */
  holidayReturnBy: Date | null;
  /** Staff marked this order as an exchange: hide "Start exchange". */
  isExchangeOrder: boolean;
  /** Offer an exchange: exchanges are on and no rule below rules one out. */
  allowExchange: boolean;
  /** A rule on this order rules out an exchange (not the store-wide Exchanges switch). */
  exchangeBlocked: boolean;
  hasReturnShippingFee: boolean;
  /** Ships to a state in policy.remoteZones and the rule is on: the estimate uses policy.remoteFee. */
  remoteShipping: boolean;
  /** Ships outside the US and the rule is on: no exchange, no label, fees only from the market's return rules. */
  international: boolean;
  /** Items Shopify says are returnable, each with the app's verdict. */
  items: ReturnItem[];
  /** Items Shopify already refuses (returned, unfulfilled, rules). */
  locked: LockedItem[];
}

export function isFinalSaleSku(sku: string | null | undefined, text = DEFAULT_POLICY.finalSaleText): boolean {
  return !!sku && finalSalePattern(text).test(sku);
}

/** Latest DELIVERED event per line item, across all fulfillments. */
export function deliveredAtByLineItem(order: Pick<OrderButtonData, 'fulfillments'>): Map<string, string> {
  const result = new Map<string, string>();
  for (const fulfillment of order.fulfillments.nodes) {
    const delivered = fulfillment.events.nodes
      .filter((event) => event.status === 'DELIVERED')
      .map((event) => event.happenedAt)
      .sort()
      .at(-1);
    if (!delivered) continue;
    for (const {lineItem} of fulfillment.fulfillmentLineItems.nodes) {
      const current = result.get(lineItem.id);
      if (!current || Date.parse(delivered) > Date.parse(current)) {
        result.set(lineItem.id, delivered);
      }
    }
  }
  return result;
}

export function withinWindow(deliveredAt: string, now: Date, days = DEFAULT_POLICY.windowDays): boolean {
  const elapsed = now.getTime() - Date.parse(deliveredAt);
  return elapsed >= 0 && elapsed <= days * DAY_MS;
}

const monthDay = (date: Date) => (date.getMonth() + 1) * 100 + date.getDate();
const parseMonthDay = (value: string) => {
  const [month, day] = value.split('-').map(Number);
  return month * 100 + day;
};

/**
 * Holiday window: the end of the return date (23:59:59) when the order was placed
 * from holidayStart to holidayEnd, or null. Uses the runtime's time zone: in the
 * extension, that is the customer's. A range can cross the new year (12-15 to 01-05).
 */
export function holidayReturnBy(processedAt: string, policy: ReturnPolicy): Date | null {
  if (!policy.holiday) return null;
  const placed = new Date(processedAt);
  if (Number.isNaN(placed.getTime())) return null;
  const placedDay = monthDay(placed);
  const start = parseMonthDay(policy.holidayStart);
  const end = parseMonthDay(policy.holidayEnd);
  const inRange = start <= end ? placedDay >= start && placedDay <= end : placedDay >= start || placedDay <= end;
  if (!inRange) return null;
  const [month, day] = policy.holidayReturnBy.split('-').map(Number);
  // The first return date on or after the purchase.
  let returnBy = new Date(placed.getFullYear(), month - 1, day, 23, 59, 59, 999);
  if (returnBy < placed) returnBy = new Date(placed.getFullYear() + 1, month - 1, day, 23, 59, 59, 999);
  return returnBy;
}

function itemStatus(
  sku: string | null,
  deliveredAt: string | null,
  now: Date,
  policy: ReturnPolicy,
  returnBy: Date | null,
): ItemStatus {
  if (policy.finalSaleSku && isFinalSaleSku(sku, policy.finalSaleText)) return 'final_sale';
  if (!deliveredAt) return 'not_delivered';
  // The later of the two ends: a holiday order delivered late keeps its normal window.
  const open = withinWindow(deliveredAt, now, policy.windowDays) || (!!returnBy && now <= returnBy);
  return open ? 'eligible' : 'window_expired';
}

// The order-level rules. The button and the return page both use this, so they always agree.
function hiddenReasonFor(order: OrderButtonData, statuses: ItemStatus[]): HiddenReason | null {
  // Staff can block returns on any order with custom.no_returns.
  if (order.noReturns?.value === 'true') return 'blocked';
  if (!statuses.includes('eligible')) return 'no_eligible_items';
  return null;
}

/** The Start return button: the same order rules as evaluateOrder, from the small button query. */
export function showReturnButton(order: OrderButtonData, now: Date, policy: ReturnPolicy = DEFAULT_POLICY): boolean {
  const delivered = deliveredAtByLineItem(order);
  const returnBy = holidayReturnBy(order.processedAt, policy);
  const statuses = order.returnInformation.returnableLineItems.nodes.map(({lineItem}) =>
    itemStatus(lineItem.sku, delivered.get(lineItem.id) ?? null, now, policy, returnBy),
  );
  return hiddenReasonFor(order, statuses) === null;
}

export function evaluateOrder(order: OrderReturnData, now: Date, policy: ReturnPolicy = DEFAULT_POLICY): Eligibility {
  const isExchangeOrder = order.exchangeOrder?.value === 'true';
  const delivered = deliveredAtByLineItem(order);
  const returnBy = holidayReturnBy(order.processedAt, policy);
  const info = order.returnInformation;

  const items: ReturnItem[] = info.returnableLineItems.nodes.map(({quantity, lineItem}) => {
    const deliveredAt = delivered.get(lineItem.id) ?? null;
    return {
      lineItemId: lineItem.id,
      title: lineItem.title,
      variantTitle: lineItem.variantTitle,
      vendor: lineItem.vendor,
      productType: lineItem.productType,
      imageUrl: lineItem.image?.url ?? null,
      imageAlt: lineItem.image?.altText ?? null,
      quantity,
      deliveredAt,
      reasons: (lineItem.suggestedReturnReasonDefinitions?.nodes ?? [])
        .filter((reason) => !reason.deleted)
        .map(({id, name}) => ({id, name})),
      status: itemStatus(lineItem.sku, deliveredAt, now, policy, returnBy),
    };
  });

  const locked: LockedItem[] = info.nonReturnableLineItems.nodes.map(({quantity, lineItem}) => ({
    lineItemId: lineItem.id,
    title: lineItem.title,
    variantTitle: lineItem.variantTitle,
    imageUrl: lineItem.image?.url ?? null,
    imageAlt: lineItem.image?.altText ?? null,
    quantity,
  }));

  const hiddenReason = hiddenReasonFor(
    order,
    items.map((item) => item.status),
  );

  const remoteShipping = policy.remote && isRemoteAddress(order.shippingAddress, policy.remoteZones);
  const international = policy.international && isInternationalAddress(order.shippingAddress);

  const exchangeBlocked = isExchangeOrder || (remoteShipping && !policy.remoteExchanges) || international;

  return {
    show: hiddenReason === null,
    hiddenReason,
    holidayReturnBy: returnBy,
    isExchangeOrder,
    allowExchange: policy.exchanges && !exchangeBlocked,
    exchangeBlocked,
    hasReturnShippingFee: info.hasReturnShippingFee,
    remoteShipping,
    international,
    items,
    locked,
  };
}

