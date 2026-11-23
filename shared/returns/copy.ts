// Customer-facing copy that staff can edit in the admin (copy-editor extension).
//
// Defaults live in each extension's locales/en.default.json. Edits are saved
// as one JSON object in the shop metafield $app:copy, keyed by locale key
// ("policy.window"). A key that is missing or blank uses the default, so the
// locale files stay the source of truth for whoever supports the app later.

export const COPY_NAMESPACE = '$app';
export const COPY_KEY = 'copy';

export type CopyOverrides = Record<string, string>;

/** Policy bullets are edited as one text box, one bullet per line. */
export const POLICY_ITEMS_KEY = 'policy.items';
export const POLICY_BULLET_KEYS = [
  'policy.window',
  'policy.condition',
  'policy.timing',
];

/** Exchange steps, edited the same way: one step per line. */
export const EXCHANGE_STEPS_KEY = 'exchange.steps';
export const EXCHANGE_STEP_KEYS = ['exchange.step1', 'exchange.step2', 'exchange.step3', 'exchange.step4'];

/** Return steps, the same way. */
export const RETURN_STEPS_KEY = 'return.steps';
export const RETURN_STEP_KEYS = ['return.step1', 'return.step2', 'return.step3', 'return.step4'];

/** International return steps (customer ships the return), the same way. */
export const INTERNATIONAL_STEPS_KEY = 'international.steps';
export const INTERNATIONAL_STEP_KEYS = ['international.step1', 'international.step2', 'international.step3', 'international.step4'];

/** Editable lists: one text box in the editor, one locale key per default line. */
export const LIST_FIELDS: Record<string, string[]> = {
  [POLICY_ITEMS_KEY]: POLICY_BULLET_KEYS,
  [EXCHANGE_STEPS_KEY]: EXCHANGE_STEP_KEYS,
  [RETURN_STEPS_KEY]: RETURN_STEP_KEYS,
  [INTERNATIONAL_STEPS_KEY]: INTERNATIONAL_STEP_KEYS,
};

export type CopyGroup = 'ui' | 'policy';

export interface CopyField {
  key: string;
  label: string;
  /** Card the field sits in: the page or step where the customer sees it. */
  section: string;
  group: CopyGroup;
  /** Show a multi-line text box in the editor. */
  multiline?: boolean;
  /** {{variables}} the app fills in for this field: name -> what it shows. Listed below the field in the editor. */
  variables?: Record<string, string>;
}

// What each {{variable}} shows. Fees from Policy rules show even when that rule is off.
const ORDER_NUMBER = 'the order number, for example #1001.';
const RULE_FEES = {
  remoteFee: 'the return fee for the states in Policy rules (for example AK, HI).',
  returnWindow:
    'when to send the return, from Policy rules: "within 30 days after delivery", or "by January 31" on orders bought in the holiday window.',
};
const STEP_VARIABLES = {
  order: 'the order number, for example #1001.',
  name: ORDER_NUMBER,
  fee: 'the return fee in the estimate for this return.',
  ...RULE_FEES,
};

