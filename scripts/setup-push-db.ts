import mongoose from 'mongoose';
import { connect } from '../src/lib/db';
import { Notification, PushDevice } from '../src/lib/models';

try {
  await connect();
  for (const model of [Notification, PushDevice]) {
    await model.createCollection();
    await model.createIndexes();
  }
  console.log('Đã tạo collections/indexes thông báo; không seed hoặc sửa dữ liệu cũ.');
} catch {
  console.error('Chưa tạo được indexes thông báo. Kiểm tra kết nối và quyền database.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
