import mongoose from 'mongoose';
import { connect } from '../src/lib/db';
import { SharedSaleCommission } from '../src/lib/models';
import { assertWritesAllowed } from '../src/lib/write-freeze.ts';
try {
  assertWritesAllowed();
  await connect();
  await SharedSaleCommission.createCollection();
  await SharedSaleCommission.createIndexes();
  console.log('Đã tạo sổ chia hoa hồng và indexes. Không sửa/xóa dữ liệu hoặc indexes cũ.');
} catch {
  console.error('Chưa khởi tạo được sổ chia hoa hồng. Kiểm tra kết nối và quyền tạo collection/index.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
