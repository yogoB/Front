import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, DATA_BUCKETS, FEE_BUCKETS, CARRIERS } from '../src/catalog-data.js';
import { mockRecommendation, keptSubs } from '../src/recommend-mock.js';

test('mock recommendation: current is the input sum, kept-only, first sub bundled free', () => {
  const input = { fee: { amount: 40000 }, subs: [
    { name: '넷플릭스', price: 13500, disposition: '유지' },
    { name: '유튜브', price: 14900, disposition: '유지' },
    { name: '디즈니', price: 9900, disposition: '해지' },
  ] };
  assert.equal(keptSubs(input).length, 2, '해지는 제외');
  const r = mockRecommendation(input);
  assert.equal(r.currentTotal, 40000 + 13500 + 14900, '현재 = 통신비 + 유지 구독 합계');
  assert.equal(r.firstSub.name, '넷플릭스');
  assert.ok(r.recTotal < r.currentTotal, '추천이 현재보다 싸야 데모가 의미 있음');
});

test('carriers include majors and flag MVNO brands for BE mapping', () => {
  const names = CARRIERS.map(c => c.name);
  for (const major of ['SKT', 'KT', 'LG U+']) assert.ok(names.includes(major), `missing ${major}`);
  assert.ok(CARRIERS.some(c => c.mvno), 'need at least one 알뜰폰 brand flagged');
  assert.ok(CARRIERS.filter(c => c.mvno).every(c => c.name), 'mvno entries need names');
});

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
