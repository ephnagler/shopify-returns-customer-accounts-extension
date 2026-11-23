import assert from 'node:assert/strict';
import {test} from 'node:test';

import {parseChecks, TEST_GROUPS} from '../extensions/copy-editor/src/testList.ts';

test('every test id is unique', () => {
  const ids = TEST_GROUPS.flatMap((group) => group.cases.map((item) => item.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('parseChecks keeps dates and drops bad values', () => {
  assert.deepEqual(parseChecks('{"a":"2026-11-12","b":true}'), {a: '2026-11-12'});
  assert.deepEqual(parseChecks('not json'), {});
  assert.deepEqual(parseChecks('[1]'), {});
  assert.deepEqual(parseChecks(null), {});
});
