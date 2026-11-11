import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceQuery, sectionCollection, literalPattern } from '../src/lib/workspace-query.ts';
import { pageKeys } from '../src/lib/navigation.ts';

test('every available list has server pagination; invalid ranges and pagination are rejected', () => {
  for (const section of pageKeys()) {
    if (!['cash_cards', 'overview', 'reports', 'cashier', 'salary', 'commission', 'products', 'product_groups', 'inventory'].includes(section)) assert.ok(sectionCollection[section], section);
    assert.equal(workspaceQuery(new URLSearchParams({ section })).section, section);
  }
  for (const input of ['page=0', 'pageSize=101', 'allocationPage=-1', 'section=unknown', 'actor=bad', 'from=2026-02-30', 'from=2026-10-22&to=2026-10-21']) {
    assert.throws(() => workspaceQuery(new URLSearchParams(input)), input);
  }
  const parsed = workspaceQuery(new URLSearchParams('section=cash&page=26&pageSize=20&spaId=foreign&actorId=foreign'));
  assert.equal(parsed.page, 26);
  assert.equal(parsed.spaId, undefined);
  assert.equal(parsed.actorId, undefined);
});

test('workspace search cannot inject regular expressions', () => {
  const term = '[VIP].* (a+b) $^\\';
  const regex = new RegExp(literalPattern(term), 'i');
  assert.equal(regex.test(term), true);
  assert.equal(regex.test('VIP random aaab'), false);
});
