import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useMemo, useState} from 'preact/hooks';

import {
  customerAccountQuery,
  customerAllowed,
  type FinancialSummary,
  type Money,
  type OrderRequestReturnResult,
  type ReturnCalculateResult,
} from '../../../shared/returns/api.ts';
import {
  evaluateOrder,
  FALLBACK_RETURN_FEE,
  FEE_MARKER_MAX,
  feeMarker,
  returnFees,
  type Eligibility,
  type OrderReturnData,
  type ReturnItem,
} from '../../../shared/returns/eligibility.ts';
import {
  ORDER_REQUEST_RETURN_MUTATION,
  ORDER_RETURN_QUERY,
  RETURN_CALCULATE_QUERY,
} from '../../../shared/returns/graphql.ts';
import {DEFAULT_POLICY, parsePolicy, type ReturnPolicy} from '../../../shared/returns/policy.ts';

type Choice = 'return' | 'exchange';
type RefundMethod = 'card' | 'credit';

// Starts each exchange note. Staff see it on the Return in admin, and the Flow
// workflow (Return requested -> note contains this -> set order metafield
// custom.exchange_requested) keys on it. Customer accounts can't write order
// metafields (no customer_write_orders scope; confirmed with shopify.dev), so
// Flow sets the flag. Keep this text in sync with the workflow condition.
// Short, in brackets: a customer who writes "no exchange" must not match.
const EXCHANGE_NOTE_PREFIX = '[EXCHANGE]';

// Starts the note when the customer wants store credit instead of a refund to
// the card. The Customer Account API can't choose the refund method, so staff
// read this on the Return and refund to store credit in admin.
const STORE_CREDIT_NOTE_PREFIX = '[STORE CREDIT]';

// Shopify keeps at most 300 characters of customer note per return line item.
// The details are typed before the customer picks exchange or store credit, so
// they get what is left after the longest markers and their spaces: nothing is cut.
// The first line also carries the fee marker (feeMarker, at most FEE_MARKER_MAX).
const NOTE_LIMIT = 300;
const DETAILS_MAX =
  NOTE_LIMIT - Math.max(EXCHANGE_NOTE_PREFIX.length, STORE_CREDIT_NOTE_PREFIX.length) - 1 - FEE_MARKER_MAX - 1;
// FALLBACK_RETURN_FEE and the fees in Policy rules are in the shop currency.
const FEE_CURRENCY = 'USD';

import {
  EXCHANGE_STEP_KEYS,
  EXCHANGE_STEPS_KEY,
  INTERNATIONAL_STEP_KEYS,
  INTERNATIONAL_STEPS_KEY,
  RETURN_STEP_KEYS,
  RETURN_STEPS_KEY,
  interpolate,
  listLines,
  parseCopy,
  POLICY_BULLET_KEYS,
  policyLines,
  type CopyOverrides,
} from '../../../shared/returns/copy.ts';

// Copy staff edited in the admin (shop metafield $app:copy). Set once the order
// loads; until then, and for any key not edited, the locale default is used.
let copy: CopyOverrides = {};

// The store's return rules (shop metafield $app:policy, Settings > Policy rules). Set
// once the order loads, before anything uses it.
let policy: ReturnPolicy = DEFAULT_POLICY;

// Bought in the holiday window: the last day to return. Set once the order loads.
let holidayReturnBy: Date | null = null;

/** When to send the return, for {{returnWindow}}: "within 30 days after delivery" or "by January 31". */
function returnWindow(): string {
  if (holidayReturnBy) return `by ${shopify.i18n.formatDate(holidayReturnBy, {month: 'long', day: 'numeric'})}`;
  return `within ${policy.windowDays} days after delivery`;
}

/** Values from Policy rules, for {{remoteFee}} and {{returnWindow}} in copy (see COPY_FIELDS variables). */
const policyValues = () => ({
  remoteFee: formatMoney({amount: String(policy.remoteFee), currencyCode: FEE_CURRENCY}),
  returnWindow: returnWindow(),
});

// translate() can return an array when a value is a component; these strings are plain text.
const t = (key: string, options?: Record<string, unknown>): string =>
  copy[key] ? interpolate(copy[key], options) : String(shopify.i18n.translate(key, options));

