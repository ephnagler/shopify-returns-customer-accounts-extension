# Return notification edits

Shopify admin → Settings → Notifications → Customer notifications → Returns and cancellations.

These edits make two return emails speak to each kind of return. Staff approve, attach the
label, and refund. The right text goes out by itself. Each edit replaces one block of Shopify's
default template.

| Case | How the template knows | Approved email | Label email |
|---|---|---|---|
| Exchange | order metafield `custom.exchange_requested` (Flow 1) | free label, exchange order ships separately | same |
| Outside the US | shipping address country is not US | no label; send it yourself, customs steps | not sent (no label) |
| Store credit | order metafield `custom.store_credit_requested` (Flow 3) | refund as store credit | same |
| Standard | none of the above | refund to the card, minus the fee | same |

## How approval works

**Review return request** in admin has the fee (Summary > Return shipping, editable) and the
return shipping options: create a return label in Shopify, upload a return label (file or URL,
tracking number, carrier), or no shipping required. Staff select one, then **Approve**. For US
orders the label is attached at approval, so the approved email carries it with a **Print
return label** button. When the label is uploaded at approval, Shopify sends only the approved
email. **Return label created** goes out only for a label added later.

Shopify's default approved template shows the steps only with a label or a tracking number
(`{% if has_label_attached or has_tracking_number %}`). Orders outside the US use **No shipping
required**, so the default shows no steps and no address. The version below always shows them.

What return emails can read:

- Order metafields render. Use the plain form (`order.metafields.custom.key`), or `.value`.
- `return.name` can be empty. The setup below falls back to `order.name`.
- The item customer note and return reason are not available.

**The emails never write a fee.** Staff set the fee on each return before they approve.
Shopify's summary in the approved email shows that fee as "Return shipping". Notification Liquid
cannot read the app's settings, so a fee typed into a template goes out of date when Policy
rules change.

**Test with real returns, not Preview.** Preview uses a sample order with no metafields and a
US address, so it always shows the standard version. Use the seed orders: N (standard),
O (exchange), R (remote state), U (Canada). Request a return on one, approve it in admin, and
check the email.

## Shared setup (both templates)

Paste this right after the first line of each template (the `buyer_email_rtl` line):

```liquid
{%- comment -%} Returns app: which kind of return this is, and the return number (RMA). {%- endcomment -%}
{%- assign ret_rma = return.name | default: order.name -%}
{%- assign ret_address = order.shipping_address | default: shipping_address -%}
{%- assign ret_country = ret_address.country_code | default: 'US' -%}

{%- assign ret_international = false -%}
{%- if ret_country != 'US' -%}{%- assign ret_international = true -%}{%- endif -%}

{%- assign ret_exchange = false -%}
{%- if order.metafields.custom.exchange_requested.value == true or order.metafields.custom.exchange_requested == true -%}
  {%- assign ret_exchange = true -%}
{%- endif -%}

{%- assign ret_credit = false -%}
{%- if order.metafields.custom.store_credit_requested.value == true or order.metafields.custom.store_credit_requested == true -%}
  {%- assign ret_credit = true -%}
{%- endif -%}

{%- capture ret_refund_line -%}
  {%- if ret_exchange -%}
    When we receive the return, we refund the returned item. Your exchange order ships separately.
  {%- elsif ret_credit -%}
    When we receive the return, we add the refund to your account as store credit, minus any fee in this email. We send you an email within 1 to 2 days.
  {%- else -%}
    When we receive the return, we refund your original payment method, minus any fee in this email. We send you an email within 1 to 2 days.
  {%- endif -%}
{%- endcapture -%}
```

`ret_rma` is the return name (for example `#1001-R1`). If a template has no `return` object, it
falls back to the order number.

---

## 1. Return request approved

### Heading

Find:

```liquid
          <h2>Your return was approved</h2>
```

Replace with:

