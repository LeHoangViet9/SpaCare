import { canViewPage } from './navigation';
import { Product, ProductGroup, StockMovement } from './models';
import { canManageProducts, canViewProducts, productQuery } from './product-rules';
import { literalPattern } from './workspace-query';
import { ensure } from './rules';
import type { Actor } from './auth';
export async function readProducts(user: Actor, q: ReturnType<typeof productQuery>) {
  ensure(canViewProducts(user), 'Không có quyền xem danh sách sản phẩm.', 403);
  ensure(canViewPage(q.view, user), 'Bạn không có quyền mở mục này.', 403);
  const canManage = canManageProducts(user);
  const scope = { spaId: user.spaId };
  const groups = await ProductGroup.find(scope).select('name').sort({ name: 1, _id: 1 }).lean();
  const expression = { $regex: literalPattern(q.search), $options: 'i' };
  const productFilter: Record<string, unknown> = { ...scope, ...(q.search ? { $or: [{ name: expression }, { sku: expression }] } : {}), ...(q.group ? { groupId: q.group } : {}), ...(q.status === 'ACTIVE' ? { active: true } : q.status === 'INACTIVE' ? { active: false } : q.status === 'EMPTY' ? { stock: 0 } : q.status === 'LOW_STOCK' ? { active: true, $expr: { $and: [{ $gt: ['$minStock', 0] }, { $lte: ['$stock', '$minStock'] }] } } : {}) };
  const history = q.view === 'inventory' && q.history === 'yes';
  const model = q.view === 'product_groups' ? ProductGroup : history ? StockMovement : Product;
  const productIds = history
    ? q.productId
      ? [q.productId]
      : await Product.find(productFilter).distinct('_id')
    : [];
  const filter = q.view === 'product_groups' ? { ...scope, ...(q.search ? { name: expression } : {}) } : history ? { ...scope, productId: { $in: productIds }, ...(q.productId ? {} : Object.keys(productFilter).length > 1 ? {} : {}) } : productFilter;
  const total = await model.countDocuments(filter);
  const page = Math.min(q.page, Math.max(1, Math.ceil(total / 10)));
  const rows = await model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(10).lean();
  const products = q.view === 'inventory' ? await Product.find(scope).select('name sku unit stock active').sort({ name: 1, _id: 1 }).lean() : [];
  return { groups, products, rows, total, page, canManage };
}

