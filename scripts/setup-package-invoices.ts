import mongoose from 'mongoose';
import { connect, DatabaseUnavailableError } from '../src/lib/db';
import { openingOwner, checkOpeningTarget } from '../src/lib/opening-balances';
import { seedOwnerConfig } from '../src/lib/seed-owner';
import { migratePackageInvoiceIndex, ensureGroupedPackageIndex } from '../src/lib/package-invoice-indexes';
import { DomainError } from '../src/lib/rules';
const timeout=setTimeout(()=>{console.error('Kết nối quá thời gian. Chưa xác nhận được kết quả; chạy --check trước khi thử ghi lại.');process.exit(1);},30000);
try {
 const database=new URL(process.env.MONGODB_URI || '').pathname.slice(1);
 checkOpeningTarget(process.env.MONGODB_URI || '',database);
 await connect();await openingOwner(seedOwnerConfig(process.env));
 await migratePackageInvoiceIndex();await ensureGroupedPackageIndex();
 console.log('Đã cập nhật index hóa đơn nhiều gói. Không thay đổi chứng từ hoặc liệu trình.');
}catch(error){
 console.error(error instanceof DatabaseUnavailableError ? error.code : error instanceof DomainError ? error.message : 'Không cập nhật được index. Không xóa dữ liệu.');process.exitCode=1;
}finally{clearTimeout(timeout);await mongoose.disconnect();}
