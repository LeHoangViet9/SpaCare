import { ensure } from './rules';
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

// Only a managed local reference can be published. Never fetch or redirect to
// a stored absolute URL, even if it points back to this application's host.
export function storedProductImageId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^\/api\/product-images\/([a-fA-F0-9]{24})$/.exec(value)?.[1].toLowerCase() || null;
}

export function publicProductImageUrl(slug: string, productId: string, storedUrl: unknown): string | null {
  return storedProductImageId(storedUrl)
    ? `/api/s/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}/image`
    : null;
}

export function internalProductImageUrl(storedUrl: string): string {
  const id = storedProductImageId(storedUrl);
  return id ? `/api/product-images/v2/${id}` : storedUrl;
}

export function productImageType(bytes: Uint8Array): string {
  ensure(bytes.length > 12 && bytes.length <= MAX_PRODUCT_IMAGE_BYTES, 'Ảnh phải nhỏ hơn hoặc bằng 5 MB.');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const starts = (offset: number, value: string) => [...value].every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  if (bytes[0] === 137 && starts(1, 'PNG\r\n\x1a\n')) return 'image/png';
  if (starts(0, 'RIFF') && starts(8, 'WEBP')) return 'image/webp';
  ensure(false, 'Chỉ nhận ảnh JPG, PNG hoặc WebP. Vui lòng đổi ảnh HEIC sang JPG.');
}
