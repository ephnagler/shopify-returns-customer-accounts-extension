import type {PolicyDraft, ReturnPolicy} from '../../../../shared/returns/policy.ts';

// Settings > Policy rules: one card per rule. Order: return window, exchanges, store credit,
// final sale, remote states, outside the US, test mode. The return window
// goes first: every other rule applies inside it.
// Each field has value (the draft) and defaultValue/defaultChecked (the saved
// setting), so s-form shows the save bar while they differ.

type Errors = Partial<Record<keyof ReturnPolicy, string>>;
type BoolKey = {[K in keyof PolicyDraft]: PolicyDraft[K] extends boolean ? K : never}[keyof PolicyDraft];
type TextKey = Exclude<keyof PolicyDraft, BoolKey>;

export default function PolicyRules({
  draft,
  saved,
  errors,
  onChange,
}: {
  draft: PolicyDraft;
  saved: PolicyDraft;
  errors: Errors;
  onChange: (change: Partial<PolicyDraft>) => void;
}) {
  const toggle = (key: BoolKey, label: string, details?: string) => (
    <s-switch
      label={label}
      details={details}
      name={key}
      checked={draft[key]}
      defaultChecked={saved[key]}
      onChange={(event: any) => onChange({[key]: event.currentTarget.checked})}
    />
  );
  const amount = (key: TextKey, label: string, details?: string, disabled?: boolean) => (
    <s-number-field
      label={label}
      details={details}
      name={key}
      value={draft[key]}
      defaultValue={saved[key]}
      prefix="$"
      inputMode="decimal"
      step={0.01}
      min={0}
      disabled={disabled}
      error={errors[key as keyof ReturnPolicy]}
      onInput={(event: any) => onChange({[key]: event.currentTarget.value})}
    />
  );
  const text = (key: TextKey, label: string, details?: string, disabled?: boolean) => (
    <s-text-field
      label={label}
      details={details}
      name={key}
      value={draft[key]}
      defaultValue={saved[key]}
      disabled={disabled}
      error={errors[key as keyof ReturnPolicy]}
      onInput={(event: any) => onChange({[key]: event.currentTarget.value})}
    />
  );

  // Holiday orders need a longer window in Shopify, which keeps the window each order was
  // bought with: from the first holiday day to the return date (Nov 15 to Jan 31 = 77 days).
  const day = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) : NaN);
  const longDate = (iso: string) =>
    new Date(day(iso)).toLocaleDateString('en-US', {month: 'long', day: 'numeric', timeZone: 'UTC'});
  const holidayDays = Math.round((day(draft.holidayReturnBy) - day(draft.holidayStart)) / 86_400_000);
  const dayAfterEnd = new Date(day(draft.holidayEnd) + 86_400_000).toISOString().slice(0, 10);
  const shopifySwitch =
    holidayDays > 0 && !Number.isNaN(day(draft.holidayEnd))
      ? `On ${longDate(draft.holidayStart)}, set Shopify's return window to ${holidayDays} days. On ${longDate(dayAfterEnd)}, set it back to ${draft.windowDays} days.`
      : '';

  const date = (key: 'holidayStart' | 'holidayEnd' | 'holidayReturnBy', label: string, details?: string) => (
    <s-date-field
      label={label}
      details={details}
      name={key}
      value={draft[key]}
      defaultValue={saved[key]}
      disabled={!draft.holiday}
      error={errors[key]}
      onChange={(event: any) => onChange({[key]: event.currentTarget.value})}
    />
  );

  return (
    <s-stack gap="base">
      <s-section heading="Return window">
        <s-stack gap="base">
          <s-number-field
            label="Days after delivery"
            details="Customers can request a return for this many days after the item is delivered. Use the same number in Shopify's return rules."
            name="windowDays"
            value={draft.windowDays}
            defaultValue={saved.windowDays}
            inputMode="numeric"
            step={1}
            min={1}
            max={365}
            suffix="days"
            error={errors.windowDays}
            onInput={(event: any) => onChange({windowDays: event.currentTarget.value})}
          />
          {toggle(
            'holiday',
            'Use the holiday return window',
            'Items bought in these dates can be returned until the return date. If the normal window ends later, the normal window applies. The dates repeat every year. Customers see the dates in their own time zone.',
          )}
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            {date('holidayStart', 'Bought from')}
            {date('holidayEnd', 'Bought until')}
          </s-grid>
          {date('holidayReturnBy', 'Return by', `The last day to request a return. ${shopifySwitch}`.trim())}
        </s-stack>
      </s-section>

      <s-section heading="Exchanges">
        {toggle(
          'exchanges',
          'Offer exchanges',
          'Off: customers can only return items for a refund or store credit.',
        )}
      </s-section>

      <s-section heading="Store credit">
        {toggle(
          'storeCreditNoFee',
          'Store credit has no return fee',
          "Exception: returns on exchange orders and remote states pay the fee on store credit too. The fee comes from Shopify's return rules.",
        )}
      </s-section>

      <s-section heading="Final sale">
        <s-stack gap="base">
          {toggle('finalSaleSku', 'A SKU can make an item final sale')}
          {text(
            'finalSaleText',
            'SKU contains',
            'Upper and lower case are the same. A space matches any spacing.',
            !draft.finalSaleSku,
          )}
        </s-stack>
      </s-section>

      <s-section heading="Remote states">
        <s-stack gap="base">
          {toggle(
            'remote',
            'Use the remote states rules',
            'The fee below applies to refunds and store credit, and wins over every other fee rule. Off: these states follow the US rules.',
          )}
          {amount(
            'remoteFee',
            'Return fee',
            "Shopify's return rules cannot set a fee by state. Staff set this fee on the return when they approve it.",
            !draft.remote,
          )}
          {text('remoteZones', 'States', 'Two-letter state codes, separated by commas.', !draft.remote)}
          <s-switch
            label="Offer exchanges to these states"
            details="Off: customers in these states can only return items. Exchanges must also be on."
            name="remoteExchanges"
            checked={draft.remoteExchanges}
            defaultChecked={saved.remoteExchanges}
            disabled={!draft.remote}
            onChange={(event: any) => onChange({remoteExchanges: event.currentTarget.checked})}
          />
        </s-stack>
      </s-section>

      <s-section heading="Outside the US">
        {toggle(
          'international',
          'Use the international return steps',
          "Customers ship the return themselves and no exchange is offered. Only the market's return rules set a fee. Off: these orders follow the US rules.",
        )}
      </s-section>

      <s-section heading="Test mode">
        <s-stack gap="base">
          {toggle(
            'testMode',
            'Only show returns to these customers',
            'Use this to test the app on your store before customers see it. Other customers do not see the Start return button.',
          )}
          <s-text-area
            label="Customer emails"
            details="The email the customer signs in with. Separate emails with commas or new lines."
            name="testEmails"
            rows={3}
            value={draft.testEmails}
            defaultValue={saved.testEmails}
            disabled={!draft.testMode}
            error={errors.testEmails}
            onInput={(event: any) => onChange({testEmails: event.currentTarget.value})}
          />
        </s-stack>
      </s-section>
    </s-stack>
  );
}
