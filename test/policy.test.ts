import {test} from 'node:test';
import assert from 'node:assert/strict';

import {evaluateOrder, returnFees, type OrderReturnData} from '../shared/returns/eligibility.ts';
import {DEFAULT_POLICY, holidayDates, parseEmails, parsePolicy, parseZones, testModeAllows, toDraft, toPolicy} from '../shared/returns/policy.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

function order({
  sku = 'SKU-1',
  delivered = 3,
  zone = 'OR',
  country = 'US',
}: {sku?: string; delivered?: number; zone?: string; country?: string} = {}): OrderReturnData {
  return {
    id: 'gid://shopify/Order/1',
    name: '#1001',
    processedAt: daysAgo(30),
    exchangeOrder: null,
    noReturns: null,
    shippingAddress: {zoneCode: zone, territoryCode: country},
    fulfillments: {
      nodes: [
        {
          events: {nodes: [{status: 'DELIVERED', happenedAt: daysAgo(delivered)}]},
          fulfillmentLineItems: {nodes: [{lineItem: {id: 'a'}}]},
        },
      ],
    },
    returnInformation: {
      hasReturnShippingFee: true,
      nonReturnableSummary: null,
      returnableLineItems: {
        nodes: [
          {
            quantity: 1,
            lineItem: {id: 'a', title: 'Shoe', variantTitle: null, sku, vendor: null, productType: null, image: null, suggestedReturnReasonDefinitions: null},
          },
        ],
      },
      nonReturnableLineItems: {nodes: []},
    },
  };
}

test('parsePolicy: missing or bad JSON gives the defaults', () => {
  assert.deepEqual(parsePolicy(null), DEFAULT_POLICY);
  assert.deepEqual(parsePolicy('not json'), DEFAULT_POLICY);
  assert.deepEqual(parsePolicy('[1]'), DEFAULT_POLICY);
});

test('parsePolicy: keeps good settings, drops bad ones one by one', () => {
  const policy = parsePolicy(JSON.stringify({remoteFee: 50, windowDays: -1, remote: 'yes', remoteZones: []}));
  assert.equal(policy.remoteFee, 50);
  assert.equal(policy.windowDays, DEFAULT_POLICY.windowDays);
  assert.equal(policy.remote, true);
  assert.deepEqual(policy.remoteZones, ['AK', 'HI']);
});

test('draft round trip keeps the policy', () => {
  const {policy, errors} = toPolicy(toDraft(DEFAULT_POLICY));
  assert.deepEqual(errors, {});
  assert.deepEqual(policy, DEFAULT_POLICY);
});

test('toPolicy: errors for bad numbers, zones, and empty SKU text', () => {
  const draft = {...toDraft(DEFAULT_POLICY), remoteFee: '', remoteZones: 'Puerto Rico', finalSaleText: ' '};
  const {errors} = toPolicy(draft);
  assert.deepEqual(Object.keys(errors).sort(), ['finalSaleText', 'remoteFee', 'remoteZones']);
  assert.ok(toPolicy({...toDraft(DEFAULT_POLICY), remoteFee: '-5'}).errors.remoteFee);
});

test('parseZones: upper case, commas or spaces, no repeats', () => {
  assert.deepEqual(parseZones('ak, hi  PR,ak'), ['AK', 'HI', 'PR']);
});

test('final sale SKU: custom text, and the rule turned off', () => {
  const custom = {...DEFAULT_POLICY, finalSaleText: 'Clearance Item'};
  assert.equal(evaluateOrder(order({sku: 'X-clearanceitem'}), NOW, custom).items[0].status, 'final_sale');
  assert.equal(evaluateOrder(order({sku: 'X-Final Sale'}), NOW, custom).items[0].status, 'eligible');
  assert.equal(evaluateOrder(order({sku: 'X-Final Sale'}), NOW, {...DEFAULT_POLICY, finalSaleSku: false}).show, true);
});

test('allowExchange follows exchanges, remote, and international', () => {
  assert.equal(evaluateOrder(order(), NOW).allowExchange, true);
  assert.equal(evaluateOrder(order(), NOW, {...DEFAULT_POLICY, exchanges: false}).allowExchange, false);
  assert.equal(evaluateOrder(order({zone: 'HI'}), NOW).allowExchange, false);
  assert.equal(evaluateOrder(order({country: 'CA', zone: 'ON'}), NOW).allowExchange, false);
});

test('remote states: exchanges follow their own switch', () => {
  assert.equal(evaluateOrder(order({zone: 'AK'}), NOW).allowExchange, false);
  const on = {...DEFAULT_POLICY, remoteExchanges: true};
  const result = evaluateOrder(order({zone: 'AK'}), NOW, on);
  assert.equal(result.allowExchange, true);
  assert.deepEqual(returnFees(result, null, on), {fee: 20, creditFee: 20});
  assert.equal(evaluateOrder(order({zone: 'AK'}), NOW, {...on, exchanges: false}).allowExchange, false);
});

