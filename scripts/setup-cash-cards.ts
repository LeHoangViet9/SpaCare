import mongoose from 'mongoose';
import { connect } from '../src/lib/db';
import { CashCard, CashCardUse } from '../src/lib/models';
try {
  const uri = new URL(process.env.MONGODB_URI || '');
  if (process.env.VERCEL_ENV === 'production' || !['/spacare_dev', '/spacare_test'].includes(uri.pathname))
    throw new Error('BLOCKED_TARGET');
  await connect();
  for (const model of [CashCard, CashCardUse]) { await model.createCollection(); await model.createIndexes(); }
  console.log('Đã thêm collections/indexes thẻ tiền trong database dev/test. Không sửa dữ liệu cũ.');
} catch {
  console.error('Chưa tạo được indexes thẻ tiền. Chỉ chạy trên spacare_dev hoặc spacare_test; kiểm tra kết nối và quyền.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
