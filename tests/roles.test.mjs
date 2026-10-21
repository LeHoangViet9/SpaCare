import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../src/lib/models.ts';

test('quản lý chưa là vai trò hợp lệ: schema từ chối MANAGER, không tự cấp quyền', async () => {
  const base = { spaId: new mongoose.Types.ObjectId(), name: 'Role test', email: 'roles@example.test', passwordHash: 'fixture-not-a-real-password' };
  for (const role of ['MANAGER', 'ADMIN', 'owner']) {
    await assert.rejects(new User({ ...base, role }).validate(), error => error.errors?.role?.kind === 'enum');
  }
  for (const role of ['OWNER', 'STAFF']) await new User({ ...base, role }).validate();
});