export default async () => {
  const orderId = await waitForOrderId();
  render(<ReturnPage orderId={orderId} />, document.body);
};

/** The order loads after the extension starts; wait for its ID. */
function waitForOrderId(): Promise<string> {
  const current = shopify.order.value?.id;
  if (current) return Promise.resolve(current);
  return new Promise((resolve) => {
    const unsubscribe = shopify.order.subscribe((order) => {
      if (order?.id) {
        unsubscribe();
        resolve(order.id);
      }
    });
  });
}

// Steps: select items -> reasons and details -> choose return or exchange ->
// confirm (the only step that sends the request) -> done.
type View = 'select' | 'details' | 'choose' | 'confirm' | 'done';
type Load =
  | {state: 'loading'}
  | {state: 'error'}
  | {state: 'ready'; order: OrderReturnData; eligibility: Eligibility};

function ReturnPage({orderId}: {orderId: string}) {
  const [load, setLoad] = useState<Load>({state: 'loading'});
  const [view, setView] = useState<View>('select');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [choice, setChoice] = useState<Choice>('return');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('credit');

  useEffect(() => {
    customerAccountQuery<{
      shop: {copy: {value: string} | null; policy: {value: string} | null};
      order: OrderReturnData | null;
    }>(
      ORDER_RETURN_QUERY,
      {orderId},
    )
      .then(async ({shop, order}) => {
        copy = parseCopy(shop?.copy?.value);
        policy = parsePolicy(shop?.policy?.value);
        if (!order) throw new Error('Order not found');
        const eligibility = evaluateOrder(order, new Date(), policy);
        holidayReturnBy = eligibility.holidayReturnBy;
        // A blocked customer, or one not on the test list, gets "not returnable", the same as the hidden button.
        if (eligibility.show && !(await customerAllowed(policy))) eligibility.show = false;
        setLoad({state: 'ready', order, eligibility});
      })
      .catch((error) => {
        console.error('[return-page] load failed', error);
        setLoad({state: 'error'});
      });
  }, [orderId]);

  const selection = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([lineItemId, quantity]) => ({lineItemId, quantity})),
    [quantities],
  );

  // Recalculate the money each time the selection changes.
  useEffect(() => {
    if (selection.length === 0) {
      setSummary(null);
      return;
    }
    let stale = false;
    setCalculating(true);
    customerAccountQuery<ReturnCalculateResult>(RETURN_CALCULATE_QUERY, {
      orderId,
      returnLineItems: selection,
    })
      .then((data) => !stale && setSummary(data.returnCalculate?.financialSummary ?? null))
      .catch((error) => {
        console.error('[return-page] returnCalculate failed', error);
        if (!stale) setSummary(null);
      })
      .finally(() => !stale && setCalculating(false));
    return () => {
      stale = true;
    };
  }, [orderId, selection]);

  if (load.state === 'loading') {
    return (
      <s-page heading={t('page.heading')}>
        <s-section>
          <s-skeleton-paragraph />
        </s-section>
      </s-page>
    );
  }

  if (load.state === 'error') {
    return (
      <s-page heading={t('page.heading')}>
        <s-banner tone="critical">{t('page.loadError')}</s-banner>
      </s-page>
    );
  }

  const {order, eligibility} = load;
  const backToOrder = `shopify:customer-account/orders/${order.id.split('/').pop()}`;

  if (!eligibility.show) {
    return (
      <s-page heading={t('page.heading')}>
        <s-button slot="breadcrumb-actions" accessibilityLabel={t('page.backToOrder')} href={backToOrder} />
        <s-banner tone="info">{t('page.notReturnable')}</s-banner>
      </s-page>
    );
  }

  const eligible = eligibility.items.filter((item) => item.status === 'eligible');
  const selectedItems = eligible.filter((item) => (quantities[item.lineItemId] ?? 0) > 0);
  const money = summary ? moneyLines(summary, eligibility) : null;
  // No exchange to offer (exchanges off, exchange order, remote states, ...): skip step 3 and go to the return.
  const {allowExchange} = eligibility;
  // The fee the customer is quoted, for the note on the first line: staff match the return's fee to it.
  const feeNote = (path: 'exchange' | 'card' | 'credit') =>
    money ? feeMarker(eligibility, money.quote, path, {currency: money.currency, zones: policy.remoteZones}) : '';
  const feeText = money?.fee ?? formatMoney({amount: String(FALLBACK_RETURN_FEE), currencyCode: FEE_CURRENCY});

  if (view === 'done') {
    return (
      <s-page heading={t(choice === 'exchange' ? 'done.exchangeHeading' : 'done.heading')}>
        <s-button slot="breadcrumb-actions" accessibilityLabel={t('page.backToOrder')} href={backToOrder} />
        <s-section>
          <s-stack gap="base">
            {choice === 'exchange' ? (
              <>
                <s-paragraph>{t('done.exchangeBody', {name: order.name})}</s-paragraph>
                <StepList heading={t('done.nextHeading')} steps={nextSteps('exchange', false, {order: order.name, name: order.name, fee: feeText})} />
                <ShopLatest orderName={order.name} />
                <s-link href={backToOrder}>{t('page.backToOrder')}</s-link>
              </>
            ) : (
              <>
                <s-paragraph>{t('done.body', {name: order.name})}</s-paragraph>
                <StepList heading={t('done.nextHeading')} steps={nextSteps('return', eligibility.international, {order: order.name, name: order.name, fee: feeText})} />
                <s-button variant="primary" href={backToOrder}>
                  {t('page.backToOrder')}
                </s-button>
              </>
            )}
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  if (view === 'details') {
    return (
      <DetailsView
        items={selectedItems}
        quantities={quantities}
        reasons={reasons}
        note={note}
        onReason={(lineItemId, reasonId) => setReasons((current) => ({...current, [lineItemId]: reasonId}))}
        onNote={setNote}
        agreed={agreed}
        onAgree={setAgreed}
        fee={money?.standardFee ?? feeText}
        onBack={() => setView('select')}
        onContinue={() => {
          if (allowExchange) setView('choose');
          else {
            setChoice('return');
            setView('confirm');
          }
        }}
      />
    );
  }

  if (view === 'choose') {
    return (
      <ChooseView
        money={money}
        calculating={calculating}
        allowExchange={allowExchange}
        onBack={() => setView('details')}
        onPick={(picked) => {
          setChoice(picked);
          setView('confirm');
        }}
      />
    );
  }

  if (view === 'confirm') {
    return (
      <ConfirmView
        choice={choice}
        orderId={order.id}
        items={selectedItems}
        quantities={quantities}
        reasons={reasons}
        note={note}
        feeNote={feeNote(
          choice === 'exchange' ? 'exchange' : refundMethod === 'credit' ? 'credit' : 'card',
        )}
        orderName={order.name}
        fee={feeText}
        money={money}
        international={eligibility.international}
        refundMethod={refundMethod}
        onRefundMethod={setRefundMethod}
        onBack={() => setView(allowExchange ? 'choose' : 'details')}
        onDone={() => setView('done')}
      />
    );
  }

  return (
    <s-page heading={t('page.heading')} subheading={order.name}>
      <s-button slot="breadcrumb-actions" accessibilityLabel={t('page.backToOrder')} href={backToOrder} />
      <s-stack gap="large">
        {eligibility.isExchangeOrder && <s-banner tone="info">{t('select.exchangeOrder')}</s-banner>}

        <s-section heading={t('select.heading')}>
          <s-stack gap="base">
            <s-paragraph>{t('select.help')}</s-paragraph>
            {eligible.map((item) => (
              <ItemRow
                key={item.lineItemId}
                item={item}
                quantity={quantities[item.lineItemId] ?? 0}
                onChange={(quantity) =>
                  setQuantities((current) => ({...current, [item.lineItemId]: quantity}))
                }
              />
            ))}
            <LockedItems eligibility={eligibility} />
          </s-stack>
        </s-section>

        <s-stack direction="inline" gap="base">
          <s-button variant="primary" disabled={selection.length === 0} onClick={() => setView('details')}>
            {t('cta.continue')}
          </s-button>
        </s-stack>
      </s-stack>
    </s-page>
  );
}

function Thumbnail({item}: {item: ReturnItem}) {
  // Without src, Shopify shows its placeholder image.
  return item.imageUrl ? (
    <s-product-thumbnail src={item.imageUrl} alt={item.imageAlt ?? item.title} />
  ) : (
    <s-product-thumbnail alt={item.title} />
  );
}

const itemLabel = (item: ReturnItem) => (item.variantTitle ? `${item.title} (${item.variantTitle})` : item.title);

/** A full-width row the customer taps to select an item, not a small checkbox. */
function ItemRow({
  item,
  quantity,
  onChange,
}: {
  item: ReturnItem;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const selected = quantity > 0;
  return (
    <s-stack gap="small-200">
      <s-clickable
        onClick={() => onChange(selected ? 0 : 1)}
        accessibilityLabel={itemLabel(item)}
        border="base"
        borderRadius="base"
        padding="small"
        background={selected ? 'subdued' : 'transparent'}
      >
        <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
          <Thumbnail item={item} />
          <s-text type={selected ? 'strong' : undefined}>{itemLabel(item)}</s-text>
          <s-icon type={selected ? 'check-circle-filled' : 'circle'} />
        </s-grid>
      </s-clickable>
      {item.quantity > 1 && selected && (
        <s-select
          label={t('select.quantity')}
          value={String(quantity)}
          onChange={(event: any) => onChange(Number(event.currentTarget.value))}
        >
          {Array.from({length: item.quantity}, (_, index) => (
            <s-option value={String(index + 1)}>{String(index + 1)}</s-option>
          ))}
        </s-select>
      )}
    </s-stack>
  );
}

/**
 * Items the customer can see but can't select. Same row as ItemRow, with the
 * image, but disabled and with the reason under the title.
 */
function LockedItems({eligibility}: {eligibility: Eligibility}) {
  const rows = [
    ...eligibility.items
      .filter((item) => item.status !== 'eligible')
      .map((item) => ({...item, reason: t(`locked.${item.status}`)})),
    ...eligibility.locked.map((item) => ({...item, reason: t('locked.other')})),
  ];
  return (
    <>
      {rows.map((row) => (
        <s-clickable
          key={row.lineItemId}
          disabled
          accessibilityLabel={`${row.title}. ${row.reason}`}
          border="base"
          borderRadius="base"
          padding="small"
        >
          <s-grid gridTemplateColumns="auto 1fr" gap="base" alignItems="center">
            {row.imageUrl ? (
              <s-product-thumbnail src={row.imageUrl} alt={row.imageAlt ?? row.title} />
            ) : (
              <s-product-thumbnail alt={row.title} />
            )}
            <s-stack gap="small-200">
              <s-text color="subdued">
                {row.variantTitle ? `${row.title} (${row.variantTitle})` : row.title}
              </s-text>
              <s-text color="subdued">{row.reason}</s-text>
            </s-stack>
          </s-grid>
        </s-clickable>
      ))}
    </>
  );
}

/** Step 2: a reason for each item, plus optional details. */
function DetailsView({
  items,
  quantities,
  reasons,
  note,
  onReason,
  onNote,
  agreed,
  onAgree,
  fee,
  onBack,
  onContinue,
}: {
  items: ReturnItem[];
  quantities: Record<string, number>;
  reasons: Record<string, string>;
  note: string;
  onReason: (lineItemId: string, reasonId: string) => void;
  onNote: (note: string) => void;
  agreed: boolean;
  onAgree: (agreed: boolean) => void;
  fee: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [showErrors, setShowErrors] = useState(false);
  const storefront = shopify.shop.storefrontUrl?.replace(/\/$/, '');
  const missingReason = items.some((item) => item.reasons.length > 0 && !reasons[item.lineItemId]);

  return (
    <s-page heading={t('details.heading')}>
      <s-button slot="breadcrumb-actions" accessibilityLabel={t('page.back')} onClick={onBack} />
      <s-section>
        <s-stack gap="large">
          {/* Items get their own stack: a keyed list next to the text area in one
              stack can be put out of order (reason 1, details, reason 2). */}
          <s-stack gap="base">
            {items.map((item, index) => (
              <s-stack key={item.lineItemId} gap="base">
                {index > 0 && <s-divider />}
                <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
                  <Thumbnail item={item} />
                  <s-stack gap="small-200">
                    {/* In a paragraph so a wrapped title gets body line height. */}
                    <s-paragraph>
                      <s-text type="strong">
                        {item.title}
                        {quantities[item.lineItemId] > 1 ? ` × ${quantities[item.lineItemId]}` : ''}
                      </s-text>
                    </s-paragraph>
                    <s-text color="subdued">{item.variantTitle || t('details.oneSize')}</s-text>
                  </s-stack>
                  {item.reasons.length > 0 && (
                    <s-select
                      label={t('details.reason')}
                      placeholder={t('details.reasonPlaceholder')}
                      value={reasons[item.lineItemId] ?? ''}
                      error={showErrors && !reasons[item.lineItemId] ? t('details.reasonRequired') : undefined}
                      onChange={(event: any) => onReason(item.lineItemId, event.currentTarget.value)}
                    >
                      {item.reasons.map((reason) => (
                        <s-option key={reason.id} value={reason.id}>
                          {reason.name}
                        </s-option>
                      ))}
                    </s-select>
                  )}
                </s-grid>
              </s-stack>
            ))}
          </s-stack>
          <s-divider />
          <s-stack gap="small-200">
            <s-text-area
              label={t('details.note')}
              maxLength={DETAILS_MAX}
              rows={4}
              value={note}
              onInput={(event: any) => onNote(event.currentTarget.value)}
            />
            <s-text color="subdued">{t('details.noteCount', {count: note.length, max: DETAILS_MAX})}</s-text>
          </s-stack>
        </s-stack>
      </s-section>
      <s-section heading={t('policy.heading')}>
        <s-stack gap="small">
          {/* Not s-unordered-list: same tight line height as the steps. */}
          <s-stack gap="small">
            {policyLines(copy, POLICY_BULLET_KEYS.map((key) => (key === 'policy.window' ? t(key, {returnWindow: returnWindow()}) : t(key)))).map((line) => (
              <s-grid key={line} gridTemplateColumns="auto 1fr" gap="small">
                <s-paragraph>•</s-paragraph>
                <s-paragraph>{interpolate(line, {fee, ...policyValues()})}</s-paragraph>
              </s-grid>
            ))}
          </s-stack>
          {storefront && <s-link target="_blank" href={`${storefront}/policies/refund-policy`}>{t('policy.link')}</s-link>}
          <s-checkbox
            label={t('policy.agree')}
            checked={agreed}
            error={showErrors && !agreed ? t('policy.agreeRequired') : undefined}
            onChange={(event: any) => onAgree(event.currentTarget.checked)}
          />
        </s-stack>
      </s-section>
      <s-stack direction="inline" gap="base">
        <s-button
          variant="primary"
          onClick={() => (missingReason || !agreed ? setShowErrors(true) : onContinue())}
        >
          {t('cta.continue')}
        </s-button>
      </s-stack>
    </s-page>
  );
}

/** Step 3: return for a refund (minus the fee), or exchange (free label, shop links). */
/** The done screen's next steps. Staff can edit each list as one text box. */
function nextSteps(choice: Choice, international: boolean, values: Record<string, string>): string[] {
  const [listKey, keys] =
    choice === 'exchange'
      ? [EXCHANGE_STEPS_KEY, EXCHANGE_STEP_KEYS]
      : international
        ? [INTERNATIONAL_STEPS_KEY, INTERNATIONAL_STEP_KEYS]
        : [RETURN_STEPS_KEY, RETURN_STEP_KEYS];
  // translate() logs an error for unused values, so each default gets only its own.
  const defaults = keys.map((key) => {
    const all: Record<string, string> = {...values, returnWindow: returnWindow()};
    const own = Object.fromEntries(Object.entries(all).filter(([name]) => STEP_PLACEHOLDERS[key]?.includes(name)));
    return Object.keys(own).length ? t(key, own) : t(key);
  });
  // Edited lists can use any of the placeholders, and the fees from Policy rules.
  return listLines(copy, listKey, defaults).map((line) => interpolate(line, {...policyValues(), ...values}));
}

const STEP_PLACEHOLDERS: Record<string, string[]> = {
  'exchange.step2': ['order'],
  'exchange.step3': ['name'],
  'exchange.step4': ['returnWindow'],
  'return.step2': ['name'],
  'return.step3': ['returnWindow'],
  'international.step1': ['name'],
  'international.step3': ['returnWindow'],
};

/** Step 3: exchange first, then return with the refund estimate. Nothing is sent yet. */
function ChooseView({
  money,
  calculating,
  allowExchange,
  onBack,
  onPick,
}: {
  money: ReturnType<typeof moneyLines> | null;
  calculating: boolean;
  allowExchange: boolean;
  onBack: () => void;
  onPick: (choice: Choice) => void;
}) {
  return (
    <s-page heading={t('choose.heading')}>
      <s-button slot="breadcrumb-actions" accessibilityLabel={t('page.back')} onClick={onBack} />
      <s-stack gap="large">
        {allowExchange && (
          <s-section heading={t('choose.exchangeHeading')}>
            <s-stack gap="large">
              <s-banner tone="success" heading={t('exchange.freeLabel')}>
                <s-text>{t('exchange.freeLabelNote')}</s-text>
              </s-banner>
              <s-button variant="primary" onClick={() => onPick('exchange')}>
                {t('choose.exchangeCta')}
              </s-button>
            </s-stack>
          </s-section>
        )}

        {allowExchange && (
          <s-grid gridTemplateColumns="1fr auto 1fr" gap="base" alignItems="center">
            <s-divider />
            <s-text color="subdued">{t('choose.or')}</s-text>
            <s-divider />
          </s-grid>
        )}
        <s-section heading={t('choose.returnHeading')}>
          <s-stack gap="large">
            {calculating || !money ? (
              <s-skeleton-paragraph content={t('summary.calculating')} />
            ) : (
              <MoneyBreakdown money={money} method="card" />
            )}
            <s-button
              variant={allowExchange ? 'secondary' : 'primary'}
              disabled={!money}
              onClick={() => onPick('return')}
            >
              {t('choose.returnCta')}
            </s-button>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

/** The refund estimate. Store credit drops the return fee, so the customer sees the difference. */
function MoneyBreakdown({money, method}: {money: ReturnType<typeof moneyLines>; method: RefundMethod}) {
  const credit = method === 'credit';
  return (
    <s-stack gap="small">
      <MoneyRow label={t('summary.itemValue')} value={money.subtotal} />
      {money.tax && <MoneyRow label={t('summary.tax')} value={money.tax} />}
      {money.hasFee && (
        <MoneyRow
          label={t('summary.fee')}
          value={credit && money.creditFeeWaived ? t('summary.feeWaived') : `-${money.fee}`}
        />
      )}
      {money.restocking && <MoneyRow label={t('summary.restocking')} value={`-${money.restocking}`} />}
      <s-divider />
      <MoneyRow
        label={t(credit ? 'summary.totalCredit' : 'summary.total')}
        value={credit ? money.creditTotal : money.total}
        strong
      />
    </s-stack>
  );
}

/** Step 4: how the picked path works, and the only button that sends the request. */
function ConfirmView({
  choice,
  orderId,
  items,
  quantities,
  reasons,
  note,
  feeNote,
  orderName,
  fee,
  money,
  international,
  refundMethod,
  onRefundMethod,
  onBack,
  onDone,
}: {
  choice: Choice;
  orderId: string;
  items: ReturnItem[];
  quantities: Record<string, number>;
  reasons: Record<string, string>;
  note: string;
  feeNote: string;
  orderName: string;
  fee: string;
  money: ReturnType<typeof moneyLines> | null;
  international: boolean;
  refundMethod: RefundMethod;
  onRefundMethod: (method: RefundMethod) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setFailure(null);
    const lineNote = customerNote(choice, refundMethod, note);
    const firstNote = customerNote(choice, refundMethod, note, feeNote);
    try {
      const data = await customerAccountQuery<OrderRequestReturnResult>(ORDER_REQUEST_RETURN_MUTATION, {
        orderId,
        // The fee is for the whole return, so only the first line carries it.
        requestedLineItems: items.map((item, index) => ({
          lineItemId: item.lineItemId,
          quantity: quantities[item.lineItemId],
          ...(reasons[item.lineItemId] ? {returnReasonDefinitionId: reasons[item.lineItemId]} : {}),
          ...((index === 0 ? firstNote : lineNote) ? {customerNote: index === 0 ? firstNote : lineNote} : {}),
        })),
      });
      const result = data.orderRequestReturn;
      if (result.userErrors.length || !result.return) {
        console.error('[return-page] orderRequestReturn userErrors', result.userErrors);
        setFailure(result.userErrors[0]?.message ?? t('choose.error'));
        return;
      }
      onDone();
    } catch (error) {
      console.error('[return-page] orderRequestReturn failed', error);
      setFailure(t('choose.error'));
    } finally {
      setSubmitting(false);
    }
  }

  const isExchange = choice === 'exchange';
  return (
    <s-page heading={t(isExchange ? 'confirm.exchangeHeading' : 'confirm.returnHeading')}>
      <s-button slot="breadcrumb-actions" accessibilityLabel={t('page.back')} disabled={submitting} onClick={onBack} />
      <s-stack gap="large">
        {failure && <s-banner tone="critical">{failure}</s-banner>}

        <s-section>
          <s-stack gap="large">
            {!isExchange && (
              // The choice list's own label sits too close to the first choice, so it is
              // read by screen readers only and a visible label sits above with normal spacing.
              <s-stack gap="small">
                <s-text type="strong">{t('refund.label')}</s-text>
                <s-choice-list
                  label={t('refund.label')}
                  labelAccessibilityVisibility="exclusive"
                  disabled={submitting}
                  onChange={(event: any) => onRefundMethod(event.currentTarget.values[0] as RefundMethod)}
                >
                  <s-choice value="credit" selected={refundMethod === 'credit'}>
                    {t('refund.credit')}
                  </s-choice>
                  <s-choice value="card" selected={refundMethod === 'card'}>
                    {t('refund.card')}
                  </s-choice>
                </s-choice-list>
              </s-stack>
            )}
            {!isExchange && money && <MoneyBreakdown money={money} method={refundMethod} />}
            <StepList
              heading={t(isExchange ? 'exchange.stepsHeading' : 'return.stepsHeading')}
              steps={[
                t(isExchange ? 'exchange.stepSubmit' : 'return.stepSubmit'),
                ...nextSteps(choice, international, {order: orderName, name: orderName, fee}),
              ]}
            />
            <s-button
              variant="primary"
              loading={submitting}
              disabled={submitting}
              onClick={submit}
            >
              {t(isExchange ? 'cta.exchange' : refundMethod === 'credit' ? 'cta.storeCredit' : 'cta.refund')}
            </s-button>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

/**
 * The note sent with each returned line: the outcome marker staff can spot (and Flow
 * keys on), the fee marker on the first line, then the customer's own text.
 * For example "[STORE CREDIT] [FEE $0] Too small in the toe".
 */
function customerNote(choice: Choice, refundMethod: RefundMethod, note: string, feeNote = ''): string {
  const prefix =
    choice === 'exchange' ? EXCHANGE_NOTE_PREFIX : refundMethod === 'credit' ? STORE_CREDIT_NOTE_PREFIX : '';
  // DETAILS_MAX keeps this within NOTE_LIMIT; the slice only guards a pasted overflow.
  return [prefix, feeNote, note.trim().slice(0, DETAILS_MAX)].filter(Boolean).join(' ');
}

/**
 * "Shop latest" button to the all-products collection. It goes through the
 * storefront's /cart/update, which sets the cart note "Exchange #1001" and the
 * cart attribute "Exchange for: #1001", then redirects (return_to) to the
 * collection. No theme code: Shopify keeps both on its own cart, and they copy
 * to the new order, where a Flow workflow marks it as an exchange order.
 */
const EXCHANGE_ATTRIBUTE = 'Exchange for';

function exchangeCartUrl(storefront: string, orderName: string, path: string): string {
  const params = new URLSearchParams();
  params.set(`attributes[${EXCHANGE_ATTRIBUTE}]`, orderName);
  params.set('note', `Exchange ${orderName}`);
  params.set('return_to', path);
  return `${storefront}/cart/update?${params.toString()}`;
}

function ShopLatest({orderName}: {orderName: string}) {
  const storefront = shopify.shop.storefrontUrl?.replace(/\/$/, '');
  if (!storefront) return null;
  return (
    <s-button variant="primary" href={exchangeCartUrl(storefront, orderName, '/collections/all')}>
      {t('exchange.shopLatest')}
    </s-button>
  );
}

/** Numbered steps in a soft grey box, so they read apart from the money and buttons. */
function StepList({heading, steps}: {heading: string; steps: string[]}) {
  return (
    <s-box background="subdued" borderRadius="base" padding="base">
      <s-stack gap="small">
        <s-heading>{heading}</s-heading>
        {/* Not s-ordered-list: its line height is too tight for steps this long. */}
        <s-stack gap="small">
          {steps.map((step, index) => (
            <s-grid key={step} gridTemplateColumns="auto 1fr" gap="small">
              <s-paragraph>{`${index + 1}.`}</s-paragraph>
              <s-paragraph>{step}</s-paragraph>
            </s-grid>
          ))}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

function MoneyRow({label, value, strong}: {label: string; value: string; strong?: boolean}) {
  return (
    <s-grid gridTemplateColumns="1fr auto" gap="base">
      <s-text type={strong ? 'strong' : undefined}>{label}</s-text>
      <s-text type={strong ? 'strong' : undefined}>{value}</s-text>
    </s-grid>
  );
}

function formatMoney({amount, currencyCode}: Money): string {
  const value = Number(amount);
  return currencyCode
    ? shopify.i18n.formatCurrency(value, {currency: currencyCode})
    : shopify.i18n.formatNumber(value, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

/**
 * Turns returnCalculate into display strings.
 *
 * returnCalculate reports from the merchant's side: money going back to the
 * customer is negative (subtotal -300, tax -x, total -275) and fees are
 * positive (+25). The page shows every
 * amount as a positive number and labels fees as deductions.
 *
 * When Shopify's return rules supply no return shipping fee, the fixed fallback fee
 * is shown and taken off here instead.
 */
function moneyLines(summary: FinancialSummary, eligibility: Eligibility) {
  const currency = summary.returnTotalSet.presentmentMoney.currencyCode;
  const amount = (money: Money | undefined) => Math.abs(Number(money?.amount ?? 0));
  const display = (value: number) => formatMoney({amount: String(value), currencyCode: currency});

  const ruleFee = amount(summary.returnShippingFeeSubtotalSet?.presentmentMoney);
  const useRuleFee = eligibility.hasReturnShippingFee && ruleFee > 0;
  const {fee, creditFee} = returnFees(eligibility, useRuleFee ? ruleFee : null, policy);
  const standardFee = useRuleFee ? ruleFee : FALLBACK_RETURN_FEE;
  const restocking = amount(summary.restockingFeeSubtotalSet?.presentmentMoney);
  const tax = amount(summary.returnTotalTaxSet.presentmentMoney);
  // Refund before any return fee = minus the merchant-side total, with Shopify's rule fee added back.
  const beforeFee = -Number(summary.returnTotalSet.presentmentMoney.amount) + (useRuleFee ? ruleFee : 0);

  return {
    /** The fees as numbers, for the fee marker in the note. */
    quote: {fee, creditFee},
    currency,
    // What the customer paid for the items: returnSubtotalSet is before discounts, so
    // derive it from the total. On a discounted order the lines then add up.
    subtotal: display(Math.max(0, beforeFee - tax + restocking)),
    tax: tax > 0 ? display(tax) : null,
    fee: display(fee),
    hasFee: fee > 0,
    standardFee: display(standardFee),
    creditFeeWaived: creditFee === 0,
    restocking: restocking > 0 ? display(restocking) : null,
    total: display(Math.max(0, beforeFee - fee)),
    creditTotal: display(Math.max(0, beforeFee - creditFee)),
  };
}
