import { assertDatabaseTarget } from '../src/lib/production-safety.mjs';
import mongoose from 'mongoose';
import { connect } from '../src/lib/db';
import { migrateUserIndexes } from '../src/lib/user-indexes';
try {
  assertDatabaseTarget(process.env.MONGODB_URI || '', process.env, 'maintenance');
  await connect('maintenance'); await migrateUserIndexes();
  console.log('Đã cập nhật indexes tài khoản cho số điện thoại; giữ nguyên toàn bộ tài khoản cũ.');
} catch {
  console.error('Chưa cập nhật được indexes tài khoản. Kiểm tra kết nối/quyền và dữ liệu trùng; không xóa dữ liệu để xử lý lỗi.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