// Order here is the order in the editor: the customer's path through the flow.
export const COPY_FIELDS: CopyField[] = [
  {key: 'menu.button', label: 'Order page button', section: 'Order page', group: 'ui'},

  {key: 'page.heading', label: 'Page heading (step 1, loading, and errors)', section: 'All steps', group: 'ui'},
  {key: 'page.back', label: 'Back arrow (screen reader label)', section: 'All steps', group: 'ui'},
  {key: 'page.backToOrder', label: 'Back to order link', section: 'All steps', group: 'ui'},
  {key: 'page.loadError', label: 'Error: page did not load', section: 'All steps', group: 'ui'},
  {key: 'page.notReturnable', label: 'Order cannot be returned', section: 'All steps', group: 'ui'},
  {key: 'choose.error', label: 'Error: request not sent (both confirm screens)', section: 'All steps', group: 'ui'},

  {key: 'select.heading', label: 'Step 1 heading', section: 'Step 1: Select items', group: 'ui'},
  {key: 'select.help', label: 'Step 1 instructions', section: 'Step 1: Select items', group: 'ui'},
  {key: 'select.quantity', label: 'Quantity label', section: 'Step 1: Select items', group: 'ui'},
  {key: 'select.exchangeOrder', label: 'Notice on exchange orders', section: 'Step 1: Select items', group: 'ui', multiline: true},
  {key: 'locked.final_sale', label: 'Item locked: Final Sale', section: 'Step 1: Select items', group: 'ui'},
  {key: 'locked.not_delivered', label: 'Item locked: not delivered', section: 'Step 1: Select items', group: 'ui'},
  {key: 'locked.window_expired', label: 'Item locked: return window closed', section: 'Step 1: Select items', group: 'ui'},
  {key: 'locked.other', label: 'Item locked: other reason', section: 'Step 1: Select items', group: 'ui'},
  {key: 'cta.continue', label: 'Continue button', section: 'Step 1: Select items', group: 'ui'},

  {key: 'details.heading', label: 'Step 2 heading', section: 'Step 2: Tell us why', group: 'ui'},
  {key: 'details.oneSize', label: 'Size text when an item has no variant', section: 'Step 2: Tell us why', group: 'ui'},
  {key: 'details.reason', label: 'Reason field label', section: 'Step 2: Tell us why', group: 'ui'},
  {key: 'details.reasonPlaceholder', label: 'Reason field placeholder', section: 'Step 2: Tell us why', group: 'ui'},
  {key: 'details.reasonRequired', label: 'Error: no reason selected', section: 'Step 2: Tell us why', group: 'ui'},
  {key: 'details.note', label: 'Details field label', section: 'Step 2: Tell us why', group: 'ui'},
  {
    key: 'details.noteCount',
    label: 'Details field: character count',
    section: 'Step 2: Tell us why',
    group: 'ui',
    variables: {count: 'the number of characters the customer typed.', max: 'the most characters the field takes.'},
  },

  {key: 'choose.heading', label: 'Step 3 heading', section: 'Step 3: Return or exchange', group: 'ui'},
  {key: 'choose.exchangeHeading', label: 'Exchange card heading', section: 'Step 3: Return or exchange', group: 'ui'},
  {key: 'exchange.freeLabel', label: 'Exchange banner heading', section: 'Step 3: Return or exchange', group: 'ui'},
  {key: 'exchange.freeLabelNote', label: 'Exchange banner text', section: 'Step 3: Return or exchange', group: 'ui', multiline: true},
  {key: 'choose.exchangeCta', label: 'Continue with exchange button', section: 'Step 3: Return or exchange', group: 'ui'},
  {key: 'choose.or', label: 'Divider between exchange and return', section: 'Step 3: Return or exchange', group: 'ui'},
  {key: 'choose.returnHeading', label: 'Return card heading', section: 'Step 3: Return or exchange', group: 'ui'},
  {key: 'choose.returnCta', label: 'Continue with return button', section: 'Step 3: Return or exchange', group: 'ui'},

  {key: 'summary.calculating', label: 'Refund loading text', section: 'Refund estimate (step 3 and return confirm)', group: 'ui'},
  {key: 'summary.itemValue', label: 'Refund line: item value', section: 'Refund estimate (step 3 and return confirm)', group: 'ui'},
  {key: 'summary.tax', label: 'Refund line: tax', section: 'Refund estimate (step 3 and return confirm)', group: 'ui'},
  {key: 'summary.fee', label: 'Refund line: return fee', section: 'Refund estimate (step 3 and return confirm)', group: 'ui'},
  {key: 'summary.feeWaived', label: 'Refund line: no fee (store credit, confirm screen only)', section: 'Refund estimate (step 3 and return confirm)', group: 'ui'},
  {key: 'summary.restocking', label: 'Refund line: restocking fee', section: 'Refund estimate (step 3 and return confirm)', group: 'ui'},
  {key: 'summary.total', label: 'Refund line: total', section: 'Refund estimate (step 3 and return confirm)', group: 'ui'},
  {key: 'summary.totalCredit', label: 'Refund line: store credit total (confirm screen only)', section: 'Refund estimate (step 3 and return confirm)', group: 'ui'},

  {key: 'confirm.exchangeHeading', label: 'Page heading', section: 'Step 4: Confirm exchange', group: 'ui'},
  {key: 'exchange.stepsHeading', label: 'How exchanges work: heading', section: 'Step 4: Confirm exchange', group: 'ui'},
  {key: 'exchange.stepSubmit', label: 'How exchanges work: first step (shown before the request only)', section: 'Step 4: Confirm exchange', group: 'ui', multiline: true},
  {key: EXCHANGE_STEPS_KEY, label: 'How exchanges work: steps, one per line (also shown as Next steps)', section: 'Step 4: Confirm exchange', group: 'ui', multiline: true, variables: STEP_VARIABLES},
  {key: 'cta.exchange', label: 'Exchange button', section: 'Step 4: Confirm exchange', group: 'ui'},

  {key: 'confirm.returnHeading', label: 'Page heading', section: 'Step 4: Confirm return', group: 'ui'},
  {key: 'refund.label', label: 'Refund method label', section: 'Step 4: Confirm return', group: 'ui'},
  {key: 'refund.credit', label: 'Refund method: store credit', section: 'Step 4: Confirm return', group: 'ui'},
  {key: 'refund.card', label: 'Refund method: card', section: 'Step 4: Confirm return', group: 'ui'},
  {key: 'return.stepsHeading', label: 'How returns work: heading', section: 'Step 4: Confirm return', group: 'ui'},
  {key: 'return.stepSubmit', label: 'How returns work: first step (shown before the request only)', section: 'Step 4: Confirm return', group: 'ui', multiline: true},
  {key: RETURN_STEPS_KEY, label: 'How returns work: steps, one per line (also shown as Next steps)', section: 'Step 4: Confirm return', group: 'ui', multiline: true, variables: STEP_VARIABLES},
  {key: INTERNATIONAL_STEPS_KEY, label: 'How returns work, outside the US: steps, one per line (also shown as Next steps)', section: 'Step 4: Confirm return', group: 'ui', multiline: true, variables: STEP_VARIABLES},
  {key: 'cta.refund', label: 'Refund button', section: 'Step 4: Confirm return', group: 'ui'},
  {key: 'cta.storeCredit', label: 'Store credit button', section: 'Step 4: Confirm return', group: 'ui'},

  {key: 'done.heading', label: 'Return sent: heading', section: 'Confirmation', group: 'ui'},
  {key: 'done.body', label: 'Return sent: message', section: 'Confirmation', group: 'ui', variables: {name: ORDER_NUMBER}},
  {key: 'done.exchangeHeading', label: 'Exchange sent: heading', section: 'Confirmation', group: 'ui'},
  {key: 'done.exchangeBody', label: 'Exchange sent: message', section: 'Confirmation', group: 'ui', variables: {name: ORDER_NUMBER}},
  {key: 'done.nextHeading', label: 'Next steps heading', section: 'Confirmation', group: 'ui'},
  {key: 'exchange.shopLatest', label: 'Shop latest button', section: 'Confirmation', group: 'ui'},

  {key: 'policy.heading', label: 'Policy heading', section: 'Return policy', group: 'policy'},
  {
    key: POLICY_ITEMS_KEY,
    label: 'Policy bullets (one per line)',
    section: 'Return policy',
    group: 'policy',
    multiline: true,
    variables: {fee: "the standard return fee, from Shopify's return rules.", ...RULE_FEES},
  },
  {key: 'policy.link', label: 'Full policy link', section: 'Return policy', group: 'policy'},
  {key: 'policy.agree', label: 'Agreement checkbox', section: 'Agreement checkbox', group: 'policy', multiline: true},
  {key: 'policy.agreeRequired', label: 'Error: agreement not checked', section: 'Agreement checkbox', group: 'policy'},
];

/** Reads the metafield value. Bad or missing JSON means "no edits". */
export function parseCopy(value: string | null | undefined): CopyOverrides {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: CopyOverrides = {};
    for (const [key, text] of Object.entries(parsed)) {
      if (typeof text === 'string' && text.trim()) out[key] = text;
    }
    return out;
  } catch {
    return {};
  }
}

/** Fills {{name}} placeholders the same way shopify.i18n.translate does. */
export function interpolate(text: string, values: Record<string, unknown> = {}): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
    name in values ? String(values[name]) : match,
  );
}

/** Placeholders in a default, e.g. ["fee"]. An edit must keep all of them. */
export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];
}

export function missingPlaceholders(defaultText: string, edited: string): string[] {
  const kept = new Set(placeholdersIn(edited));
  return placeholdersIn(defaultText).filter((name) => !kept.has(name));
}

/** An editable list: the edited lines if there are any, otherwise the defaults. */
export function listLines(overrides: CopyOverrides, key: string, defaults: string[]): string[] {
  const edited = overrides[key]
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return edited?.length ? edited : defaults;
}

export const policyLines = (overrides: CopyOverrides, defaults: string[]) =>
  listLines(overrides, POLICY_ITEMS_KEY, defaults);