test('store credit: no fee, except returns on exchange orders', () => {
  const ca = evaluateOrder(order({country: 'CA', zone: 'ON'}), NOW);
  assert.deepEqual(returnFees(ca, 15), {fee: 15, creditFee: 0});
  assert.deepEqual(returnFees(evaluateOrder(order(), NOW), 25), {fee: 25, creditFee: 0});
  const exchangeOrder = {...evaluateOrder(order(), NOW), isExchangeOrder: true};
  assert.deepEqual(returnFees(exchangeOrder, 25), {fee: 25, creditFee: 25});
});

test('rules turned off: the order follows the US rules', () => {
  const off = {...DEFAULT_POLICY, remote: false, international: false};
  for (const spec of [{zone: 'AK'}, {country: 'CA', zone: 'ON'}]) {
    const result = evaluateOrder(order(spec), NOW, off);
    assert.equal(result.remoteShipping || result.international, false);
    assert.equal(result.allowExchange, true);
    assert.deepEqual(returnFees(result, null, off), {fee: 10, creditFee: 0});
  }
});

test('remote zones and fees come from the policy', () => {
  const policy = {...DEFAULT_POLICY, remoteZones: ['PR'], remoteFee: 55, storeCreditNoFee: false};
  const pr = evaluateOrder(order({zone: 'PR'}), NOW, policy);
  assert.equal(pr.remoteShipping, true);
  assert.deepEqual(returnFees(pr, null, policy), {fee: 55, creditFee: 55});
  const ak = evaluateOrder(order({zone: 'AK'}), NOW, policy);
  assert.equal(ak.remoteShipping, false);
  assert.deepEqual(returnFees(ak, 20, policy), {fee: 20, creditFee: 20});
});

test('test mode: off lets everyone in; on, only listed emails', () => {
  assert.equal(testModeAllows(DEFAULT_POLICY, null), true);
  const on = {testMode: true, testEmails: ['info@example.com', 'staff@example.com']};
  assert.equal(testModeAllows(on, 'INFO@example.com '), true);
  assert.equal(testModeAllows(on, 'someone@example.com'), false);
  // No email (no access to it, or the query failed): hidden.
  assert.equal(testModeAllows(on, null), false);
  assert.equal(testModeAllows({testMode: true, testEmails: []}, 'info@example.com'), false);
});

test('test mode: emails parse, save, and validate', () => {
  assert.deepEqual(parseEmails('Info@example.com, staff@example.com\ninfo@example.com'), ['info@example.com', 'staff@example.com']);
  const policy = parsePolicy(JSON.stringify({testMode: true, testEmails: ['A@Example.com', 7]}));
  assert.equal(policy.testMode, true);
  assert.deepEqual(policy.testEmails, ['a@example.com']);
  assert.deepEqual(parsePolicy('{}').testEmails, []);

  const draft = toDraft(DEFAULT_POLICY);
  assert.equal(toPolicy({...draft, testMode: true, testEmails: ''}).errors.testEmails, 'Enter one or more emails, or turn off test mode.');
  assert.ok(toPolicy({...draft, testEmails: 'not-an-email'}).errors.testEmails);
  const saved = toPolicy({...draft, testMode: true, testEmails: 'info@example.com, staff@example.com'});
  assert.deepEqual(saved.errors, {});
  assert.deepEqual(saved.policy.testEmails, ['info@example.com', 'staff@example.com']);
  assert.equal(toDraft(saved.policy).testEmails, 'info@example.com, staff@example.com');
});

test('holiday dates: month and day saved, this season shown in the form', () => {
  assert.deepEqual(holidayDates(DEFAULT_POLICY, new Date(2026, 10, 16)), {
    holidayStart: '2026-11-15',
    holidayEnd: '2026-12-31',
    holidayReturnBy: '2027-01-31',
  });
  // In January, until the return date, the season that started last year.
  assert.equal(holidayDates(DEFAULT_POLICY, new Date(2027, 0, 10)).holidayStart, '2026-11-15');
  assert.equal(holidayDates(DEFAULT_POLICY, new Date(2027, 1, 10)).holidayStart, '2027-11-15');
  const draft = {...toDraft(DEFAULT_POLICY), holidayReturnBy: '2027-01-20', windowDays: '45'};
  const {policy, errors} = toPolicy(draft);
  assert.deepEqual(errors, {});
  assert.equal(policy.holidayReturnBy, '01-20');
  assert.equal(policy.windowDays, 45);
});

test('toPolicy: errors for a bad window and a missing date', () => {
  const {errors} = toPolicy({...toDraft(DEFAULT_POLICY), windowDays: '0', holidayStart: ''});
  assert.deepEqual(Object.keys(errors).sort(), ['holidayStart', 'windowDays']);
  assert.equal(parsePolicy(JSON.stringify({windowDays: 2.5, holidayEnd: '02-30'})).windowDays, 30);
  assert.equal(parsePolicy(JSON.stringify({holidayEnd: '02-30'})).holidayEnd, '12-31');
});
