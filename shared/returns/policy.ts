// The store's return rules as settings staff edit in the admin (Settings > Policy rules).
//
// Saved as one JSON object in the shop metafield $app:policy. The return page
// and the order button read it through the Customer Account API. A missing or
// bad value uses the default, so a store that never saves keeps the rules below.
// Pure functions only: this file runs under `node --test`.
//
// The return window is here: Shopify's return rules count days from delivery
// only, so they cannot end on a date (the holiday window). Set Shopify's window
// to match windowDays, or longer, and the app enforces the holiday end date.
// Shopify locks the window in when the order is placed, so each order keeps the
// window it was bought with.
// The standard return fee is NOT here: Shopify's return rules own it.

export const POLICY_NAMESPACE = '$app';
export const POLICY_KEY = 'policy';

export interface ReturnPolicy {
  /** Days after delivery that an item can be returned. Shopify's return window must be longer. */
  windowDays: number;
  /**
   * Holiday window: items bought from holidayStart to holidayEnd can be returned until
   * holidayReturnBy, or until the normal window ends if that is later. Month and day
   * ("12-01"), so the rule repeats every year. Dates are the customer's own time zone.
   */
  holiday: boolean;
  holidayStart: string;
  holidayEnd: string;
  holidayReturnBy: string;
  /** Store credit has no return fee, except on exchange orders. */
  storeCreditNoFee: boolean;
  /** Offer exchanges at all. Off: every customer goes straight to a return. */
  exchanges: boolean;
  /** A SKU that contains finalSaleText makes the item final sale. */
  finalSaleSku: boolean;
  finalSaleText: string;
  /**
   * Some states cost more to ship from (remoteZones). Shopify return rules can't set a fee
   * by state, so the app shows this fee and staff change the fee on the return by hand.
   * Applies to store credit too.
   */
  remote: boolean;
  remoteFee: number;
  /** Offer exchanges to these states. Off by default. */
  remoteExchanges: boolean;
  /** US state codes (shippingAddress.zoneCode). */
  remoteZones: string[];
  /** Outside the US: the customer ships the return, no exchange, fees only from the market's return rules. */
  international: boolean;
  /**
   * Test mode: only customers whose email is in testEmails see "Start return".
   * For trying the app on the live store before launch. Not a security control:
   * the list is readable through the Customer Account API.
   */
  testMode: boolean;
  /** Lower case. */
  testEmails: string[];
}

export const DEFAULT_POLICY: ReturnPolicy = {
  windowDays: 30,
  holiday: true,
  holidayStart: '11-15',
  holidayEnd: '12-31',
  holidayReturnBy: '01-31',
  storeCreditNoFee: true,
  exchanges: true,
  finalSaleSku: true,
  finalSaleText: 'Final Sale',
  remote: true,
  remoteFee: 20,
  remoteExchanges: false,
  remoteZones: ['AK', 'HI'],
  international: true,
  testMode: false,
  testEmails: [],
};

const isFee = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isDays = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 365;

/** "MM-DD" that exists in a leap year (02-29 is allowed). */
export function isMonthDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}-\d{2}$/.test(value)) return false;
  const [month, day] = value.split('-').map(Number);
  const date = new Date(2024, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day;
}

/** Reads the metafield value. Each bad or missing setting uses its default. */
export function parsePolicy(value: string | null | undefined): ReturnPolicy {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = value ? JSON.parse(value) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed;
  } catch {
    // Bad JSON: all defaults.
  }
  const pick = <K extends keyof ReturnPolicy>(key: K, valid: (value: unknown) => boolean): ReturnPolicy[K] =>
    valid(raw[key]) ? (raw[key] as ReturnPolicy[K]) : DEFAULT_POLICY[key];
  const isBool = (value: unknown) => typeof value === 'boolean';
  const isText = (value: unknown) => typeof value === 'string' && value.trim() !== '';

  return {
    windowDays: pick('windowDays', isDays),
    holiday: pick('holiday', isBool),
    holidayStart: pick('holidayStart', isMonthDay),
    holidayEnd: pick('holidayEnd', isMonthDay),
    holidayReturnBy: pick('holidayReturnBy', isMonthDay),
    storeCreditNoFee: pick('storeCreditNoFee', isBool),
    exchanges: pick('exchanges', isBool),
    finalSaleSku: pick('finalSaleSku', isBool),
    finalSaleText: pick('finalSaleText', isText),
    remote: pick('remote', isBool),
    remoteFee: pick('remoteFee', isFee),
    remoteExchanges: pick('remoteExchanges', isBool),
    remoteZones: pick(
      'remoteZones',
      (value) => Array.isArray(value) && value.length > 0 && value.every((zone) => typeof zone === 'string'),
    ),
    international: pick('international', isBool),
    testMode: pick('testMode', isBool),
    testEmails: Array.isArray(raw.testEmails)
      ? parseEmails(raw.testEmails.filter((email) => typeof email === 'string').join(','))
      : DEFAULT_POLICY.testEmails,
  };
}

