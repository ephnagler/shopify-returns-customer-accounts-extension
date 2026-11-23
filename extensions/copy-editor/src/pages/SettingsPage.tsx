import {useEffect, useState} from 'preact/hooks';

import buttonDefaults from '../../../return-item/locales/en.default.json';
import pageDefaults from '../../../return-page/locales/en.default.json';
import {
  COPY_FIELDS,
  COPY_KEY,
  COPY_NAMESPACE,
  LIST_FIELDS,
  missingPlaceholders,
  parseCopy,
  type CopyField,
  type CopyGroup,
} from '../../../../shared/returns/copy.ts';
import {
  DEFAULT_POLICY,
  parsePolicy,
  POLICY_KEY,
  POLICY_NAMESPACE,
  toDraft,
  toPolicy,
  type PolicyDraft,
} from '../../../../shared/returns/policy.ts';
import PolicyRules from '../components/PolicyRules.tsx';
import {PageStack, Tabs} from '../components/Tabs.tsx';
import {DocBlocks, SHOPIFY_SETTINGS} from '../content.tsx';

// Settings: Policy rules (window, fees, which rules are on; shop metafield
// $app:policy), Policy copy and UI copy (every customer-facing string of the
// return flow), plus the Shopify settings the app depends on. Only changed
// strings are saved (shop metafield $app:copy); the rest keep following the
// extension locale defaults.

/** {"page": {"heading": "x"}} -> {"page.heading": "x"} */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object') Object.assign(out, flatten(value as Record<string, unknown>, `${prefix}${key}.`));
    else out[`${prefix}${key}`] = String(value);
  }
  return out;
}

const LOCALE_DEFAULTS = {...flatten(buttonDefaults), ...flatten(pageDefaults)};
// List fields (policy bullets, exchange steps) default to their lines, one per line.
const DEFAULTS: Record<string, string> = {
  ...LOCALE_DEFAULTS,
  ...Object.fromEntries(
    Object.entries(LIST_FIELDS).map(([key, lineKeys]) => [
      key,
      (lineKeys as string[]).map((line) => LOCALE_DEFAULTS[line]).join('\n'),
    ]),
  ),
};

const SHOP_COPY_QUERY = `#graphql
  query ShopCopy {
    shop {
      id
      copy: metafield(namespace: "${COPY_NAMESPACE}", key: "${COPY_KEY}") {
        value
      }
      policy: metafield(namespace: "${POLICY_NAMESPACE}", key: "${POLICY_KEY}") {
        value
      }
    }
  }
`;

