import {test} from 'node:test';
import assert from 'node:assert/strict';

import {
  COPY_FIELDS,
  interpolate,
  LIST_FIELDS,
  missingPlaceholders,
  parseCopy,
  POLICY_ITEMS_KEY,
  policyLines,
} from '../shared/returns/copy.ts';
import buttonDefaults from '../extensions/return-item/locales/en.default.json' with {type: 'json'};
import pageDefaults from '../extensions/return-page/locales/en.default.json' with {type: 'json'};

function flatten(source: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) =>
    value && typeof value === 'object' ? flatten(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

test('every editable key has a locale default', () => {
  const keys = new Set([...flatten(buttonDefaults), ...flatten(pageDefaults)]);
  for (const {key} of COPY_FIELDS) {
    if (key in LIST_FIELDS) continue;
    assert.ok(keys.has(key), `${key} has no default in a locale file`);
  }
  for (const key of Object.values(LIST_FIELDS).flat()) assert.ok(keys.has(key), key);
});

test('every locale string is editable (list lines via their list field)', () => {
  const editable = new Set([...COPY_FIELDS.map((f) => f.key), ...Object.values(LIST_FIELDS).flat()]);
  const missing = [...flatten(buttonDefaults), ...flatten(pageDefaults)].filter((key) => !editable.has(key));
  assert.deepEqual(missing, []);
});

test('parseCopy ignores bad JSON, non-objects, and blank values', () => {
  assert.deepEqual(parseCopy(null), {});
  assert.deepEqual(parseCopy('not json'), {});
  assert.deepEqual(parseCopy('["a"]'), {});
  assert.deepEqual(parseCopy('{"a": "x", "b": "  ", "c": 3}'), {a: 'x'});
});

test('interpolate fills known placeholders and leaves unknown ones', () => {
  assert.equal(interpolate('Fee {{fee}} for {{ name }}', {fee: '$25.00', name: '#1001'}), 'Fee $25.00 for #1001');
  assert.equal(interpolate('Keep {{other}}', {fee: '$25.00'}), 'Keep {{other}}');
});

test('missingPlaceholders reports placeholders dropped from an edit', () => {
  assert.deepEqual(missingPlaceholders('We deduct {{fee}}.', 'We deduct a fee.'), ['fee']);
  assert.deepEqual(missingPlaceholders('We deduct {{fee}}.', 'A {{fee}} fee applies.'), []);
});

test('policyLines uses edited lines, else defaults', () => {
  assert.deepEqual(policyLines({}, ['a', 'b']), ['a', 'b']);
  assert.deepEqual(policyLines({[POLICY_ITEMS_KEY]: ' one \n\n two '}, ['a']), ['one', 'two']);
  assert.deepEqual(policyLines({[POLICY_ITEMS_KEY]: '  \n '}, ['a']), ['a']);
});

test('every {{variable}} in a default is listed below its field', async () => {
  const {readFileSync} = await import('node:fs');
  const {COPY_FIELDS, LIST_FIELDS, placeholdersIn} = await import('../shared/returns/copy.ts');
  const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const flat = (source: Record<string, unknown>, prefix = ''): Record<string, string> =>
    Object.entries(source).reduce<Record<string, string>>((out, [key, value]) => {
      if (value && typeof value === 'object') Object.assign(out, flat(value as Record<string, unknown>, `${prefix}${key}.`));
      else out[`${prefix}${key}`] = String(value);
      return out;
    }, {});
  const defaults = {
    ...flat(read('../extensions/return-item/locales/en.default.json')),
    ...flat(read('../extensions/return-page/locales/en.default.json')),
  };
  for (const field of COPY_FIELDS) {
    const text = (LIST_FIELDS[field.key] ?? [field.key]).map((key) => defaults[key] ?? '').join('\n');
    for (const name of placeholdersIn(text)) {
      assert.ok(field.variables && name in field.variables, `${field.key} uses {{${name}}} but does not list it`);
    }
  }
});
