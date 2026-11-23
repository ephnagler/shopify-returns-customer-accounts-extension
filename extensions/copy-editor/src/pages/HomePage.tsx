import {useEffect, useState} from 'preact/hooks';

import {DEFAULT_POLICY, parsePolicy, POLICY_KEY, POLICY_NAMESPACE, type ReturnPolicy} from '../../../../shared/returns/policy.ts';
import {PageStack, Tabs} from '../components/Tabs.tsx';
import TestList from '../components/TestList.tsx';
import {
  CUSTOMER_JOURNEY,
  type DocBlock,
  DocBlocks,
  FLOW_WORKFLOWS,
  orderRules,
  PROCESS_EXCHANGE,
  PROCESS_RETURN,
} from '../content.tsx';

type HomeTab = 'journey' | 'return' | 'exchange' | 'rules' | 'flows' | 'tests';

const TABS: {key: HomeTab; title: string}[] = [
  {key: 'journey', title: 'Customer journey'},
  {key: 'return', title: 'Processing a return'},
  {key: 'exchange', title: 'Processing an exchange'},
  {key: 'rules', title: 'Order rules'},
  {key: 'flows', title: 'Flow workflows'},
  {key: 'tests', title: 'Test list'},
];

const content = (policy: ReturnPolicy): Record<Exclude<HomeTab, 'tests'>, DocBlock[]> => ({
  journey: CUSTOMER_JOURNEY,
  return: PROCESS_RETURN,
  exchange: PROCESS_EXCHANGE,
  rules: orderRules(policy),
  flows: FLOW_WORKFLOWS,
});

const POLICY_QUERY = `#graphql
  query ShopPolicy {
    shop {
      policy: metafield(namespace: "${POLICY_NAMESPACE}", key: "${POLICY_KEY}") {
        value
      }
    }
  }
`;

/** ?tab=flows (from the Settings checklist) opens that tab. */
function initialTab(): HomeTab {
  const requested = new URLSearchParams(location.search).get('tab');
  return TABS.some((tab) => tab.key === requested) ? (requested as HomeTab) : 'journey';
}

/** Home: how staff use the app, from the customer's side and from admin. */
export default function HomePage() {
  const [tab, setTab] = useState<HomeTab>(initialTab);
  // Order rules show the saved Policy rules. Until they load (or if the load
  // fails) the tab shows the defaults, which is what the app uses then too.
  const [policy, setPolicy] = useState<ReturnPolicy>(DEFAULT_POLICY);
  useEffect(() => {
    shopify
      .query(POLICY_QUERY)
      .then((result) => {
        const {data} = result as {data?: {shop: {policy: {value: string} | null}}};
        setPolicy(parsePolicy(data?.shop.policy?.value));
      })
      .catch((error) => console.error('[copy-editor] policy load failed', error));
  }, []);
  return (
    <s-page heading="Returns & Exchanges">
      <s-button slot="secondary-actions" href="/settings">
        Settings
      </s-button>
      <PageStack>
        <Tabs heading="Docs" tabs={TABS} current={tab} onSelect={setTab} />
        <s-banner tone="info">
          Customers start returns and exchanges from their order page. You approve and finish each one in Shopify.
        </s-banner>
        {tab === 'tests' ? <TestList /> : <DocBlocks blocks={content(policy)[tab]} />}
      </PageStack>
    </s-page>
  );
}
