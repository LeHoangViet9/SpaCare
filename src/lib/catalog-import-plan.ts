import { z } from 'zod';
import { createHash } from 'node:crypto';

export const catalogServiceInput = z.object({
  name: z.string().trim().min(1).max(500), category: z.string().trim().min(1).max(100),
  price: z.number().int().positive().max(1_000_000_000_000),
  commission: z.number().int().min(0).max(1_000_000_000_000),
});
export const catalogEntryInput = z.object({
  row: z.number().int().positive(), service: catalogServiceInput,
  source: z.object({ min: z.number().int().positive(), max: z.number().int().positive(), notes: z.string().max(2000) }),
  package: z.object({ name: z.string().min(1).max(500), price: z.number().int().positive().max(1_000_000_000_000),
    packageType: z.literal('TIME'), durationMonths: z.literal(36) }).optional(),
});
export type CatalogEntry = z.infer<typeof catalogEntryInput>;
export type SheetRow = { row: number; cells: Record<string, string> };
export const catalogNameKey = (name: string) => name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
export const catalogRowKey = (entry: CatalogEntry) => 'catalog-v1:' + createHash('sha256').update(JSON.stringify([catalogNameKey(entry.service.category), catalogNameKey(entry.service.name)])).digest('hex');
export const catalogFingerprint = (entry: CatalogEntry) => createHash('sha256').update(JSON.stringify({ service: entry.service, source: entry.source, package: entry.package })).digest('hex');
function amount(value: string, label: string): number {
  // XLSX numbers are unformatted numeric values; text must be plain VND integers.
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value)) || Number(value) > 1_000_000_000_000)
    throw new Error(`${label}: cần số nguyên VNĐ, không nhập ký hiệu tiền.`);
  return Number(value);
}
export function planCatalog(rows: SheetRow[], useMinPrice = false) {
  const errors: string[] = [], entries: CatalogEntry[] = [];
  const headers = rows[0]?.cells || {};
  const columns = new Map(Object.entries(headers).map(([column, title]) => [title.trim(), column]));
  for (const title of ['Nhóm dịch vụ', 'Tên dịch vụ', 'Giá từ (VNĐ)', 'Giá đến (VNĐ)', 'Hoa hồng (VNĐ)', 'Bảo hành', 'Ghi chú'])
    if (!columns.has(title)) errors.push(`Thiếu cột ${title}.`);
  if (errors.length) return { entries, errors };
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    const get = (title: string) => (row.cells[columns.get(title) || ''] || '').trim();
    if (!Object.values(row.cells).some(value => value.trim())) continue;
    try {
      const category = get('Nhóm dịch vụ'), originalName = get('Tên dịch vụ'), notes = get('Ghi chú');
      const min = amount(get('Giá từ (VNĐ)'), 'Giá từ'), max = amount(get('Giá đến (VNĐ)'), 'Giá đến');
      if (min <= 0 || max < min) throw new Error('Khoảng giá không hợp lệ.');
      const commission = amount(get('Hoa hồng (VNĐ)'), 'Hoa hồng');
      const warranty = get('Bảo hành');
      const isLaser = catalogNameKey(category) === 'triệt lông';
      let price = min;
      let packageValue: CatalogEntry['package'];
      if (isLaser) {
        if (warranty !== '3 năm từ ngày mua' || min !== max) throw new Error('Triệt lông cần giá gói cố định, bảo hành “3 năm từ ngày mua”.');
        const match = notes.match(/Giá lẻ:\s*([\d,.]+)\s*đ\/lần/i);
        if (match && !/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(match[1])) throw new Error('Giá lẻ trong ghi chú không đúng định dạng hàng nghìn.');
        price = get('Giá lẻ (VNĐ)') ? amount(get('Giá lẻ (VNĐ)'), 'Giá lẻ') : match ? amount(match[1].replace(/[,.]/g, ''), 'Giá lẻ') : 0;
        if (!price) throw new Error('Thiếu giá lẻ mỗi lần: thêm cột Giá lẻ (VNĐ).');
        packageValue = { name: `Triệt lông ${originalName} · 3 năm`, price: min, packageType: 'TIME', durationMonths: 36 };
      } else {
        if (warranty) throw new Error('Loại bảo hành chưa được hỗ trợ.');
        const selected = get('Giá mặc định (VNĐ)');
        if (selected) price = amount(selected, 'Giá mặc định');
        else if (min !== max && !useMinPrice) throw new Error('Giá theo khoảng: thêm cột Giá mặc định (VNĐ), hoặc dùng --use-min-price để chọn giá từ.');
        if (price < min || price > max) throw new Error('Giá mặc định nằm ngoài khoảng giá.');
      }
      const entry = catalogEntryInput.parse({ row: row.row,
        service: { name: isLaser ? `Triệt lông ${originalName}` : originalName, category, price, commission },
        source: { min, max, notes }, ...(packageValue ? { package: packageValue } : {}) });
      const key = catalogRowKey(entry);
      if (seen.has(key)) throw new Error('Trùng nhóm và tên dịch vụ trong file.');
      seen.add(key); entries.push(entry);
    } catch (error) { errors.push(`Dòng ${row.row}: ${error instanceof z.ZodError ? 'Tên/nhóm/giá/hoa hồng không hợp lệ.' : (error as Error).message}`); }
  }
  if (!entries.length && !errors.length) errors.push('File không có dữ liệu.');
  return { entries, errors };
}
