const formatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
export const formatCurrency = (value: number) => formatter.format(value || 0) + ' đ';
export function parseMoney(value: string): number {
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(value.trim())) throw new Error('Nhập số tiền nguyên VNĐ hợp lệ.');
  const amount = Number(value.replaceAll('.', '').trim());
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000_000) throw new Error('Số tiền vượt giới hạn.');
  return amount;
}
export const moneyField = (key: string) => /^(giftCashCardAmount|additionalAmount|amount|price|total|unitPrice|commission|baseSalary|bonus|deductions|advance|opening|counted)$/.test(key);
