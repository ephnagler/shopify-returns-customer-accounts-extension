import {test} from 'node:test';
import {DEFAULT_POLICY} from '../shared/returns/policy.ts';
import assert from 'node:assert/strict';

import {
  evaluateOrder,
  feeMarker,
  FEE_MARKER_MAX,
  isFinalSaleSku,
  isInternationalAddress,
  isRemoteAddress,
  returnFees,
  showReturnButton,
  withinWindow,
  holidayReturnBy,
  type OrderReturnData,
} from '../shared/returns/eligibility.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

interface ItemSpec {
  id: string;
  sku?: string;
  deliveredDaysAgo?: number | null;
}

function order(
  items: ItemSpec[],
  {
    exchange = false,
    blocked = false,
  }: {exchange?: boolean; blocked?: boolean} = {},
): OrderReturnData {
  return {
    id: 'gid://shopify/Order/1',
    name: '#1001',
    processedAt: daysAgo(30),
    exchangeOrder: exchange ? {value: 'true'} : null,
    noReturns: blocked ? {value: 'true'} : null,
    fulfillments: {
      nodes: items.map((item) => ({
        events: {
          nodes:
            item.deliveredDaysAgo == null
              ? [{status: 'IN_TRANSIT', happenedAt: daysAgo(20)}]
              : [
                  {status: 'IN_TRANSIT', happenedAt: daysAgo(item.deliveredDaysAgo + 2)},
                  {status: 'DELIVERED', happenedAt: daysAgo(item.deliveredDaysAgo)},
                ],
        },
        fulfillmentLineItems: {nodes: [{lineItem: {id: item.id}}]},
      })),
    },
    returnInformation: {
      hasReturnShippingFee: true,
      nonReturnableSummary: null,
      returnableLineItems: {
        nodes: items.map((item) => ({
          quantity: 1,
          lineItem: {
            id: item.id,
            title: `Item ${item.id}`,
            variantTitle: null,
            sku: item.sku ?? `SKU-${item.id}`,
            vendor: 'Example Vendor',
            productType: 'Shoes',
            image: null,
            suggestedReturnReasonDefinitions: {
              nodes: [
                {id: 'r1', name: 'Too small', deleted: false},
                {id: 'r2', name: 'Old reason', deleted: true},
              ],
            },
          },
        })),
      },
      nonReturnableLineItems: {nodes: []},
    },
  };
}

test('final sale SKU match ignores case and spacing', () => {
  assert.equal(isFinalSaleSku('SH-100-Final Sale'), true);
  assert.equal(isFinalSaleSku('sh-100-FINALSALE'), true);
  assert.equal(isFinalSaleSku('SH-100'), false);
  assert.equal(isFinalSaleSku(null), false);
});

test('window is 30 days from delivery, inclusive', () => {
  assert.equal(withinWindow(daysAgo(29), NOW), true);
  assert.equal(withinWindow(daysAgo(30), NOW), true);
  assert.equal(withinWindow(daysAgo(31), NOW), false);
});

test('delivered 3 days ago: show', () => {
  const result = evaluateOrder(order([{id: 'a', deliveredDaysAgo: 3}]), NOW);
  assert.equal(result.show, true);
  assert.equal(result.items[0].status, 'eligible');
  assert.deepEqual(result.items[0].reasons, [{id: 'r1', name: 'Too small'}]);
});

test('delivered 31 days ago: hide', () => {
  const result = evaluateOrder(order([{id: 'a', deliveredDaysAgo: 31}]), NOW);
  assert.equal(result.show, false);
  assert.equal(result.items[0].status, 'window_expired');
});

test('fulfilled but not delivered: hide', () => {
  const result = evaluateOrder(order([{id: 'a', deliveredDaysAgo: null}]), NOW);
  assert.equal(result.show, false);
  assert.equal(result.items[0].status, 'not_delivered');
});

test('all items final sale: hide', () => {
  const result = evaluateOrder(
    order([
      {id: 'a', sku: 'X-Final Sale', deliveredDaysAgo: 3},
      {id: 'b', sku: 'Y-FINAL SALE', deliveredDaysAgo: 3},
    ]),
    NOW,
  );
  assert.equal(result.show, false);
  assert.equal(result.hiddenReason, 'no_eligible_items');
});

test('mixed final sale: show, final sale item locked', () => {
  const result = evaluateOrder(
    order([
      {id: 'a', sku: 'X-Final Sale', deliveredDaysAgo: 3},
      {id: 'b', deliveredDaysAgo: 3},
    ]),
    NOW,
  );
  assert.equal(result.show, true);
  assert.deepEqual(
    result.items.map((item) => item.status),
    ['final_sale', 'eligible'],
  );
});

