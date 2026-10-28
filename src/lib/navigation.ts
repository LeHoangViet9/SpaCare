export type MenuNode = { key: string; title: string; pending?: boolean; children?: MenuNode[] };
export const menu: MenuNode[] = [
  { key: 'overview', title: 'Tổng quan' },
  { key: 'products_group', title: 'Sản phẩm', children: [{ key: 'products', title: 'Danh sách sản phẩm' }, { key: 'product_groups', title: 'Nhóm sản phẩm' }, { key: 'inventory', title: 'Kho hàng' }] },
  { key: 'operations', title: 'Vận hành', children: [{ key: 'appointments', title: 'Lịch hẹn' }, { key: 'customers', title: 'Khách hàng' }] },
  { key: 'services_treatments', title: 'Dịch vụ & liệu trình', children: [{ key: 'services', title: 'Danh mục dịch vụ' }, { key: 'package_catalog', title: 'Danh mục liệu trình' }, { key: 'packages', title: 'Gói của khách' }, { key: 'treatment_uses', title: 'Buổi đã sử dụng' }] },
  { key: 'finance', title: 'Tài chính', children: [{ key: 'cashier', title: 'Thu ngân' }, { key: 'invoices', title: 'Hóa đơn & công nợ' }, { key: 'cash_cards', title: 'Thẻ tiền mặt' }, { key: 'deposits', title: 'Tiền cọc' }, { key: 'cash', title: 'Sổ thu chi' }, { key: 'days', title: 'Chốt sổ ngày' }, { key: 'reports', title: 'Báo cáo' }] },
  { key: 'admin', title: 'Quản trị', children: [{ key: 'staff_group', title: 'Nhân viên', children: [{ key: 'staff', title: 'Danh sách nhân viên' }, { key: 'salary', title: 'Lương' }, { key: 'commission', title: 'Hoa hồng' }] }, { key: 'audit', title: 'Nhật ký thao tác' }] },
];
export function pageKeys(nodes: MenuNode[] = menu): string[] {
  return nodes.flatMap(node => node.children ? pageKeys(node.children) : node.pending ? [] : [node.key]);
}
export function menuPath(key: string, nodes: MenuNode[] = menu): MenuNode[] {
  for (const node of nodes) {
    if (node.key === key) return [node];
    const children = node.children ? menuPath(key, node.children) : [];
    if (children.length) return [node, ...children];
  }
  return [];
}
export function canViewPage(key: string, user: { role: string; cashier?: boolean }): boolean {
  if (user.role === 'CUSTOMER' || !['OWNER', 'STAFF'].includes(user.role)) return false;
  if (!pageKeys().includes(key)) return false;
  if (['salary', 'commission'].includes(key)) return ['OWNER', 'STAFF'].includes(user.role);
  if (['product_groups', 'inventory', 'services', 'staff', 'audit', 'package_catalog'].includes(key)) return user.role === 'OWNER';
  if (['products'].includes(key)) return ['OWNER', 'STAFF'].includes(user.role);
  if (key === 'reports') return user.role === 'OWNER';
  if (['days', 'cashier', 'cash_cards'].includes(key)) return user.role === 'OWNER' || !!user.cashier;
  return true;
}
