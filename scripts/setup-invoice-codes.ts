import mongoose from 'mongoose';
import { connect } from '../src/lib/db';
import { backfillInvoiceCodes } from '../src/lib/invoice-code-migration';
import { assertWritesAllowed } from '../src/lib/write-freeze.ts';
try {
  assertWritesAllowed();
  await connect();
  const count = await backfillInvoiceCodes();
  console.log(`Đã cấp mã HD cho ${count} hóa đơn. Không thay đổi tiền, thanh toán hoặc ID liên kết.`);
} catch {
  console.error('Chưa cấp được mã hóa đơn. Kiểm tra kết nối, quyền database và bộ đếm. Không xóa dữ liệu.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
