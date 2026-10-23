import assert from 'node:assert/strict';
import { allModels, Day } from '../src/lib/models';
import { readWorkspace } from '../src/lib/workspace-read';
import { workspaceQuery } from '../src/lib/workspace-query';
import { spaDay } from '../src/lib/rules';
const actor = { id: 'a'.repeat(24), spaId: 'b'.repeat(24), role: 'OWNER' as const, name: 'Owner', cashier: true };
const todayDay = { _id: 'c'.repeat(24), spaId: actor.spaId, day: spaDay(), opening: 500000, status: 'OPEN' };
const query = () => {
  const q: any = { select: () => q, sort: () => q, skip: () => q, limit: () => q,
    lean: async () => [], distinct: async () => [] };
  return q;
};
for (const model of allModels) {
  (model as any).find = () => query();
  (model as any).countDocuments = async () => 0;
  (model as any).aggregate = async () => [];
}
(Day as any).findOne = (scope: any) => {
  assert.deepEqual(scope, { spaId: actor.spaId, day: spaDay() });
  return { lean: async () => todayDay };
};
(Day as any).find = (filter: any) => {
  assert.deepEqual(filter.$and[1], {}, 'Hidden search must not filter out day records');
  return query();
};
const data = await readWorkspace(actor, workspaceQuery(new URLSearchParams({ section: 'days', search: 'old-invoice-id', status: 'CLOSED' })));
assert.equal(data.pages.days.total, 0);
assert.deepEqual(data.todayDay, todayDay, 'Today status must remain available when list filters return no rows');