test('exchange order: show, flagged as exchange', () => {
  const result = evaluateOrder(order([{id: 'a', deliveredDaysAgo: 3}], {exchange: true}), NOW);
  assert.equal(result.show, true);
  assert.equal(result.isExchangeOrder, true);
});

test('split shipment: each item uses its own delivery date', () => {
  const result = evaluateOrder(
    order([
      {id: 'a', deliveredDaysAgo: 40},
      {id: 'b', deliveredDaysAgo: 2},
    ]),
    NOW,
  );
  assert.equal(result.show, true);
  assert.deepEqual(
    result.items.map((item) => item.status),
    ['window_expired', 'eligible'],
  );
});

test('no_returns metafield hides any order, exchange or not', () => {
  for (const exchange of [false, true]) {
    const result = evaluateOrder(order([{id: 'a', deliveredDaysAgo: 3}], {exchange, blocked: true}), NOW);
    assert.equal(result.show, false);
    assert.equal(result.hiddenReason, 'blocked');
  }
});

test('isRemoteAddress: only the listed US states', () => {
  assert.equal(isRemoteAddress({zoneCode: 'AK', territoryCode: 'US'}), true);
  assert.equal(isRemoteAddress({zoneCode: 'HI', territoryCode: 'US'}), true);
  assert.equal(isRemoteAddress({zoneCode: 'OR', territoryCode: 'US'}), false);
  assert.equal(isRemoteAddress({zoneCode: 'AK', territoryCode: 'CA'}), false);
  assert.equal(isRemoteAddress(null), false);
});

test('isInternationalAddress: any country but the US', () => {
  assert.equal(isInternationalAddress({territoryCode: 'CA'}), true);
  assert.equal(isInternationalAddress({territoryCode: 'US'}), false);
  assert.equal(isInternationalAddress({territoryCode: null}), false);
  assert.equal(isInternationalAddress(null), false);
});

test('returnFees: standard, store credit, remote, exchange order', () => {
  const base = {remoteShipping: false, international: false, isExchangeOrder: false};
  assert.deepEqual(returnFees(base, 25), {fee: 25, creditFee: 0});
  assert.deepEqual(returnFees(base, null), {fee: 10, creditFee: 0});
  assert.deepEqual(returnFees({...base, international: true}, null), {fee: 0, creditFee: 0});
  assert.deepEqual(returnFees({...base, remoteShipping: true}, 25), {fee: 20, creditFee: 20});
  assert.deepEqual(returnFees({...base, isExchangeOrder: true}, 25), {fee: 25, creditFee: 25});
  // The remote fee wins over the exchange order rule.
  assert.deepEqual(returnFees({...base, remoteShipping: true, isExchangeOrder: true}, 25), {fee: 20, creditFee: 20});
});

test('feeMarker: the quoted fee and the rule that set it', () => {
  const base = {remoteShipping: false, international: false, isExchangeOrder: false};
  const quote = {fee: 25, creditFee: 0};
  assert.equal(feeMarker(base, quote, 'card'), '[FEE $25]');
  assert.equal(feeMarker(base, quote, 'credit'), '[FEE $0]');
  assert.equal(feeMarker(base, quote, 'exchange'), '[FEE $0]');
  assert.equal(feeMarker({...base, remoteShipping: true, isExchangeOrder: true}, {fee: 20, creditFee: 20}, 'credit'), '[FEE $20 AK/HI]');
  assert.equal(feeMarker({...base, isExchangeOrder: true}, {fee: 25, creditFee: 25}, 'credit'), '[FEE $25 EXCHANGE ORDER]');
  assert.equal(feeMarker({...base, international: true}, {fee: 12.5, creditFee: 12.5}, 'card', {currency: 'CAD'}), '[FEE 12.50 CAD INTERNATIONAL]');
  // A long state list drops the reason instead of taking room from the customer's text.
  const long = feeMarker({...base, remoteShipping: true}, {fee: 20, creditFee: 20}, 'card', {zones: ['AK', 'HI', 'PR', 'GU', 'VI', 'AS', 'MP', 'WA', 'OR']});
  assert.equal(long, '[FEE $20]');
  assert.ok(long.length <= FEE_MARKER_MAX);
});

