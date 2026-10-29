import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { connect, DatabaseUnavailableError } from '../src/lib/db';
import { User } from '../src/lib/models';
import { seedOwnerConfig, SeedOwnerError } from '../src/lib/seed-owner';
import { planCatalog, type SheetRow } from '../src/lib/catalog-import-plan';
import { importCatalog } from '../src/lib/catalog-import';
import { DomainError } from '../src/lib/rules';
import { assertWritesAllowed } from '../src/lib/write-freeze.ts';

async function main() {
  assertWritesAllowed();
  const args = process.argv.slice(2);
  const options = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--write', '--use-min-price'].includes(arg)) {
      if (flags.has(arg)) throw new SeedOwnerError('Tham số bị lặp.'); flags.add(arg);
    } else if (['--file', '--database', '--dns'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) {
      if (options.has(arg)) throw new SeedOwnerError('Tham số bị lặp.'); options.set(arg, args[++i]);
    } else throw new SeedOwnerError('Tham số không hợp lệ. Dùng --file đường-dẫn.xlsx [--use-min-price] [--write --database tên-db] [--dns 1.1.1.1,8.8.8.8].');
  }
  const file = options.get('--file');
  if (!file || extname(file).toLowerCase() !== '.xlsx') throw new SeedOwnerError('Cần --file đường-dẫn.xlsx.');
  if (process.platform !== 'win32') throw new SeedOwnerError('Lệnh nhập XLSX này chạy trên Windows PowerShell trong IntelliJ.');
  const path = resolve(file);
  let fileInfo;
  try { fileInfo = statSync(path); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') throw new SeedOwnerError('Không tìm thấy file Excel. Đặt file vào đường dẫn --file đã chọn, hoặc dùng đường dẫn đầy đủ tới file đã tải về.');
    throw new SeedOwnerError('Không truy cập được file Excel. Kiểm tra quyền đọc file và đường dẫn --file.');
  }
  if (!fileInfo.isFile()) throw new SeedOwnerError('--file phải trỏ tới file Excel, không phải thư mục.');
  if (fileInfo.size > 10 * 1024 * 1024) throw new SeedOwnerError('File tối đa 10 MB.');
  let rows: SheetRow[];
  try {
    const reader = readFileSync(fileURLToPath(new URL('./read-catalog-xlsx.ps1', import.meta.url)), 'utf8').replace(/^\uFEFF/, '');
    rows = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `& { ${reader} } -FilePath $env:SPACARE_CATALOG_FILE`],
    { env: { ...process.env, SPACARE_CATALOG_FILE: path }, encoding: 'utf8', timeout: 30000, maxBuffer: 12 * 1024 * 1024, windowsHide: true }).replace(/^\uFEFF/, ''));
  } catch { throw new SeedOwnerError('Không đọc được Excel. Dùng file .xlsx không có công thức, tối đa 1000 dòng/10 MB.'); }
  const plan = planCatalog(rows, flags.has('--use-min-price'));
  console.table(plan.entries.map(entry => ({ dòng: entry.row, nhóm: entry.service.category, dịch_vụ: entry.service.name,
    giá_lẻ: entry.service.price, hoa_hồng: entry.service.commission, giá_gói: entry.package?.price ?? '', thời_hạn: entry.package ? '36 tháng từ ngày mua' : '' })));
  for (const error of plan.errors) console.error(error);
  if (plan.errors.length) throw new SeedOwnerError('Chưa nhập dữ liệu: cần sửa các dòng lỗi trên.');
  console.log(`Xem trước: ${plan.entries.length} dịch vụ, ${plan.entries.filter(entry => entry.package).length} gói. Không tạo hóa đơn/thu chi/hoa hồng phát sinh.`);
  console.log('Giá theo khoảng dùng giá mặc định đã chọn; khoảng gốc lưu trong audit, chưa có trường khoảng giá trên UI. Khi bán nhập giá thực tế.');
  if (!flags.has('--write')) { console.log('Chỉ xem trước, chưa kết nối/ghi database. Thêm --write --database tên-db khi đã đối chiếu.'); return; }
  const database = options.get('--database');
  if (!database || !/^[a-zA-Z0-9_-]+$/.test(database)) throw new SeedOwnerError('Cần --database tên-db trùng database đích.');
  const uri = new URL(process.env.MONGODB_URI || '');
  if (decodeURIComponent(uri.pathname.slice(1)) !== database) throw new SeedOwnerError('Tên database không khớp MONGODB_URI. Chưa ghi dữ liệu.');
  if (options.has('--dns')) dns.setServers(options.get('--dns')!.split(','));
  const owner = seedOwnerConfig(process.env);
  await connect();
  const account = await User.findOne(owner.phone ? { phone: owner.phone } : { email: owner.email });
  if (!account) throw new SeedOwnerError('Không tìm thấy tài khoản chủ đã cấu hình.');
  const result = await importCatalog(String(account._id), owner.password, plan.entries);
  console.log('Đã nhập thành công:', result);
}
main().catch(error => {
  if (error instanceof SeedOwnerError || error instanceof DomainError) console.error(error.message);
  else if (error instanceof DatabaseUnavailableError) console.error('Không kết nối được database:', error.code);
  else console.error('Không thể nhập danh mục. Kiểm tra file, quyền database và indexes; không xóa dữ liệu.', { code: Number.isSafeInteger(error?.code) ? error.code : 'UNKNOWN' });
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
