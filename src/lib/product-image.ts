import { ensure } from './rules';
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export function productImageType(bytes: Uint8Array): string {
  ensure(bytes.length > 12 && bytes.length <= MAX_PRODUCT_IMAGE_BYTES, 'Ảnh phải nhỏ hơn hoặc bằng 5 MB.');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const starts = (offset: number, value: string) => [...value].every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  if (bytes[0] === 137 && starts(1, 'PNG\r\n\x1a\n')) return 'image/png';
  if (starts(0, 'RIFF') && starts(8, 'WEBP')) return 'image/webp';
  ensure(false, 'Chỉ nhận ảnh JPG, PNG hoặc WebP. Vui lòng đổi ảnh HEIC sang JPG.');
}
