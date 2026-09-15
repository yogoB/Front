import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, DATA_BUCKETS, FEE_BUCKETS } from '../src/catalog-data.js';

test('mock catalog is well-formed for the light flow', () => {
  const tierIds = new Set();
  for (const s of CATALOG) {
    assert.ok(s.tiers.length >= 1, `${s.name} needs a tier`);
    for (const t of s.tiers) {
      assert.ok(Number.isInteger(t.price) && t.price > 0, `${s.name}/${t.name} price must be positive int`);
      assert.ok(!tierIds.has(t.id), `duplicate tier id ${t.id}`);
      tierIds.add(t.id);
    }
  }
});

test('range buckets carry a positive integer representative for BE (monthlyDataGb)', () => {
  for (const list of [DATA_BUCKETS, FEE_BUCKETS])
    for (const b of list)
      assert.ok(Number.isInteger(b.rep) && b.rep > 0, `${b.label} rep must be positive int`);
  // representative gb is what /recommendations receives; keep it in Java int range and non-skippable-safe
  assert.deepEqual(DATA_BUCKETS.map(b => b.rep), [2, 4, 10, 30, 80, 100]);
});
