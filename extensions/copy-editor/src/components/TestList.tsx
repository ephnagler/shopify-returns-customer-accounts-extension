import {useEffect, useState} from 'preact/hooks';

import {parseChecks, TEST_GROUPS, TESTING_KEY, TESTING_NAMESPACE, type TestChecks} from '../testList.ts';

// Home > Test list. Each tick saves at once to shop metafield $app:testing.
// Before each save it reads the saved list again and changes only one id,
// so two staff testing at the same time do not undo each other's ticks.

const CHECKS_QUERY = `#graphql
  query TestChecks {
    shop {
      id
      testing: metafield(namespace: "${TESTING_NAMESPACE}", key: "${TESTING_KEY}") {
        value
      }
    }
  }
`;

const SAVE_CHECKS_MUTATION = `#graphql
  mutation SaveTestChecks($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        message
      }
    }
  }
`;

const ALL_IDS = TEST_GROUPS.flatMap((group) => group.cases.map((test) => test.id));

async function loadChecks(): Promise<{shopId: string; checks: TestChecks}> {
  const result = (await shopify.query(CHECKS_QUERY)) as {
    data?: {shop: {id: string; testing: {value: string} | null}};
    errors?: {message: string}[];
  };
  if (!result.data) throw new Error(result.errors?.map((error) => error.message).join('; ') || 'No data');
  return {shopId: result.data.shop.id, checks: parseChecks(result.data.shop.testing?.value)};
}

async function saveChecks(shopId: string, checks: TestChecks) {
  const result = (await shopify.query(SAVE_CHECKS_MUTATION, {
    variables: {
      metafields: [{ownerId: shopId, namespace: TESTING_NAMESPACE, key: TESTING_KEY, type: 'json', value: JSON.stringify(checks)}],
    },
  })) as {data?: {metafieldsSet: {userErrors: {message: string}[]}}; errors?: {message: string}[]};
  const problems = [...(result.errors ?? []), ...(result.data?.metafieldsSet.userErrors ?? [])];
  if (problems.length) throw new Error(problems.map((problem) => problem.message).join('; '));
}

const today = () => new Date().toISOString().slice(0, 10);

export default function TestList() {
  const [checks, setChecks] = useState<TestChecks>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Clearing removes every staff member's ticks, so it takes two clicks.
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    loadChecks()
      .then(({checks}) => setChecks(checks))
      .catch((error) => setError(`The saved checks did not load. ${error.message}`))
      .finally(() => setLoaded(true));
  }, []);

  async function update(change: (saved: TestChecks) => TestChecks) {
    setError(null);
    setChecks(change);
    try {
      const {shopId, checks: saved} = await loadChecks();
      const next = change(saved);
      await saveChecks(shopId, next);
      setChecks(next);
    } catch (error) {
      setError(`The check did not save. Try again. ${(error as Error).message}`);
    }
  }

  function toggle(id: string, checked: boolean) {
    update((saved) => {
      const next = {...saved};
      if (checked) next[id] = today();
      else delete next[id];
      return next;
    });
  }

  const done = ALL_IDS.filter((id) => checks[id]).length;

  return (
    <s-stack gap="base">
      {error && <s-banner tone="critical">{error}</s-banner>}
      <s-section>
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-paragraph>
            {loaded ? `${done} of ${ALL_IDS.length} tests done. Checks save at once, for all staff.` : 'Loading checks...'}
          </s-paragraph>
          <s-button
            tone={confirmClear ? 'critical' : 'auto'}
            disabled={!loaded || done === 0}
            onClick={() => {
              if (!confirmClear) return setConfirmClear(true);
              setConfirmClear(false);
              update(() => ({}));
            }}
          >
            {confirmClear ? 'Select again to clear all' : 'Clear all checks'}
          </s-button>
        </s-stack>
      </s-section>
      {TEST_GROUPS.map((group) => {
        const groupDone = group.cases.filter((test) => checks[test.id]).length;
        return (
          <s-section key={group.heading} heading={`${group.heading} (${groupDone} of ${group.cases.length})`}>
            <s-stack gap="base">
              {group.intro && <s-paragraph>{group.intro}</s-paragraph>}
              {group.cases.map((test) => (
                <s-checkbox
                  key={test.id}
                  label={test.title}
                  details={checks[test.id] ? `${test.expect} Checked ${checks[test.id]}.` : test.expect}
                  checked={!!checks[test.id]}
                  disabled={!loaded}
                  onChange={(event: any) => toggle(test.id, event.currentTarget.checked)}
                />
              ))}
            </s-stack>
          </s-section>
        );
      })}
    </s-stack>
  );
}
