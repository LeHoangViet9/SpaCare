export type MenuNode = { key: string; title: string; pending?: boolean; children?: MenuNode[] };
export const menu: MenuNode[] = [
  { key: 'overview', title: 'Tổng quan' },
  { key: 'operations', title: 'Vận hành', children: [{ key: 'appointments', title: 'Lịch hẹn' }, { key: 'customers', title: 'Khách hàng' }] },
  { key: 'services_treatments', title: 'Dịch vụ & liệu trình', children: [{ key: 'services', title: 'Danh mục dịch vụ' }, { key: 'packages', title: 'Gói liệu trình' }, { key: 'treatment_uses', title: 'Buổi đã sử dụng' }] },
  { key: 'finance', title: 'Tài chính', children: [{ key: 'invoices', title: 'Hóa đơn & công nợ' }, { key: 'deposits', title: 'Tiền cọc' }, { key: 'cash', title: 'Sổ thu chi' }, { key: 'days', title: 'Chốt sổ ngày' }, { key: 'reports', title: 'Thống kê dòng tiền' }] },
  { key: 'admin', title: 'Quản trị', children: [{ key: 'staff_group', title: 'Nhân viên', children: [{ key: 'staff', title: 'Danh sách nhân viên' }, { key: 'salary', title: 'Lương', pending: true }, { key: 'commission', title: 'Hoa hồng', pending: true }] }, { key: 'audit', title: 'Nhật ký thao tác' }] },
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
  if (!pageKeys().includes(key)) return false;
  if (['services', 'staff', 'audit'].includes(key)) return user.role === 'OWNER';
  if (['days', 'reports'].includes(key)) return user.role === 'OWNER' || !!user.cashier;
  return true;
}
