import { z } from 'zod';
const id = z.string().regex(/^[a-f\d]{24}$/i);
const name = z.string().trim().min(1).max(200);
const quantity = z.number().int().min(1).max(1_000_000_000);
const price = z.number().int().min(1).max(1_000_000_000_000);
const product = z.object({ name, sku: z.string().trim().min(1).max(60).transform(s => s.toUpperCase()), unit: name.max(30), groupId: z.union([id, z.literal('')]).default(''), price, description: z.string().trim().max(2000).optional(), imageUrl: z.string().trim().url().max(2000).optional().or(z.literal('')), minStock: z.number().int().min(0).max(1_000_000_000).default(0) });
export const productInputs = {
  product, updateProduct: product.extend({ id }),
  productStatus: z.object({ id, active: z.boolean() }),
  productGroup: z.object({ name }), updateProductGroup: z.object({ id, name }),
  stockMovement: z.object({ productId: id, direction: z.enum(['IN', 'OUT']), quantity, reason: z.string().trim().min(3).max(2000) }),
  sellProduct: z.object({ customerId: id, productId: id, quantity, unitPrice: price.optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), consultantId: id.optional() }),
};
export const productNameKey = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ');
export function stockBalance(before: number, direction: 'IN' | 'OUT', amount: number) {
  z.number().int().min(0).max(1_000_000_000).parse(before); quantity.parse(amount);
  return z.number().int().min(0, 'Không đủ tồn kho.').max(1_000_000_000, 'Tồn kho vượt giới hạn.').parse(before + (direction === 'IN' ? amount : -amount));
}
export function productTotal(unitPrice: number, count: number) { price.parse(unitPrice); quantity.parse(count); return price.parse(unitPrice * count); }
export function productQuery(params: URLSearchParams) {
  return z.object({ view: z.enum(['products', 'product_groups', 'inventory']).default('products'), search: z.string().trim().max(100).default(''), group: z.union([id, z.literal('')]).default(''), status: z.enum(['', 'ACTIVE', 'INACTIVE', 'EMPTY', 'LOW_STOCK']).default(''), history: z.enum(['', 'yes']).default(''), page: z.coerce.number().int().min(1).max(1_000_000).default(1), productId: z.union([id, z.literal('')]).default('') }).parse(Object.fromEntries(params));
}
export function canManageProducts(user: { role: string }) { return user.role === 'OWNER'; }
export function canViewProducts(user: { role: string }) { return ['OWNER', 'STAFF'].includes(user.role); }
