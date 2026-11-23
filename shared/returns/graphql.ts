// Customer Account API operations used by both targets.
// Pinned to the extension's api_version in shopify.extension.toml.
export const API_VERSION = '2026-10';

// Query cost. Shopify charges each query its worst case up front, from the
// first: limits, and each customer gets 7,500 points per app (refill 100/s).
// The orders list runs one button check per order, so the limits stay small.
// Measured with Shopify-GraphQL-Cost-Debug: the button query asks under 100
// points per order, under 5,000 for one 50-order list page.
// - Fulfillments and events newest first: most orders ship in 1 or 2. Past 5,
//   the oldest drop out, and those are past the return window anyway.
// - 50 line items: far above a typical order. The button and the return page use
//   the same limit, so they always agree on which items are returnable.
const ITEM_LIMIT = 50;

const ORDER_RULE_FIELDS = `
  processedAt
  exchangeOrder: metafield(namespace: "custom", key: "exchange_order") {
    value
  }
  noReturns: metafield(namespace: "custom", key: "no_returns") {
    value
  }
  fulfillments(first: 5, sortKey: CREATED_AT, reverse: true) {
    nodes {
      events(first: 5, sortKey: HAPPENED_AT, reverse: true) {
        nodes {
          status
          happenedAt
        }
      }
      fulfillmentLineItems(first: ${ITEM_LIMIT}) {
        nodes {
          lineItem {
            id
          }
        }
      }
    }
  }
`;

const SHOP_FIELDS = `
  shop {
    copy: metafield(namespace: "$app", key: "copy") {
      value
    }
    policy: metafield(namespace: "$app", key: "policy") {
      value
    }
  }
`;

// The Start return button (orders list and order page). Only what showReturnButton reads.
export const ORDER_BUTTON_QUERY = `#graphql
  query OrderReturnButton($orderId: ID!) {
    ${SHOP_FIELDS}
    order(id: $orderId) {
      id
      ${ORDER_RULE_FIELDS}
      returnInformation {
        returnableLineItems(first: ${ITEM_LIMIT}) {
          nodes {
            quantity
            lineItem {
              id
              sku
            }
          }
        }
      }
    }
  }
`;

// The return page: runs once per visit, so it can ask for the full item details.
export const ORDER_RETURN_QUERY = `#graphql
  query OrderReturn($orderId: ID!) {
    ${SHOP_FIELDS}
    order(id: $orderId) {
      id
      name
      ${ORDER_RULE_FIELDS}
      shippingAddress {
        zoneCode
        territoryCode
      }
      returnInformation {
        hasReturnShippingFee
        nonReturnableSummary {
          nonReturnableReasons
        }
        returnableLineItems(first: ${ITEM_LIMIT}) {
          nodes {
            quantity
            lineItem {
              id
              title
              variantTitle
              sku
              vendor
              productType
              image {
                url
                altText
              }
              suggestedReturnReasonDefinitions(first: 25) {
                nodes {
                  id
                  name
                  deleted
                }
              }
            }
          }
        }
        nonReturnableLineItems(first: ${ITEM_LIMIT}) {
          nodes {
            quantity
            lineItem {
              id
              title
              variantTitle
              sku
              image {
                url
                altText
              }
            }
          }
        }
      }
    }
  }
`;

// The signed-in customer: staff can block their returns (custom.no_returns on the
// customer), and test mode needs their email. Email is level 2 protected customer
// data, so it is only asked for in test mode. Kept out of ORDER_RETURN_QUERY so a
// failure here never breaks the order checks (see customerAllowed in api.ts).
export const CUSTOMER_QUERY = `#graphql
  query ReturnCustomer($withEmail: Boolean!) {
    customer {
      noReturns: metafield(namespace: "custom", key: "no_returns") {
        value
      }
      emailAddress @include(if: $withEmail) {
        emailAddress
      }
    }
  }
`;

export interface CustomerResult {
  customer: {
    noReturns: {value: string} | null;
    emailAddress?: {emailAddress: string | null} | null;
  } | null;
}

export const RETURN_CALCULATE_QUERY = `#graphql
  query ReturnCalculate($orderId: ID!, $returnLineItems: [CalculateReturnLineItemInput!]!) {
    returnCalculate(input: {orderId: $orderId, returnLineItems: $returnLineItems}) {
      financialSummary {
        returnSubtotalSet {
          presentmentMoney {
            amount
            currencyCode
          }
        }
        returnShippingFeeSubtotalSet {
          presentmentMoney {
            amount
            currencyCode
          }
        }
        restockingFeeSubtotalSet {
          presentmentMoney {
            amount
            currencyCode
          }
        }
        returnTotalTaxSet {
          presentmentMoney {
            amount
            currencyCode
          }
        }
        returnTotalSet {
          presentmentMoney {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

export const ORDER_REQUEST_RETURN_MUTATION = `#graphql
  mutation OrderRequestReturn($orderId: ID!, $requestedLineItems: [RequestedLineItemInput!]!) {
    orderRequestReturn(orderId: $orderId, requestedLineItems: $requestedLineItems) {
      return {
        id
        name
        status
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;