const SAVE_SETTINGS_MUTATION = `#graphql
  mutation SaveSettings($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim();
const isEdited = (key: string, value: string) => normalize(value) !== '' && normalize(value) !== normalize(DEFAULTS[key] ?? '');

export default function SettingsPage() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(toDraft(DEFAULT_POLICY));
  const [policySaved, setPolicySaved] = useState<PolicyDraft>(toDraft(DEFAULT_POLICY));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('rules');
  // Bumped on Discard so every field remounts with the saved text. Without it
  // the host keeps showing the discarded text in fields it thinks are unchanged.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    shopify
      .query(SHOP_COPY_QUERY)
      .then((result) => {
        const {data, errors} = result as {
          data?: {shop: {id: string; copy: {value: string} | null; policy: {value: string} | null}};
          errors?: {message: string}[];
        };
        if (errors?.length || !data) throw new Error(errors?.map((e) => e.message).join('; '));
        const overrides = parseCopy(data.shop.copy?.value);
        const initial = Object.fromEntries(COPY_FIELDS.map(({key}) => [key, overrides[key] ?? DEFAULTS[key] ?? '']));
        setShopId(data.shop.id);
        setValues(initial);
        setSaved(initial);
        const policyInitial = toDraft(parsePolicy(data.shop.policy?.value));
        setPolicyDraft(policyInitial);
        setPolicySaved(policyInitial);
      })
      .catch((error) => {
        console.error('[copy-editor] load failed', error);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const errors = Object.fromEntries(
    COPY_FIELDS.filter(({key}) => !(key in LIST_FIELDS))
      .map(({key}) => [key, missingPlaceholders(DEFAULTS[key] ?? '', values[key] ?? '')])
      .filter(([, missing]) => (missing as string[]).length > 0),
  ) as Record<string, string[]>;

  const {policy, errors: policyErrors} = toPolicy(policyDraft);

  // Native save bar: s-form shows Shopify's own Save/Discard bar while any
  // field's value differs from its defaultValue (the saved text).
  async function persist() {
    if (!shopId) throw new Error('Shop not loaded');
    if (Object.keys(errors).length || Object.keys(policyErrors).length) {
      shopify.toast.show('Fix the fields marked in red, then save.', {isError: true});
      throw new Error('Settings have errors');
    }
    const overrides = Object.fromEntries(
      COPY_FIELDS.filter(({key}) => isEdited(key, values[key] ?? '')).map(({key}) => [key, normalize(values[key])]),
    );
    // Write only what changed. The policy is saved whole, so a store that never
    // edits it keeps following the defaults in policy.ts.
    const metafields = [];
    if (JSON.stringify(values) !== JSON.stringify(saved)) {
      metafields.push({ownerId: shopId, namespace: COPY_NAMESPACE, key: COPY_KEY, type: 'json', value: JSON.stringify(overrides)});
    }
    if (JSON.stringify(policyDraft) !== JSON.stringify(policySaved)) {
      metafields.push({ownerId: shopId, namespace: POLICY_NAMESPACE, key: POLICY_KEY, type: 'json', value: JSON.stringify(policy)});
    }
    if (!metafields.length) return;
    const result = await shopify.query(SAVE_SETTINGS_MUTATION, {variables: {metafields}});
    const {data, errors: gqlErrors} = result as {
      data?: {metafieldsSet: {userErrors: {message: string}[]}};
      errors?: {message: string}[];
    };
    const problems = [...(gqlErrors ?? []), ...(data?.metafieldsSet.userErrors ?? [])];
    if (problems.length) {
      console.error('[copy-editor] save failed', problems);
      shopify.toast.show('Settings not saved. Try again.', {isError: true});
      throw new Error(problems.map((p) => p.message).join('; '));
    }
    setSaved(values);
    // Show the cleaned-up values (for example "ak hi" -> "AK, HI") as the saved state.
    const cleaned = toDraft(policy);
    setPolicyDraft(cleaned);
    setPolicySaved(cleaned);
    shopify.toast.show('Settings saved');
  }

  function handleSubmit(event: any) {
    const promise = persist();
    event?.waitUntil?.(promise);
    return promise;
  }

  function handleReset() {
    setValues(saved);
    setPolicyDraft(policySaved);
    setFormKey((key) => key + 1);
  }

  if (loading) {
    return (
      <s-page heading="Settings">
        <s-section>
          <s-spinner accessibilityLabel="Loading settings" />
        </s-section>
      </s-page>
    );
  }

  if (loadError) {
    return (
      <s-page heading="Settings">
        <s-banner tone="critical" heading="The settings did not load">
          Reload the page. If it still fails, contact your developer.
        </s-banner>
      </s-page>
    );
  }

  const setValue = (key: string, value: string) => setValues((current) => ({...current, [key]: value}));

  return (
    <s-page heading="Settings">
      <PageStack>
        <Tabs heading="Settings" tabs={TABS} current={tab} onSelect={setTab} />
        {tab === 'rules' ? (
          <s-banner tone="info" heading="Set the rules the return page uses">
            <s-stack gap="small">
              <s-paragraph>
                Changes show on the order page after you save. A rule that is off is not checked.
              </s-paragraph>
              <s-paragraph>
                Set the standard return fee in Shopify's return rules, not here.
              </s-paragraph>
              <s-paragraph>
                The return window shows in the text customers see. Other changes here do not. If you change a fee, also
                change it in Policy copy and UI copy.
              </s-paragraph>
            </s-stack>
          </s-banner>
        ) : tab === 'shopify' ? (
          <s-banner tone="info">
            The app depends on these Shopify settings. Check each one when you set up the app, and after a change to
            your return policy.
          </s-banner>
        ) : (
          <s-banner tone="info" heading="Edit the text customers see when they start a return">
            <s-stack gap="small">
              <s-paragraph>
                Changes show on the order page after you save. A field you do not change keeps the default text, and
                gets future updates to it.
              </s-paragraph>
              <s-paragraph>
                The app fills in text in double braces, such as {'{{fee}}'}. The note below a field shows the ones you
                can use in it. If the default text has one, keep it.
              </s-paragraph>
            </s-stack>
          </s-banner>
        )}

        <s-form onSubmit={handleSubmit} onReset={handleReset}>
          {/* Every editable tab stays mounted so the save bar still sees changes on a hidden one. */}
          <s-box key={`rules-${formKey}`} display={tab === 'rules' ? 'auto' : 'none'}>
            <PolicyRules
              draft={policyDraft}
              saved={policySaved}
              errors={policyErrors}
              onChange={(change) => setPolicyDraft((current) => ({...current, ...change}))}
            />
          </s-box>
          {COPY_GROUPS.map((group) => (
            <s-box key={`${group}-${formKey}`} display={group === tab ? 'auto' : 'none'}>
              <CopySection
                group={group}
                values={values}
                saved={saved}
                errors={errors}
                onChange={setValue}
              />
            </s-box>
          ))}
        </s-form>
        {tab === 'shopify' && <DocBlocks blocks={SHOPIFY_SETTINGS} />}
      </PageStack>
    </s-page>
  );
}

type SettingsTab = 'rules' | CopyGroup | 'shopify';

// The rules come first: they decide what the copy has to say.
const TABS: {key: SettingsTab; title: string}[] = [
  {key: 'rules', title: 'Policy rules'},
  {key: 'policy', title: 'Policy copy'},
  {key: 'ui', title: 'UI copy'},
  {key: 'shopify', title: 'Shopify settings'},
];
const COPY_GROUPS: CopyGroup[] = ['policy', 'ui'];

/** One tab: a card per page or step, in the order the customer sees them. */
function CopySection({
  group,
  values,
  saved,
  errors,
  onChange,
}: {
  group: CopyGroup;
  values: Record<string, string>;
  saved: Record<string, string>;
  errors: Record<string, string[]>;
  onChange: (key: string, value: string) => void;
}) {
  const fields = COPY_FIELDS.filter((field) => field.group === group);
  const sections = Array.from(new Set<string>(fields.map((field) => String(field.section))));
  return (
    <s-stack gap="base">
      {sections.map((section) => (
        <s-section key={section} heading={section}>
          <s-stack gap="base">
            {fields
              .filter((field) => field.section === section)
              .map((field) => (
                <CopyInput
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ''}
                  savedValue={saved[field.key] ?? ''}
                  missing={errors[field.key]}
                  onChange={(value) => onChange(field.key, value)}
                />
              ))}
          </s-stack>
        </s-section>
      ))}
    </s-stack>
  );
}

function CopyInput({
  field,
  value,
  savedValue,
  missing,
  onChange,
}: {
  field: CopyField;
  value: string;
  savedValue: string;
  missing?: string[];
  onChange: (value: string) => void;
}) {
  const defaultText = DEFAULTS[field.key] ?? '';
  const edited = isEdited(field.key, value);
  const error = missing?.length ? `Keep ${missing.map((name) => `{{${name}}}`).join(', ')} in the text.` : undefined;
  const variables = Object.entries(field.variables ?? {});

  return (
    <s-stack gap="small-200">
      {field.multiline ? (
        <s-text-area
          label={field.label}
          name={field.key}
          value={value}
          defaultValue={savedValue}
          rows={field.key in LIST_FIELDS ? 8 : 3}
          error={error}
          onInput={(event: any) => onChange(event.currentTarget.value)}
        />
      ) : (
        <s-text-field
          label={field.label}
          name={field.key}
          value={value}
          defaultValue={savedValue}
          error={error}
          onInput={(event: any) => onChange(event.currentTarget.value)}
        />
      )}
      {variables.length > 0 && (
        <s-stack gap="none">
          <s-text color="subdued">You can use:</s-text>
          {variables.map(([name, meaning]) => (
            <s-text key={name} color="subdued">
              <s-text type="strong">{`{{${name}}}`}</s-text> {meaning}
            </s-text>
          ))}
        </s-stack>
      )}
      {edited && (
        <s-stack direction="inline">
          <s-button variant="tertiary" onClick={() => onChange(defaultText)}>
            Reset to default
          </s-button>
        </s-stack>
      )}
    </s-stack>
  );
}