/** Commas, spaces, or new lines between emails. Lower case, no duplicates. */
export function parseEmails(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Test mode off: everyone. On: only the listed emails. A missing email (no access
 * to it, or the query failed) is not on the list, so the button stays hidden.
 */
export function testModeAllows(policy: Pick<ReturnPolicy, 'testMode' | 'testEmails'>, email: string | null | undefined): boolean {
  if (!policy.testMode) return true;
  return !!email && policy.testEmails.includes(email.trim().toLowerCase());
}

/** Case-insensitive; a space matches any spacing or none. */
export function finalSalePattern(text: string): RegExp {
  const escaped = text
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s*');
  return new RegExp(escaped, 'i');
}

// ---- Admin form ----
// The form keeps every field as typed (numbers and the state list as text), so a
// half-typed value does not jump. toPolicy turns it back into a policy, or errors.

export type PolicyDraft = {
  [K in keyof ReturnPolicy]: ReturnPolicy[K] extends boolean ? boolean : string;
};

/**
 * The holiday dates as full dates for the date fields: this season's dates. From
 * January 1 until the return date, "this season" is the one that started last year.
 */
export function holidayDates(policy: ReturnPolicy, now = new Date()) {
  const md = (value: string) => value.split('-').map(Number) as [number, number];
  const [startMonth, startDay] = md(policy.holidayStart);
  const [byMonth, byDay] = md(policy.holidayReturnBy);
  const endWraps = policy.holidayEnd < policy.holidayStart;
  const byWraps = policy.holidayReturnBy < policy.holidayStart;
  let year = now.getFullYear();
  const thisStart = new Date(year, startMonth - 1, startDay);
  if (now < thisStart && byWraps && now <= new Date(year, byMonth - 1, byDay, 23, 59, 59)) year -= 1;
  const iso = (y: number, value: string) => `${y}-${value}`;
  return {
    holidayStart: iso(year, policy.holidayStart),
    holidayEnd: iso(endWraps ? year + 1 : year, policy.holidayEnd),
    holidayReturnBy: iso(byWraps ? year + 1 : year, policy.holidayReturnBy),
  };
}

export function toDraft(policy: ReturnPolicy, now = new Date()): PolicyDraft {
  return {
    ...policy,
    ...holidayDates(policy, now),
    windowDays: String(policy.windowDays),
    remoteFee: String(policy.remoteFee),
    remoteZones: policy.remoteZones.join(', '),
    testEmails: policy.testEmails.join(', '),
  };
}

export function parseZones(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).map((zone) => zone.trim().toUpperCase()).filter(Boolean))];
}

export function toPolicy(draft: PolicyDraft): {policy: ReturnPolicy; errors: Partial<Record<keyof ReturnPolicy, string>>} {
  const errors: Partial<Record<keyof ReturnPolicy, string>> = {};
  const fee = (key: 'remoteFee') => {
    const value = Number(draft[key]);
    if (draft[key].trim() === '' || !isFee(value)) errors[key] = 'Enter an amount of 0 or more.';
    return value;
  };
  const windowDays = Number(draft.windowDays);
  if (!isDays(windowDays)) errors.windowDays = 'Enter a whole number of days from 1 to 365.';
  // The date fields give YYYY-MM-DD; only the month and day are kept.
  const monthDay = (key: 'holidayStart' | 'holidayEnd' | 'holidayReturnBy') => {
    const value = /^\d{4}-(\d{2}-\d{2})$/.exec(draft[key])?.[1] ?? '';
    if (!isMonthDay(value)) errors[key] = 'Select a date.';
    return value;
  };
  const holidayStart = monthDay('holidayStart');
  const holidayEnd = monthDay('holidayEnd');
  const holidayReturnBy = monthDay('holidayReturnBy');
  const remoteZones = parseZones(draft.remoteZones);
  if (remoteZones.length === 0) errors.remoteZones = 'Enter one or more state codes, for example AK, HI.';
  else if (remoteZones.some((zone) => !/^[A-Z]{2}$/.test(zone))) errors.remoteZones = 'Use two-letter state codes, for example AK, HI.';
  if (draft.finalSaleText.trim() === '') errors.finalSaleText = 'Enter the text to look for in the SKU.';
  const testEmails = parseEmails(draft.testEmails);
  if (testEmails.some((email) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    errors.testEmails = 'Enter full email addresses, for example info@example.com.';
  } else if (draft.testMode && testEmails.length === 0) {
    errors.testEmails = 'Enter one or more emails, or turn off test mode.';
  }

  const policy: ReturnPolicy = {
    ...draft,
    windowDays,
    holidayStart,
    holidayEnd,
    holidayReturnBy,
    remoteFee: fee('remoteFee'),
    remoteZones,
    finalSaleText: draft.finalSaleText.trim(),
    testEmails,
  };
  return {policy, errors};
}
