// Home > Test list: one check per order type and outcome, for the team to tick
// off while testing on a development store. Checks save to shop metafield $app:testing
// (json, {"<id>": "YYYY-MM-DD"}), so every staff member sees the same list.
// Keep each id stable: a renamed id loses its check. Letters are the seed
// scenarios in scripts/seed-returns.mjs; each seed order note names its letter.

export const TESTING_NAMESPACE = '$app';
export const TESTING_KEY = 'testing';

export interface TestCase {
  id: string;
  /** What to do. */
  title: string;
  /** What you must see. */
  expect: string;
}

export interface TestGroup {
  heading: string;
  intro?: string;
  cases: TestCase[];
}

/** Check id -> date checked (YYYY-MM-DD). */
export type TestChecks = Record<string, string>;

export function parseChecks(value: string | null | undefined): TestChecks {
  try {
    const parsed = value ? JSON.parse(value) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, date]) => typeof date === 'string')) as TestChecks;
  } catch {
    return {};
  }
}

export const TEST_GROUPS: TestGroup[] = [
  {
    heading: 'Before you start',
    cases: [
      {
        id: 'setup-seed',
        title: 'Make a fresh set of test orders.',
        expect: 'A developer runs the seed script with a new batch number. The note on each order names its letter, for example "Seed scenario N".',
      },
      {
        id: 'setup-flows',
        title: 'Open Flow. Make sure workflows 1, 2, and 3 are on.',
        expect: 'Workflow 1 looks for "[EXCHANGE]". Workflow 3 looks for "[STORE CREDIT]". See the Flow workflows tab.',
      },
      {
        id: 'setup-test-mode',
        title: 'Add your email to Test mode in Policy rules.',
        expect: 'Log in to customer accounts with that email. The seed orders belong to that customer.',
      },
      {
        id: 'setup-refresh',
        title: 'Hard refresh customer accounts before each test.',
        expect: 'On the Tell us why step, the details count shows "of 252 characters". If it does not, the old code loaded.',
      },
    ],
  },
  {
    heading: 'Who sees Start return',
    intro: 'Open each order in customer accounts. Do not send a request.',
    cases: [
      {id: 'button-a', title: 'Order A: delivered 3 days ago.', expect: 'Start return shows.'},
      {id: 'button-b', title: 'Order B: delivered 29 days ago.', expect: 'Start return shows (last day but one).'},
      {id: 'button-c', title: 'Order C: delivered 31 days ago.', expect: 'Start return does not show. The customer must contact you.'},
      {id: 'button-d', title: 'Order D: shipped, not delivered.', expect: 'Start return does not show.'},
      {id: 'button-m', title: 'Order M: not shipped.', expect: 'Start return does not show.'},
      {id: 'button-g', title: 'Order G: Final Sale SKU and a sale item only.', expect: 'Start return does not show.'},
      {
        id: 'button-h',
        title: 'Order H: Final Sale SKU and a full-price item.',
        expect: 'Start return shows. On Select items, the boot is grey with the final sale reason.',
      },
      {
        id: 'button-i',
        title: 'Order I: sale item and a full-price item.',
        expect: 'Start return shows. On Select items, the socks are grey: they have a compare-at price, so they are in the Final Sale collection.',
      },
      {
        id: 'button-l',
        title: 'Order L: two deliveries, one 40 days ago.',
        expect: 'Start return shows. The boot is grey because its return window is over.',
      },
      {id: 'button-k', title: 'Order K: No Returns is on for the order (metafield).', expect: 'Start return does not show.'},
      {
        id: 'button-customer-block',
        title: 'Turn on No Returns for the test customer (metafield). Open order A.',
        expect: 'Start return does not show. Turn No Returns off again.',
      },
      {
        id: 'button-test-mode',
        title: 'Remove your email from Test mode. Open order A.',
        expect: 'Start return does not show. Add your email again.',
      },
    ],
  },
  {
    heading: 'Standard returns',
    intro: 'For each one: send the request, then open the order in admin and read the note on the first item.',
    cases: [
      {
        id: 'return-card',
        title: 'Order N: return to the original payment method.',
        expect: 'Estimate shows the $10 fee from the return rules. First item note starts "[FEE $10]".',
      },
      {
        id: 'return-credit',
        title: 'Order S: return for store credit.',
        expect: 'Store credit is selected by default. Estimate shows no fee. Note starts "[STORE CREDIT] [FEE $0]". The order has Store Credit Requested on.',
      },
      {
        id: 'return-two-items',
        title: 'Order P: return both items, with a different reason for each.',
        expect: 'Each item shows its own reasons. Only the first item note has the [FEE ...] marker.',
      },
      {
        id: 'return-quantity',
        title: 'Order Q: return 1 of the 2 boots.',
        expect: 'The quantity picker shows. The return has quantity 1.',
      },
      {
        id: 'return-tax',
        title: 'Order T: return both items (New York tax).',
        expect: 'The estimate includes the tax. It matches the refund amount in admin.',
      },
      {
        id: 'return-details-limit',
        title: 'On any order, type more than 252 characters in details.',
        expect: 'The field stops at 252. The full text shows in the note in admin.',
      },
    ],
  },
  {
    heading: 'Exchanges',
    cases: [
      {
        id: 'exchange-request',
        title: 'Order O: select Request an exchange and send it.',
        expect: 'Exchange shows a free label. Note starts "[EXCHANGE] [FEE $0]". The order has Exchange Requested on.',
      },
      {
        id: 'exchange-new-order',
        title: 'On the confirmation, select Shop latest and place a new order.',
        expect: 'The new order has the attribute "Exchange for", the note "Exchange #...", the tag exchange, and Exchange Order on.',
      },
      {
        id: 'exchange-typed-note',
        title: 'Place an order without Shop latest. Type "Exchange #" and an order number in the note.',
        expect: 'The order is not marked. Exchange Order stays off.',
      },
      {
        id: 'exchange-order-return',
        title: 'Return an item from the new exchange order (or order AA).',
        expect: 'No exchange choice. Refund note starts "[FEE $10 EXCHANGE ORDER]". Store credit also shows the $10 fee.',
      },
      {
        id: 'store-credit-order-full',
        title: 'Pay a new order fully with store credit.',
        expect: 'The order has the tag store-credit and Exchange Order on. A return on it offers no exchange and shows the fee on store credit.',
      },
      {
        id: 'store-credit-order-part',
        title: 'Pay a new order partly with store credit and partly by card.',
        expect: 'The order has the tag store-credit. Exchange Order stays off.',
      },
    ],
  },
  {
    heading: 'Remote states',
    intro: 'The seed orders use AK and HI, the default states in Policy rules.',
    cases: [
      {
        id: 'remote-ak',
        title: 'Order R (AK): return to the original payment method.',
        expect: 'No exchange choice. Estimate shows $20. Note starts "[FEE $20 AK/HI]".',
      },
      {
        id: 'remote-ak-credit',
        title: 'Order R, or a fresh AK order: return for store credit.',
        expect: 'Store credit also shows $20. Note starts "[STORE CREDIT] [FEE $20 AK/HI]".',
      },
      {
        id: 'remote-hi',
        title: 'Order Y (HI): return the jacket.',
        expect: 'Same as order R: no exchange, $20 fee on refund and store credit.',
      },
      {
        id: 'remote-exchanges-on',
        title: 'Turn on "Offer exchanges to these states" in Policy rules. Open a fresh AK order.',
        expect: 'The exchange choice shows. Turn the switch off again.',
      },
    ],
  },
  {
    heading: 'Outside the US',
    cases: [
      {
        id: 'intl-canada',
        title: 'Order U (Ontario): send a return.',
        expect: 'No exchange. Next steps say to ship it yourself, with "Returned Goods" on the customs form. Note has "INTERNATIONAL" in the fee marker.',
      },
      {
        id: 'intl-two-items',
        title: 'Order V (British Columbia): return both items.',
        expect: 'Same as order U. Only the first item note has the fee marker.',
      },
    ],
  },
  {
    heading: 'Staff steps in admin',
    intro: 'Do these on the returns you sent above.',
    cases: [
      {
        id: 'staff-fee',
        title: 'Review return request: change Return shipping to the [FEE ...] amount, upload a label with tracking, then approve.',
        expect: 'The approved email shows the changed fee, the return steps, and a Print return label button.',
      },
      {
        id: 'staff-no-shipping',
        title: 'Approve order U with No shipping required.',
        expect: 'The approved email shows the send-it-yourself steps and your return address. No label email goes out.',
      },
      {
        id: 'staff-refund-credit',
        title: 'Refund a store credit return to store credit.',
        expect: 'The customer\'s store credit balance goes up by the refund amount.',
      },
      {
        id: 'staff-refund-card',
        title: 'Refund a card return.',
        expect: 'The refund is the item price minus the fee on the return.',
      },
      {
        id: 'staff-exchange',
        title: 'Process the exchange from order O.',
        expect: 'Return shipping $0, upload the label, approve. Refund the returned item in full when it arrives.',
      },
      {
        id: 'staff-decline',
        title: 'Decline a return request. Select a reason, then Customize, and write a message.',
        expect: 'The declined email shows your message and "Do not send the items."',
      },
      {
        id: 'staff-decline-again',
        title: 'After the decline, open that order in customer accounts.',
        expect: 'Write down if Start return shows again. It should, while the return window is open.',
      },
      {
        id: 'staff-decline-block',
        title: 'Turn on No Returns on that order.',
        expect: 'Start return does not show on that order.',
      },
    ],
  },
  {
    heading: 'Emails',
    intro: 'Test these after the new email templates are in Notifications.',
    cases: [
      {id: 'email-return', title: 'Approve a standard return.', expect: 'The email uses the return text and shows the fee.'},
      {id: 'email-credit', title: 'Approve a store credit return.', expect: 'The email says store credit, not a refund to the card.'},
      {id: 'email-exchange', title: 'Approve an exchange.', expect: 'The email uses the exchange text and shows no fee.'},
      {id: 'email-received', title: 'Send any return request.', expect: 'The received email shows the order number and says not to send the items yet.'},
      {id: 'email-intl', title: 'Approve order U with No shipping required.', expect: 'The email shows the send-it-yourself steps and your return address.'},
      {id: 'email-refund-credit', title: 'Refund a store credit return.', expect: 'The refund email says the store credit is ready to use now.'},
    ],
  },
  {
    heading: 'Settings',
    cases: [
      {
        id: 'settings-copy',
        title: 'Change one line in UI copy. Save. Open a return in customer accounts.',
        expect: 'The return page shows the new text. Change it back.',
      },
      {
        id: 'settings-policy',
        title: 'Change the remote states fee in Policy rules. Save. Open order R.',
        expect: 'The estimate and the Order rules tab show the new fee. Change it back.',
      },
      {
        id: 'settings-exchanges-off',
        title: 'Turn off Exchanges in Policy rules. Open order A.',
        expect: 'No exchange choice. Turn Exchanges on again.',
      },
    ],
  },
];
