import {API_VERSION, CUSTOMER_QUERY, type CustomerResult} from './graphql.ts';
import {testModeAllows, type ReturnPolicy} from './policy.ts';

const ENDPOINT = `shopify://customer-account/api/${API_VERSION}/graphql.json`;

// The orders list renders one Start return check per order, so a customer with many
// orders hits the Customer Account API rate limit ("Throttled"). A failed check hides
// the button, also on the order page opened right after. So wait and try again.
const THROTTLE_RETRIES = 3;

const isThrottled = (errors: {message?: string; extensions?: {code?: string}}[]) =>
  errors.some((error) => error.extensions?.code === 'THROTTLED' || /throttled/i.test(error.message ?? ''));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls the Customer Account API. Shopify adds the customer's auth. Retries when throttled. */
export async function customerAccountQuery<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query, variables}),
    });
    const json = await response.json();
    if (json.errors?.length) {
      if (attempt < THROTTLE_RETRIES && isThrottled(json.errors)) {
        // 1s, 2s, 4s, with jitter so the checks on one page do not retry together.
        await wait(1000 * 2 ** attempt + Math.random() * 1000);
        continue;
      }
      throw new Error(json.errors.map((error: {message: string}) => error.message).join('; '));
    }
    return json.data as T;
  }
}

/**
 * Rules about the signed-in customer, not the order:
 * - custom.no_returns on the customer: staff blocked all their returns.
 * - Test mode (Policy rules): only listed emails.
 * If the query fails, test mode stays closed and the customer block stays open:
 * a broken check must not hide returns from every customer after launch.
 */
export async function customerAllowed(policy: ReturnPolicy): Promise<boolean> {
  try {
    const data = await customerAccountQuery<CustomerResult>(CUSTOMER_QUERY, {withEmail: policy.testMode});
    if (data.customer?.noReturns?.value === 'true') return false;
    return testModeAllows(policy, data.customer?.emailAddress?.emailAddress);
  } catch (error) {
    console.error('[returns] customer check failed', error);
    return !policy.testMode;
  }
}

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface FinancialSummary {
  returnSubtotalSet: {presentmentMoney: Money};
  returnShippingFeeSubtotalSet: {presentmentMoney: Money} | null;
  restockingFeeSubtotalSet: {presentmentMoney: Money} | null;
  returnTotalTaxSet: {presentmentMoney: Money};
  returnTotalSet: {presentmentMoney: Money};
}

export interface ReturnCalculateResult {
  returnCalculate: {financialSummary: FinancialSummary} | null;
}

export interface OrderRequestReturnResult {
  orderRequestReturn: {
    return: {id: string; name: string; status: string} | null;
    userErrors: {field: string[] | null; message: string; code: string | null}[];
  };
}