test('the button and the return page agree on every order rule', () => {
  const cases: [ItemSpec[], Parameters<typeof order>[1]][] = [
    [[{id: 'a', deliveredDaysAgo: 3}], {}],
    [[{id: 'a', deliveredDaysAgo: 31}], {}],
    [[{id: 'a', deliveredDaysAgo: null}], {}],
    [[{id: 'a', deliveredDaysAgo: 3, sku: 'SH-100-Final Sale'}], {}],
    [[{id: 'a', deliveredDaysAgo: 3, sku: 'SH-100-Final Sale'}, {id: 'b', deliveredDaysAgo: 3}], {}],
    [[{id: 'a', deliveredDaysAgo: 3}], {exchange: true}],
    [[{id: 'a', deliveredDaysAgo: 3}], {blocked: true}],
    [[{id: 'a', deliveredDaysAgo: 3}], {blocked: true, exchange: true}],
  ];
  for (const [items, options] of cases) {
    const full = order(items, options);
    assert.equal(showReturnButton(full, NOW), evaluateOrder(full, NOW).show, JSON.stringify([items, options]));
  }
});

// Holiday window. Dates are local time, as in the customer's browser.
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

test('holiday window: bought Nov 15 to Dec 31, returnable until the end of Jan 31', () => {
  const returnBy = holidayReturnBy(local(2026, 12, 5).toISOString(), DEFAULT_POLICY);
  assert.deepEqual(returnBy, new Date(2027, 0, 31, 23, 59, 59, 999));
  assert.equal(holidayReturnBy(local(2026, 12, 31, 23).toISOString(), DEFAULT_POLICY)?.getFullYear(), 2027);
  assert.equal(holidayReturnBy(local(2026, 11, 14, 23).toISOString(), DEFAULT_POLICY), null);
  assert.equal(holidayReturnBy(local(2027, 1, 1, 0).toISOString(), DEFAULT_POLICY), null);
  assert.equal(holidayReturnBy(local(2026, 12, 5).toISOString(), {...DEFAULT_POLICY, holiday: false}), null);
});

test('holiday window: a range can cross the new year', () => {
  const policy = {...DEFAULT_POLICY, holidayStart: '12-15', holidayEnd: '01-05', holidayReturnBy: '01-31'};
  assert.deepEqual(holidayReturnBy(local(2027, 1, 3).toISOString(), policy), new Date(2027, 0, 31, 23, 59, 59, 999));
  assert.deepEqual(holidayReturnBy(local(2026, 12, 20).toISOString(), policy), new Date(2027, 0, 31, 23, 59, 59, 999));
  assert.equal(holidayReturnBy(local(2027, 1, 6).toISOString(), policy), null);
});

function holidayOrder(placed: Date, delivered: Date) {
  const base = order([{id: 'a', deliveredDaysAgo: 3}]);
  base.processedAt = placed.toISOString();
  base.fulfillments.nodes[0].events.nodes = [{status: 'DELIVERED', happenedAt: delivered.toISOString()}];
  return base;
}

test('holiday order: open until Jan 31, past its 30 days', () => {
  const o = holidayOrder(local(2026, 12, 2), local(2026, 12, 4));
  assert.equal(evaluateOrder(o, local(2027, 1, 31, 22), DEFAULT_POLICY).show, true);
  assert.equal(showReturnButton(o, local(2027, 1, 31, 22), DEFAULT_POLICY), true);
  assert.equal(evaluateOrder(o, local(2027, 2, 1, 0), DEFAULT_POLICY).items[0].status, 'window_expired');
  assert.equal(showReturnButton(o, local(2027, 2, 1, 0), DEFAULT_POLICY), false);
  assert.ok(evaluateOrder(o, local(2027, 1, 10), DEFAULT_POLICY).holidayReturnBy);
});

test('holiday order delivered late keeps its normal window when that ends later', () => {
  const o = holidayOrder(local(2026, 12, 23), local(2027, 1, 10));
  assert.equal(evaluateOrder(o, local(2027, 2, 5), DEFAULT_POLICY).show, true);
  assert.equal(evaluateOrder(o, local(2027, 2, 12), DEFAULT_POLICY).show, false);
});

test('windowDays from Policy rules sets the normal window', () => {
  const o = order([{id: 'a', deliveredDaysAgo: 40}]);
  assert.equal(evaluateOrder(o, NOW).show, false);
  assert.equal(evaluateOrder(o, NOW, {...DEFAULT_POLICY, windowDays: 45}).show, true);
  assert.equal(showReturnButton(o, NOW, {...DEFAULT_POLICY, windowDays: 45}), true);
});
