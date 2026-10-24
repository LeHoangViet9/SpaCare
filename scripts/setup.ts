import mongoose from 'mongoose';
import { DatabaseUnavailableError, connect } from '../src/lib/db';
import { allModels, Spa, User, Control, Migration, StaffLeave } from '../src/lib/models';
import { hashPassword } from '../src/lib/password';
import { migrateUserIndexes } from '../src/lib/user-indexes';
import { seedOwnerConfig, checkSeedOwnerMatches, SeedOwnerError } from '../src/lib/seed-owner';
let stage = 'validate-seed';
async function setup() {
  const owner = seedOwnerConfig(process.env);
  stage = 'connect';
  await connect();
  stage = 'user-indexes';
  await migrateUserIndexes();
  // Additive migration: create collections/indexes; never drop or rewrite legacy data.
  for (const model of allModels) {
    stage = `collection:${model.modelName}`;
    await model.createCollection();
    stage = `indexes:${model.modelName}`;
    await model.createIndexes();
  }
  stage = 'leave-indexes';
  // Upgrade only the old leave uniqueness constraint, after the new index exists.
  // No documents are changed; period permits distinct AM/PM requests on one day.
  const indexes = await StaffLeave.collection.indexes();
  const legacy = indexes.find(i => i.unique && JSON.stringify(i.key) === JSON.stringify({spaId:1,staffId:1,day:1}));
  if (legacy?.name) await StaffLeave.collection.dropIndex(legacy.name);
  stage = 'find-owner';
  const identities = [owner.phone ? { phone: owner.phone } : undefined, owner.email ? { email: owner.email } : undefined].filter(value => value !== undefined);
  const existing = await User.find({ $or: identities });
  if (existing.length) {
    checkSeedOwnerMatches(owner, existing);
  } else {
    if (await User.exists({})) throw new SeedOwnerError('Database đã có tài khoản. Không tạo thêm spa từ thông tin seed mới.');
    stage = 'create-owner-transaction';
    await mongoose.connection.transaction(async session => {
      const [spa] = await Spa.create([{ name: owner.spaName }], { session });
      await Control.create([{ spaId: spa._id, revision: 0 }], { session });
      await User.create([{ spaId: spa._id, name: owner.name,
        ...(owner.phone ? { phone: owner.phone } : {}), ...(owner.email ? { email: owner.email } : {}),
        passwordHash: hashPassword(owner.password), role: 'OWNER', cashier: true }], { session });
    });
  }
  stage = 'record-migration';
  await Migration.updateOne({ version: 1 }, { $setOnInsert: { appliedAt: new Date() } }, { upsert: true });
  console.log('Đã tạo collections/indexes và tài khoản chủ spa nếu chưa có. Không đặt lại mật khẩu tài khoản đã tồn tại.');
}
setup().catch(e => {
  if (e instanceof SeedOwnerError) console.error(e.message);
  else {
    // Never log driver messages: they may include credentials, URI or duplicate account values.
    const code = e instanceof DatabaseUnavailableError ? e.code
      : Number.isSafeInteger(e?.code) ? e.code : 'UNKNOWN';
    console.error('Không thể khởi tạo database.', { stage, code });
    if (code === 13) console.error('Database user thiếu quyền. Kiểm tra quyền readWrite trên đúng database Atlas.');
    if (code === 11000) console.error('Dữ liệu trùng với unique index. Không xóa dữ liệu; cần kiểm tra index tại bước báo lỗi.');
    if (code === 85 || code === 86) console.error('Cấu hình index xung đột với index đã có. Không xóa dữ liệu; cần kiểm tra migration index.');
  }
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