```liquid
          <h2>{% if ret_exchange %}Your exchange return was approved{% else %}Your return was approved{% endif %}</h2>
          <p class="return-approved__body">Your return number is {{ ret_rma }}.</p>
          {% if ret_exchange %}
            <p class="return-approved__body">Your return label is free because you placed an exchange order.</p>
          {% elsif ret_international %}
            <p class="return-approved__body">Send the return yourself. We do not send a return label for orders outside the US.</p>
          {% endif %}
```

### Instructions

Find the whole `<ol class="return-approved__instructions">` … `</ol>` block and replace it with:

```liquid
              <ol class="return-approved__instructions">
                <li class="return-approved__instruction-step">Pack the items neatly. Put a copy of the packing list in the box.</li>
                <li class="return-approved__instruction-step">Write your order number, {{ order.name }}, on the packing list.</li>
                {% if return.checkout_payment_collection_url %}
                  <li class="return-approved__instruction-step">Pay the outstanding balance.</li>
                {% endif %}
                {% if ret_international %}
                  <li class="return-approved__instruction-step">Write “Returned Goods” on the box and on the customs form.</li>
                  <li class="return-approved__instruction-step">Send the box, tracked and insured, to: [Your return address]. You pay for return shipping. Send it within 30 days after delivery.</li>
                {% else %}
                  <li class="return-approved__instruction-step">Wait for the email with your return label. Remove old labels from the box. Print the return label at actual size and attach it to the box.</li>
                  <li class="return-approved__instruction-step">
                    {% if return_delivery_first.carrier_name %}
                      Give the box to {% if buyer_email_rtl == true %}&rlm;&lrm;<span dir="auto" style="display: inline-block; unicode-bidi: isolate; font-size: inherit;">{% endif %}{{ return_delivery_first.carrier_name }}{% if buyer_email_rtl == true %}</span>&lrm;&rlm;{% endif %} within 30 days after delivery.
                    {% else %}
                      Give the box to the carrier on the label within 30 days after delivery.
                    {% endif %}
                  </li>
                {% endif %}
                {% if has_tracking_number %}
                  <li class="return-approved__instruction-step">Track your return to make sure we get it.</li>
                {% endif %}
                <li class="return-approved__instruction-step">{{ ret_refund_line }}</li>
              </ol>
```

---

## 2. Return label created (order-level)

Shopify sends this when staff attach the label. Orders outside the US get no label, so this
email only goes to US customers.

### Heading

Find:

```liquid
            <h2>Your return label is ready</h2>
```

Replace with:

```liquid
            <h2>{% if ret_exchange %}Your free return label is ready{% else %}Your return label is ready{% endif %}</h2>
            <p>Your return number is {{ ret_rma }}.{% if ret_exchange %} This label is free because you placed an exchange order.{% endif %}</p>
```

### Instructions

Find:

```liquid
            <ol>
              <li class="return-label__instruction-step">Pack the items you're returning.</li>
              <li class="return-label__instruction-step">Print your return label and attach it to the package. Cover any existing shipping labels.</li>
              <li class="return-label__instruction-step">Give the package to the carrier identified on the label.</li>
            </ol>
```

Replace with:

```liquid
            <ol>
              <li class="return-label__instruction-step">Pack the items neatly. Put a copy of the packing list in the box.</li>
              <li class="return-label__instruction-step">Write your order number, {{ order.name }}, on the packing list.</li>
              <li class="return-label__instruction-step">Remove old labels from the box. Print the return label at actual size and attach it to the box.</li>
              <li class="return-label__instruction-step">Give the box to the carrier on the label within 30 days after delivery.</li>
              <li class="return-label__instruction-step">{{ ret_refund_line }}</li>
            </ol>
```

---

## Notes

- **Fee amounts.** Shopify's return rules put the standard fee on every return. Staff change it
  for store credit, remote states, and exchanges before they approve, so the summary
  in the approved email shows the right fee. See Order rules in the app.
- **Flags are per order.** `exchange_requested` and `store_credit_requested` stay on. A later
  return on the same order gets the same wording.
- **Address and window.** The return address and "30 days" are typed here and in the app's
  international steps (Settings > UI copy). Change both when they change.
