import mongoose from 'mongoose';
import { connect } from '../src/lib/db';
import { allModels, Spa, User, Control, Migration } from '../src/lib/models';
import { hashPassword } from '../src/lib/password';
async function setup() {
  await connect();
  // Additive migration: create collections/indexes; never drop or rewrite legacy data.
  for (const model of allModels) { await model.createCollection(); await model.createIndexes(); }
  const password = process.env.SEED_OWNER_PASSWORD || '';
  const email = (process.env.SEED_OWNER_EMAIL || '').trim().toLowerCase();
  if (!email || password.length < 12) throw new Error('Cần SEED_OWNER_EMAIL và SEED_OWNER_PASSWORD >= 12 ký tự.');
  const existing = await User.findOne({ email });
  if (!existing) {
    await mongoose.connection.transaction(async session => {
      const [spa] = await Spa.create([{ name: process.env.SEED_SPA_NAME || 'SpaCare' }], { session });
      await Control.create([{ spaId: spa._id, revision: 0 }], { session });
      await User.create([{ spaId: spa._id, name: process.env.SEED_OWNER_NAME || 'Chủ spa', email, passwordHash: hashPassword(password), role: 'OWNER', cashier: true }], { session });
    });
  }
  await Migration.updateOne({ version: 1 }, { $setOnInsert: { appliedAt: new Date() } }, { upsert: true });
  console.log('Đã tạo collections/indexes và tài khoản chủ spa nếu chưa có. Không đặt lại mật khẩu tài khoản đã tồn tại.');
}
setup().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
