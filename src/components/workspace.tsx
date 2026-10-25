'use client';
import { invoiceCode } from '@/lib/invoice-code';
import { appointmentServiceIds, appointmentServiceName } from '@/lib/appointment-services';
import { nextSessionNumber } from '@/lib/treatment-rules';
import {ServiceGroupField,ServicePickerField} from './service-selectors';
import {serviceGroupNames} from '@/lib/service-groups';
import PackageTypeFields from './package-type-fields';
import { timedPackage, packageLabel, useToken, treatmentAvailable } from '@/lib/treatment-rules';
import ValidatedForm from '@/components/validated-form';
import PasswordInput from '@/components/password-input';
import Notifications, { disablePush } from '@/components/notifications';
import Link from 'next/link';
import MoneyInput from './money-input';
import { formatCurrency, parseMoney, moneyField } from '@/lib/currency';
import Brand from '@/components/brand';
import Reports from '@/components/reports';
import CommercialFields from '@/components/commercial-fields';
import CashCardManager from '@/components/cash-card-manager';
import Cashier from '@/components/cashier';
import ListFiltersBar from '@/components/list-filters';
import AppointmentAgenda from '@/components/appointment-agenda';
import StaffDetail from '@/components/staff-detail';
import PayrollPanel from '@/components/payroll';
import Products from '@/components/products';
import ProductImagePicker from '@/components/product-image-picker';
import type { ListFilters } from '@/lib/workspace-filters';
import InvoiceDetail from '@/components/invoice-detail';
import CustomerPicker from '@/components/customer-picker';
import AuditLog from '@/components/audit-log';
import SignaturePad, { SignatureImage } from '@/components/signature-pad';
import { isValidSignature, type Signature } from '@/lib/signature';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { menu, menuPath, pageKeys, canViewPage } from '@/lib/navigation';
import { workspaceHref } from '@/lib/workspace-view';
import { sectionCollection } from '@/lib/workspace-query';
import { staffBookingsToday } from '@/lib/rules';
import { isValidElement, useCallback, useEffect, useRef, useState } from 'react';
type Row = Record<string, any>;
type Field = { remoteCustomers?: boolean; key: string; label: string; type?: string; options?: [string, string][]; min?: number; step?: number; max?: number; optional?: boolean; hint?: string; optionScopes?: Record<string, { customerId: string; serviceId: string }> };
type FormSpec = { title: string; action: string; fields: Field[]; defaults?: Row; description?: string; transfer?: Row; signatureContext?: Row; signaturePreview?: Signature; readOnly?: boolean };
const vnd = formatCurrency;
const time = (s: string) => s ? new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—';
const statusText: Record<string, string> = { PAUSED: 'Đang bảo lưu', DRAWN_SIGNATURE: 'Khách ký trên màn hình', PARTIALLY_PAID: 'Thanh toán một phần', UNPAID: 'Chưa thanh toán', POSTPONED: 'Đang hoãn', INACTIVE: 'Ngừng hoạt động', CONFIRMED: 'Đã đặt', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', OPEN: 'Đang mở', CLOSED: 'Đã chốt', PAID: 'Đã thanh toán', ACTIVE: 'Đang dùng', IN: 'Thu', OUT: 'Chi', CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', CARD_SALE: 'Thu mua thẻ', DEPOSIT: 'Nhận cọc', PAYMENT: 'Thu hóa đơn', INCOME: 'Thu khác', EXPENSE: 'Chi phí', PAYROLL: 'Chi lương', REFUND:'Hoàn tiền gói', REVERSAL: 'Đảo giao dịch', OWNER: 'Chủ spa', STAFF: 'Nhân viên', SIGNATURE_REFERENCE: 'Tham chiếu phiếu ký', ALTERNATIVE: 'Xác nhận thay thế' };
const label = (s: string) => statusText[s] || s;
const methodOptions: [string, string][] = [['CASH', 'Tiền mặt'], ['BANK_TRANSFER', 'Chuyển khoản · xác nhận thủ công']];
export default function Workspace() {
  const router = useRouter();
  const pathname = usePathname();
  const tab = pathname.split('/')[2] || 'overview';
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors,setFieldErrors] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<FormSpec | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ kind: 'invoice' | 'customer'; id: string } | null>(null);
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [search, setSearchValue] = useState(urlSearch);
  const publishedSearch = useRef(urlSearch);
  const searchPath = useRef(pathname);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composingSearch = useRef(false);
  const liveSearch = useRef(search);
  liveSearch.current = search;
  useEffect(() => {
    if (pathname !== searchPath.current) {
      clearTimeout(searchTimer.current); searchPath.current = pathname;
      setSearchValue(urlSearch); publishedSearch.current = urlSearch;
    }
    const restore = () => { clearTimeout(searchTimer.current); setSearchValue(new URLSearchParams(window.location.search).get('search') || ''); };
    window.addEventListener('popstate', restore);
    return () => { clearTimeout(searchTimer.current); window.removeEventListener('popstate', restore); };
  }, [pathname]);
  function publishSearch(value: string) {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (composingSearch.current || liveSearch.current !== value) return;
      const query = new URLSearchParams(window.location.search);
      if (value) query.set('search', value); else query.delete('search');
      publishedSearch.current = value;
      window.history.replaceState(null, '', pathname + (query.size ? '?' + query.toString() : ''));
    }, 300);
  }
  function setSearch(value: string) { setSearchValue(value); if (!composingSearch.current) publishSearch(value); }
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cashierRevision, setCashierRevision] = useState(0);
  const [cashierNewCustomer, setCashierNewCustomer] = useState<Row | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const activeMenuGroup = menuPath(tab)[0]?.key;
  function closeMobileMenu() { setMobileMenuOpen(false); mobileMenuButton.current?.focus(); }
  function openMobileGroup(key: string) {
    const parents = activeMenuGroup === key ? menuPath(tab).filter(node => node.children) : [];
    setExpandedGroups({ ...Object.fromEntries(parents.map(node => [node.key, true])), [key]: true });
    setMobileMenuOpen(true);
  }
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMobileMenu(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [auditFilters, setAuditFilters] = useState({ search: '', actor: '', action: '', from: '', to: '' });
  const filterValues = Object.fromEntries(['status', 'employee', 'method', 'direction', 'category', 'customer', 'from', 'to'].map(key => [key, searchParams.get(key) || ''])) as ListFilters;
  const agendaView = searchParams.get('layout') === 'agenda';
  function setFilters(changes: Partial<ListFilters>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) { if (value) params.set(key, value); else params.delete(key); }
    window.history.replaceState(null, '', pathname + (params.size ? '?' + params.toString() : ''));
  }
  function setAgenda(value: boolean) { const params = new URLSearchParams(searchParams.toString()); if (value) params.set('layout', 'agenda'); else params.delete('layout'); window.history.replaceState(null, '', pathname + (params.size ? '?' + params.toString() : '')); }
  const [listPaging, setListPaging] = useState({ key: '', page: 1, allocationPage: 1, pageSize: 10 });
  const filterKey = JSON.stringify([tab, search, period, auditFilters, filterValues, agendaView]);
  const requestQuery = new URLSearchParams({ section: tab, search: tab === 'audit' ? auditFilters.search : search, page: String(listPaging.key === filterKey ? listPaging.page : 1), allocationPage: String(listPaging.key === filterKey ? listPaging.allocationPage : 1), pageSize: String(listPaging.pageSize), ...filterValues, order: agendaView ? 'asc' : 'desc', ...(tab === 'reports' ? period : {}), ...(tab === 'audit' ? auditFilters : {}) }).toString();
  const loadSequence = useRef(0);
  const currentRequest = useRef(requestQuery);
  currentRequest.current = requestQuery;
  const lock = useRef(false);
  const retryKeys = useRef(new Map<string, string>());
  const viewRevision = useRef(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    operations: false,
    services_treatments: false,
    finance: false,
    admin: false,
    staff_group: false,
  });
  function toggleGroup(key: string) {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }
  useEffect(() => {
    setMobileMenuOpen(false);
    const parents = menuPath(tab).filter(node => node.children).map(node => node.key);
    setExpandedGroups(previous => ({ ...previous, ...Object.fromEntries(parents.map(key => [key, true])) }));
    viewRevision.current += 1;
    setNotice(''); setError(''); setModal(null); setDetail(null); setSelectedStaff(null); setCashierNewCustomer(null);
  }, [tab]);
  function changeTab(next: string, linkedSearch = '') {
    viewRevision.current += 1;
    const groups = menuPath(next).filter(node => node.children).map(node => node.key);
    if (groups.length) {
      setExpandedGroups(prev => {
        const nextGroups = { ...prev };
        groups.forEach(g => { nextGroups[g] = true; });
        return nextGroups;
      });
    }
    window.history.pushState(null, '', workspaceHref(next, linkedSearch)); setNotice(''); setError(''); setModal(null); setDetail(null); setSelectedStaff(null); setCashierNewCustomer(null);
  }
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!error || modal || !data) return;
    const timer = window.setTimeout(() => setError(''), 6000);
    return () => window.clearTimeout(timer);
  }, [error, modal, data]);
  const lastLoadedSection = useRef('');
  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    const response = await fetch('/api/workspace?' + requestQuery, { cache: 'no-store', signal });
    const payload = await response.json();
    if (sequence !== loadSequence.current || currentRequest.current !== requestQuery) return;
    if (response.status === 401) { setNeedsLogin(true); setData(null); return; }
    setNeedsLogin(false);
    if (!response.ok) throw new Error(payload.error || 'Không thể tải dữ liệu.');
    setData({ ...payload, _requestKey: requestQuery });
  }, [requestQuery]);
  useEffect(() => {
    // CustomerList owns its paginated request; keep the existing shell.
    if (['customers', 'salary', 'commission', 'products', 'product_groups', 'inventory', 'cash_cards'].includes(tab) && data) return;
    let current = true;
    const controller = new AbortController();
    const delay = lastLoadedSection.current === tab ? 250 : 0;
    lastLoadedSection.current = tab;
    const timer = window.setTimeout(() => { load(controller.signal).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); }); }, delay);
    return () => { current = false; controller.abort(); window.clearTimeout(timer); loadSequence.current += 1; };
  }, [load, tab]);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setBusy(true);
    const fields = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fields)) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error);
      setNeedsLogin(false);
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function run(action: string, values: Row) {
    if (lock.current) return;
    if(action === 'updateInvoice' && values.editLineCount) {
      values={...values,items:Array.from({length:Number(values.editLineCount)},(_,i)=>({serviceId:values['editService'+i],total:Number(values['editPrice'+i])}))};
      values.total=values.items.reduce((sum:number,item:Row)=>sum+item.total,0);
    }
    const revision = viewRevision.current;
    lock.current = true; setFieldErrors({}); setBusy(true); setError(''); setNotice('');
    const signature = JSON.stringify({ action, data: values });
    let key = retryKeys.current.get(signature);
    if (!key) { key = crypto.randomUUID(); retryKeys.current.set(signature, key); }
    try {
      const r = await fetch('/api/operations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: signature });
      const body = await r.json();
      if (!r.ok) {
        setFieldErrors(body.fields || {});
        if (r.status === 409 && ['use', 'completeTreatmentAppointment'].includes(action) && revision === viewRevision.current) {
          await load();
          if (revision === viewRevision.current) {
            setModal(null); setError(body.error + ' Mở lại buổi thực hiện để khách ký lại.');
          }
          return;
        }
        throw new Error(body.error);
      }
      if (revision === viewRevision.current) { setModal(null); setNotice('Đã lưu.'); }
      await load(); retryKeys.current.delete(signature);
      if (action === 'completeInvoiceService' && revision === viewRevision.current) setDetail({ kind: 'invoice', id: body.id });
      if (tab === 'cashier' && action === 'customer' && revision === viewRevision.current) setCashierNewCustomer({ ...values, _id: body.id });
      if (tab === 'cashier' && ['invoice', 'serviceInvoice', 'sellPackage', 'sellProduct'].includes(action) && revision === viewRevision.current) { setCashierNewCustomer(null); setCashierRevision(value => value + 1); setDetail({ kind: 'invoice', id: body.invoiceId || body.id }); }
      if ((action === 'completeAppointment' || action === 'appointmentStatus') && body.invoiceId && revision === viewRevision.current) setNotice('Đã hoàn thành lịch và lập hóa đơn. Mở Hóa đơn để xác nhận tiền thực nhận.');
      if (['use', 'completeTreatmentAppointment'].includes(action) && body.invoiceId && revision === viewRevision.current) setDetail({ kind: 'invoice', id: body.invoiceId });
      if (action === 'completeTreatmentAppointment' && revision === viewRevision.current) setNotice('Đã hoàn thành và ghi nhận 1 buổi trong gói.');
      if (action === 'sellPackage' && revision === viewRevision.current) setNotice('Đã tạo gói và hóa đơn liên kết. Thu tiền hoặc áp cọc tại mục Tài chính.');
      if (body.replacementAppointmentId && revision === viewRevision.current) setNotice('Đã tạo lịch mới; lịch hoãn cũ được giữ trong lịch sử.');
      if (action === 'completeAppointment' && body.invoiceId && revision === viewRevision.current) { changeTab('invoices', body.invoiceId); setNotice('Đã liên kết hóa đơn. Chọn Thu tiền khi thực nhận tiền; áp cọc tại mục Tiền cọc.'); }
    } catch (e) { if (revision === viewRevision.current) setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function logout() {
    try {
      await disablePush();
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error);
      setData(null); changeTab('overview'); setError(''); setNotice('');
      window.location.href = '/';
    } catch (e) { setError((e as Error).message); }
  }
  if (loading) return <div className="loading">✧ SpaCare <small>Đang kết nối không gian làm việc…</small></div>;
  if (!data && !needsLogin) return <main className="loading"><h1>Không thể tải không gian làm việc</h1><p className="alert error" role="alert">{error || 'Dữ liệu chưa tải được. Vui lòng thử lại.'}</p><button className="primary" onClick={() => { setLoading(true); setError(''); load().catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Thử tải lại</button><Link href="/">Về trang chủ</Link></main>;
  if (!data) return <main className="login-page"><section className="login-intro"><Brand href="/workspace" /><span className="eyebrow">CHĂM SÓC KHÁCH HÀNG, GỌN GÀNG HƠN</span><h1>Một ngày tại spa.<br />Mọi thứ trong tầm tay.</h1><p>Lịch hẹn, liệu trình và từng khoản thu chi —<br />trong cùng một không gian làm việc.</p><div className="petal">✧</div><small>Phiên bản MVP · Dành cho vận hành nội bộ</small></section><section className="login-card"><span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span><h2>Đăng nhập SpaCare</h2><p>Dùng tài khoản được chủ spa cấp.</p><ValidatedForm onSubmit={login}><label>Số điện thoại hoặc email<input name="identifier" type="text" autoComplete="username" required placeholder="owner@spacare.local" /></label><label>Mật khẩu<PasswordInput name="password" autoComplete="current-password" required maxLength={128} /></label>{error && <div className="alert error" role="alert">{error}</div>}<button className="primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Vào không gian làm việc →'}</button></ValidatedForm></section></main>;

  const owner = data.user.role === 'OWNER';
  const finance = owner || data.user.cashier;
  const lookup = (collection: string, id: string, field = 'name') => data[collection]?.find((r: Row) => r._id === id)?.[field] || '—';
  const choices = (collection: string, display: (r: Row) => string): [string, string][] => data[collection].filter((r: Row) => r.active !== false).map((r: Row) => [r._id, display(r)]);
  const customerField: Field = { key: 'customerId', label: 'Khách hàng', remoteCustomers: true };
  const serviceField: Field = { key: 'serviceId', label: 'Dịch vụ', options: choices('services', r => `${r.name} · ${vnd(r.price)}`) };
  const invoiceField: Field = { key: 'invoiceId', label: 'Hóa đơn', options: choices('invoices', r => `${lookup('customers', r.customerId)} · ${r.description} · Nợ ${vnd(r.total - r.paid)} · ${invoiceCode(r)}`) };
  const amountField: Field = { key: 'amount', label: 'Số tiền (VNĐ)', type: 'number', min: 1, max: 1_000_000_000_000 };
  const methodField: Field = { key: 'method', label: 'Phương thức', options: methodOptions };
  const noteField: Field = { key: 'note', label: 'Nội dung / ghi chú', optional: true };
  const reasonField: Field = { key: 'reason', label: 'Lý do', hint: 'Lý do sẽ được lưu trong nhật ký.' };
  const open = (title: string, action: string, fields: Field[], defaults: Row = {}, description = '') => { setError(''); setNotice(''); setModal({ title, action, fields, defaults, description }); };
  const linkedInvoice = (r: Row) => data.invoices.find((i: Row) => i.appointmentId === r._id);
  const viewInvoice = (id: string) => { changeTab('invoices', id); };
  const completeWithInvoice = (r: Row) => {
    const multiple = appointmentServiceIds(r).length > 1;
    const quotedTotal = appointmentServiceIds(r).reduce((sum, id) => sum + (data.services.find((service: Row) => service._id === id)?.price || 0), 0);
    const candidates = data.invoices.filter((i: Row) => !multiple && !i.appointmentId && !i.performedAt && i.customerId === r.customerId && i.serviceId === r.serviceId && !data.treatments.some((t: Row) => t.invoiceId === i._id));
    const fields: Field[] = [{ key: 'description', label: 'Nội dung hóa đơn mới', optional:true }, { key: 'total', label: 'Giá hóa đơn mới (VNĐ)', type: 'number', min: 1, max: 1_000_000_000_000 }, { key: 'existingInvoiceId', label: 'Liên kết hóa đơn đã có (nếu có)', optional: true, options: candidates.map((i: Row) => [i._id, invoiceCode(i) + ' · ' + vnd(i.total) + ' · ' + label(i.status)]), hint: 'Để trống để tạo hóa đơn mới. Chọn hóa đơn đã lập cho cuộc hẹn này để tránh tính tiền hai lần.' }, { key: 'dueDate', label: 'Hạn trả khi tạo hóa đơn mới', type: 'date', optional: true }];
    open('Hoàn thành & lập hóa đơn dịch vụ lẻ', 'completeAppointment', finance ? [...(!r.staffId ? [{ key: 'staffId', label: 'Nhân viên thực hiện', options: choices('staff', r => r.name) }] : []), ...fields.filter(field => !multiple || field.key === 'dueDate')] : [], { id: r._id, ...(finance ? { ...(!multiple ? { description: data.services.find((s: Row) => s._id === r.serviceId)?.name, total: quotedTotal } : {}) } : {}) }, 'Khách: ' + lookup('customers', r.customerId) + ' · Dịch vụ: ' + appointmentServiceName(r, lookup('services', r.serviceId)) + ' · Giá tạo mới hiện tại: ' + vnd(quotedTotal) + '. Xác nhận sẽ hoàn thành lịch và tạo hoặc liên kết hóa đơn. Chưa thu tiền, chưa áp cọc. Hủy form sẽ không thay đổi lịch.');
  };
  const signSession = (treatment: Row, appointment?: Row) => {
    setError(''); setNotice('');
    setModal({ title: appointment ? 'Hoàn thành ca · khách ký xác nhận' : 'Khách không đặt lịch · ký xác nhận buổi',
      action: appointment ? 'completeTreatmentAppointment' : 'use', fields: (!appointment || !appointment.staffId) && finance ? [{ key: 'staffId', label: 'Nhân viên trực tiếp thực hiện', options: choices('staff', r => r.name) }] : [],
      defaults: { ...(appointment ? { id: appointment._id } : { treatmentId: treatment._id }), remainingBefore: useToken(treatment) },
      signatureContext: { customer: lookup('customers', treatment.customerId), packageName: treatment.name,
        staff: appointment ? lookup('staff', appointment.staffId) : finance ? 'Chọn nhân viên thực hiện bên dưới' : data.user.name,
        sessionNumber: nextSessionNumber(treatment), remaining: timedPackage(treatment) ? 'không giới hạn' : treatment.remaining },
      description: 'Khách kiểm tra thông tin và ký xác nhận đã thực hiện buổi này. Chỉ khi lưu thành công mới ghi nhận lần làm; gói theo buổi trừ 1 buổi.' });
  };
  const completePackage = (r: Row) => {
    const treatment = data.treatments.find((t: Row) => t._id === r.treatmentId);
    if (!treatment || !treatmentAvailable(treatment)) { setError('Gói đang bảo lưu hoặc không còn buổi. Chủ spa cần mở lại trước.'); return; }
    signSession(treatment, r);
  };
  const viewSignature = async (r: Row) => {
    const revision = viewRevision.current;
    try {
      const response = await fetch('/api/treatment-uses/' + r._id, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (revision !== viewRevision.current) return;
      const snapshot = result.snapshot || {};
      setModal({ title: 'Chữ ký xác nhận buổi liệu trình', action: '', fields: [], readOnly: true,
        signaturePreview: result.signature,
        description: [snapshot.customerName, snapshot.name, 'Buổi ' + (snapshot.sessionNumber || r.sessionNumber || '—'), snapshot.staffName, time(result.performedAt)].filter(Boolean).join(' · ') });
    } catch (error) { if (revision === viewRevision.current) setError((error as Error).message); }
  };
  const openPayment = (r: Row, method: string) => {
    setError(''); setNotice('');
    setModal({ title: method === 'CASH' ? 'Nhận tiền mặt' : 'Chuyển khoản ngân hàng', action: 'payment', defaults: { invoiceId: r._id, amount: r.total - r.paid, method, note: 'SPACARE ' + invoiceCode(r) }, description: invoiceCode(r) + ' · Còn phải trả ' + vnd(r.total - r.paid) + '. Chỉ xác nhận sau khi thực nhận tiền. Có thể thu một phần.', fields: [amountField, { key: 'receivedConfirmation', label: method === 'CASH' ? 'Đã đếm và thực nhận số tiền mặt nhập bên trên' : 'Đã kiểm tra tài khoản và thực nhận số tiền nhập bên trên', type: 'checkbox' }, noteField], ...(method === 'BANK_TRANSFER' ? { transfer: { ...data.paymentInfo, reference: 'SPACARE ' + invoiceCode(r) } } : {}) });
  };
  const consultantField: Field = { key: 'consultantId', label: 'Nhân viên tư vấn', optional: true, options: choices('staff', r => r.name), hint: 'Để trống khi bán: dùng người tư vấn mặc định của khách.' };
  const customerButton = <button className="primary" onClick={() => open('Thêm khách hàng', 'customer', [{ key: 'name', label: 'Họ và tên' }, { key: 'phone', label: 'Số điện thoại', type: 'tel' }, { key: 'notes', label: 'Ghi chú', optional: true }])}>＋ Thêm khách hàng</button>;
  const packageField: Field = { key: 'treatmentId', label: 'Gói liệu trình (để trống nếu dịch vụ lẻ)', optional: true, options: data.treatments.filter((t: Row) => treatmentAvailable(t) && t.serviceId).map((t: Row) => [t._id, t.name + ' · ' + packageLabel(t)]), optionScopes: Object.fromEntries(data.treatments.map((t: Row) => [t._id, { customerId: t.customerId, serviceId: t.serviceId }])), hint: 'Chọn khách và dịch vụ trước. Một gói phù hợp sẽ được gợi ý; nhiều gói thì chọn đúng gói khách muốn dùng. Để trống nếu muốn mua dịch vụ lẻ.' };
  const appointmentFields: Field[] = [customerField, serviceField, packageField, { key: 'staffId', optional: true, label: 'Nhân viên thực hiện', options: choices('staff', r => r.name) }, { key: 'startAt', label: 'Bắt đầu · giờ Việt Nam', type: 'datetime-local' }, { key: 'notes', label: 'Ghi chú', optional: true }];
  const bookCustomer = (id?: string) => { setDetail(null); open('Tạo lịch hẹn', 'appointment', appointmentFields, { ...(id ? { customerId: id } : {}), ...(!finance ? { staffId: data.user.id } : {}) }); };
  const appointmentButton = <button className="primary" onClick={() => bookCustomer()}>＋ Đặt lịch</button>;
  const customerFields: Field[] = [{ key: 'name', label: 'Họ và tên' }, { key: 'phone', label: 'Số điện thoại', type: 'tel' }, { key: 'notes', label: 'Ghi chú', optional: true }, consultantField];
  const categoryField: Field = { key: 'category', label: 'Nhóm dịch vụ', type:'service-group', optional: true };
  const commissionField: Field = { key: 'commission', optional:true, label: 'Hoa hồng cố định / lần thực hiện (VNĐ)', type: 'number', min: 0, max: 1_000_000_000_000 };
  const serviceFields: Field[] = [categoryField, commissionField, { key: 'name', label: 'Tên dịch vụ' }, { key: 'price', label: 'Giá (VNĐ)', type: 'number', min: 1 }];
  const staffFields: Field[] = [{ key: 'name', label: 'Họ và tên' }, { key: 'phone', label: 'Số điện thoại', type: 'tel' }, { key: 'cashier', label: 'Cấp quyền thu ngân', type: 'checkbox', optional: true }];
  const edit = (r: Row) => ({ commission: 0, ...r, id: r._id });
  const statusAction = (r: Row, action: string) => open(r.active ? 'Xác nhận ngừng hoạt động' : 'Xác nhận hoạt động lại', action, [], { id: r._id, active: !r.active });
  const viewPending = data._requestKey !== requestQuery;
  const listRows = (key: string): Row[] => viewPending ? [] : data.pages?.[key]?.rows || data[key] || [];
  const pageFor = (key: string): ServerPagination | undefined => key ? { page: data.pages?.[key]?.page || 1, pageSize: listPaging.pageSize, total: data.pages?.[key]?.total || 0, loading: viewPending, onChange: (page, pageSize) => setListPaging(previous => ({ ...(previous.key === filterKey && previous.pageSize === pageSize ? previous : { page: 1, allocationPage: 1 }), key: filterKey, pageSize, ...(key === 'allocations' ? { allocationPage: page } : { page }) })) } : undefined;
  const primaryPagination = pageFor(sectionCollection[tab]);
  const tableResetKey = JSON.stringify([tab, search, period.from, period.to, filterValues]);
  const pageTitles: Record<string, string> = {
    products: 'Danh sách sản phẩm', product_groups: 'Nhóm sản phẩm', inventory: 'Kho hàng',
    overview: 'Tổng quan',
    cashier: 'Thu ngân',
    appointments: 'Lịch hẹn',
    customers: 'Khách hàng',
    services: 'Danh mục dịch vụ',
    package_catalog: 'Danh mục liệu trình',
    packages: 'Gói của khách',
    treatments: 'Gói liệu trình',
    treatment_uses: 'Buổi đã sử dụng',
    invoices: 'Hóa đơn & công nợ',
    cash_cards: 'Thẻ tiền mặt',
    deposits: 'Tiền cọc',
    cash: 'Sổ thu chi',
    days: 'Chốt sổ ngày',
    reports: 'Báo cáo',
    staff: 'Danh sách nhân viên',
    salary: 'Lương nhân viên',
    commission: 'Hoa hồng',
    audit: 'Nhật ký thao tác',
  };
  const breadcrumbs: Record<string, string[]> = {
    products: ['Sản phẩm', 'Danh sách sản phẩm'], product_groups: ['Sản phẩm', 'Nhóm sản phẩm'], inventory: ['Sản phẩm', 'Kho hàng'],
    overview: ['Tổng quan'],
    cashier: ['Tài chính', 'Thu ngân'],
    appointments: ['Vận hành', 'Lịch hẹn'],
    customers: ['Vận hành', 'Khách hàng'],
    services: ['Dịch vụ & liệu trình', 'Danh mục dịch vụ'],
    package_catalog: ['Dịch vụ & liệu trình', 'Danh mục liệu trình'],
    packages: ['Dịch vụ & liệu trình', 'Gói của khách'],
    treatments: ['Dịch vụ & liệu trình', 'Gói liệu trình'],
    treatment_uses: ['Dịch vụ & liệu trình', 'Buổi đã sử dụng'],
    invoices: ['Tài chính', 'Hóa đơn & công nợ'],
    cash_cards: ['Tài chính', 'Thẻ tiền mặt'],
    deposits: ['Tài chính', 'Tiền cọc'],
    cash: ['Tài chính', 'Sổ thu chi'],
    days: ['Tài chính', 'Chốt sổ ngày'],
    reports: ['Tài chính', 'Thống kê dòng tiền'],
    staff: ['Quản trị', 'Nhân viên', 'Danh sách nhân viên'],
    salary: ['Quản trị', 'Nhân viên', 'Lương'],
    commission: ['Quản trị', 'Nhân viên', 'Hoa hồng'],
    audit: ['Quản trị', 'Nhật ký thao tác'],
  };
  const pageTitle = pageTitles[tab] || 'SpaCare';
  const currentBreadcrumbs = breadcrumbs[tab] || [pageTitle];
  const headers: Record<string, string> = {
    overview: 'Một góc nhìn rõ ràng cho ngày làm việc của bạn.',
    appointments: 'Sắp xếp thời gian, chăm sóc từng cuộc hẹn.',
    customers: 'Lưu giữ những kết nối với khách hàng.',
    services: 'Danh mục dịch vụ, bảng giá và hoa hồng.',
    packages: 'Theo dõi các gói liệu trình nhiều buổi và tiến độ sử dụng.',
    treatments: 'Theo dõi các gói liệu trình nhiều buổi và tiến độ sử dụng.',
    treatment_uses: 'Nhật ký chi tiết các buổi dịch vụ đã được xác nhận thực hiện.',
    invoices: 'Theo dõi số đã thanh toán và phần công nợ còn lại.',
    cash_cards: 'Thẻ khách mua, thẻ được tặng và số dư sử dụng.',
    deposits: 'Nhận một lần, phân bổ đúng, giữ lại phần dư.',
    cash: 'Ghi nhận dòng tiền thực thu và thực chi.',
    days: 'Đếm tiền, đối soát và lưu chênh lệch.',
    reports: 'Dòng tiền thực tế, tách biệt với doanh thu kế toán.',
    staff: 'Tài khoản và quyền ghi nhận thu chi.',
    salary: 'Thông tin tiền lương nhân sự. Nhân viên xem thông tin của mình, chủ spa xem toàn bộ.',
    commission: 'Theo dõi sản lượng phục vụ và hoa hồng. Nhân viên xem ca của mình, chủ spa xem toàn bộ.',
    audit: 'Lịch sử thao tác trong spa.',
  };
  const editInvoice = (invoice:Row,plan:Row|null) => {setDetail(null);open('Sửa hóa đơn','updateInvoice',[
 {key:'description',label:'Nội dung hóa đơn'},
 ...((!invoice.kind || invoice.kind==='SERVICE') && (invoice.serviceItems?.length || invoice.serviceId) ? (invoice.serviceItems?.length ? invoice.serviceItems : [{serviceId:invoice.serviceId,total:invoice.total}]).flatMap((item:Row,i:number)=>[{key:'editService'+i,label:'Dịch vụ '+(i+1),options:choices('services',r=>r.name)},{key:'editPrice'+i,label:'Giá dịch vụ '+(i+1)+' (VNĐ)',type:'number',min:1}]) : [{key:'total',label:'Giá hóa đơn (VNĐ)',type:'number',min:1}]), {key:'dueDate',label:'Hạn thanh toán',type:'date',optional:true},
 ...(invoice.kind==='PACKAGE' ? [{key:'packageName',label:'Tên liệu trình'},...(plan?.packageType==='TIME' ? [{key:'durationMonths',label:'Thời hạn (tháng)',type:'number',min:1,max:120},{key:'startsOn',label:'Ngày bắt đầu',type:'date'}] : [{key:'totalSessions',label:'Số buổi',type:'number',min:1,max:10000}])] : []),
 {key:'reason',label:'Lý do sửa'}],{...((!invoice.kind || invoice.kind==='SERVICE') && (invoice.serviceItems?.length || invoice.serviceId) ? {editLineCount:invoice.serviceItems?.length || 1,...Object.fromEntries((invoice.serviceItems?.length ? invoice.serviceItems : [{serviceId:invoice.serviceId,total:invoice.total}]).flatMap((item:Row,i:number)=>[['editService'+i,item.serviceId],['editPrice'+i,item.total]]))}:{}),id:invoice._id,expectedUpdatedAt:invoice.updatedAt,description:invoice.description,total:invoice.total,dueDate:invoice.dueDate,...(plan ? {packageName:plan.name,packageType:plan.packageType || 'SESSIONS',totalSessions:plan.totalSessions,durationMonths:plan.durationMonths,startsOn:plan.startsOn}: {})},'Chỉ chủ spa được sửa nội dung, giá và hạn trả khi chưa thanh toán hoặc áp cọc/thẻ. Giá và công nợ tự tính từ từng dòng. Đổi dịch vụ tự cập nhật hoa hồng; chỉ đổi giá giữ hoa hồng cố định. Giữ nguyên người thực hiện. Lịch sử trước/sau được lưu.');};
  const cancelInvoice = (invoice:Row) => {setDetail(null);open('Hủy hóa đơn chưa thanh toán','cancelInvoice',[reasonField],{id:invoice._id,expectedUpdatedAt:invoice.updatedAt},'Chỉ chủ spa được hủy. Công nợ về 0; hoa hồng dịch vụ chưa chốt lương được đưa về 0 và lưu lịch sử. Nếu hoa hồng đã duyệt/chi, hệ thống yêu cầu xử lý bảng lương trước. Gói và quà phải chưa sử dụng.');};
  async function editInvoiceFromList(invoice:Row) {
    try {
      const response=await fetch('/api/invoices/'+invoice._id,{cache:'no-store'});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error || 'Không tải được hóa đơn.');
      editInvoice(result.invoice,result.treatment);
    } catch(error) {setError((error as Error).message);}
  }
  let content: React.ReactNode;
  switch (tab) {
    case 'overview': content = <><div className="welcome"><div><span className="eyebrow">KHÔNG GIAN VẬN HÀNH</span><h2>Chăm sóc tốt hơn,<br />bắt đầu từ sự gọn gàng.</h2><p>Hôm nay, tập trung vào khách hàng.<br />SpaCare giúp bạn theo dõi phần còn lại.</p>{appointmentButton}</div><div className="welcome-art" aria-hidden="true"><span>✧</span><i>CARE, WITH CLARITY</i></div></div><div className="metrics"><Metric title="Lịch hẹn hôm nay" value={String(data.totals.bookings)} sub="Lịch không bị hủy" />{finance && <><Metric title="Thực thu hôm nay" value={vnd(data.totals.inflow)} sub="Tất cả phương thức nhận tiền" /><Metric title="Công nợ hiện tại" value={vnd(data.totals.debt)} sub="Tổng hóa đơn chưa thu đủ" /><Metric title="Cọc còn sử dụng" value={vnd(data.totals.credit)} sub="Số dư khách giữ cho lần sau" /></>}</div><section className="panel"><div className="section-head"><h3>Lịch hẹn gần nhất</h3><button className="text-button" onClick={() => changeTab('appointments')}>Xem lịch hẹn →</button></div><Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Khách hàng', 'Dịch vụ', 'Nhân viên', 'Thời gian', 'Trạng thái']} rows={[...data.appointments].filter((r: Row) => r.status === 'CONFIRMED' && new Date(r.startAt) >= new Date()).sort((a: Row, b: Row) => a.startAt.localeCompare(b.startAt)).slice(0, 6).map((r: Row) => [lookup('customers', r.customerId), appointmentServiceName(r, lookup('services', r.serviceId)), lookup('staff', r.staffId), time(r.startAt), <Badge key="status" value={r.status} />])} /></section></>; break;
    case 'cash_cards': content = <CashCardManager busy={busy} refreshKey={data} onCreate={()=>open('Tạo thẻ tiền mặt','sellCashCard',[customerField,amountField,methodField,{key:'receivedConfirmation',label:'Đã kiểm tra và thực nhận đủ tiền mua thẻ',type:'checkbox'},noteField],{method:'CASH'},'Khách phải trả đủ mệnh giá để phát hành thẻ. Chỉ dùng cho dịch vụ lẻ, không hết hạn, không hoàn/đổi tiền mặt.')} onCustomer={id=>setDetail({kind:'customer',id})} onInvoice={viewInvoice}/>; break;
    case 'salary':
    case 'commission': content = <PayrollPanel user={data.user} section={tab} today={data.today} refreshKey={data} onOpen={open} />; break;
    case 'products': case 'product_groups': case 'inventory': content = <Products key={tab} section={tab} refreshKey={data} onOpen={open} onInvoice={id => setDetail({ kind: 'invoice', id })} canManage={data.user.role === 'OWNER'} />; break;
    case 'cashier': content = <Cashier key={cashierRevision} data={data} busy={busy} initialMode={searchParams.get('mode') === 'package' ? 'package' : 'service'} initialCustomer={cashierNewCustomer || data.customers.find((c: Row) => c._id === filterValues.customer) || null} onSubmit={run} onInvoices={() => changeTab('invoices')} onNewCustomer={() => open('Thêm khách hàng', 'customer', customerFields.filter(field => field.key !== 'consultantId'))} />; break;
    case 'customers': content = <Panel title="Danh sách khách hàng" action={customerButton}><CustomerList search={search} refreshKey={data} renderRows={rows => rows.map(r => [<div key="name" className="cell-stack"><strong>{r.name}</strong><button onClick={() => setDetail({ kind: 'customer', id: r._id })}>Hồ sơ / lịch sử</button></div>, r.phone, r.notes || '—', <div key="visits" className="cell-stack"><span>Đã đến: {r.lastVisit ? time(r.lastVisit) : '—'}</span><small>Lịch tới: {r.nextVisit ? time(r.nextVisit) : '—'}</small></div>, owner ? <button key="edit" disabled={busy} onClick={() => open('Sửa khách hàng', 'updateCustomer', customerFields, edit(r))}>Sửa</button> : '—'])} /></Panel>; break;
    case 'services': content = <Panel title="Danh mục dịch vụ" action={owner && <div className="actions"><button onClick={()=>open('Tạo nhóm dịch vụ','serviceGroup',[{key:'name',label:'Tên nhóm dịch vụ'}])}>+ Tạo nhóm dịch vụ</button><button className="primary" onClick={() => open('Thêm dịch vụ', 'service', serviceFields)}>＋ Thêm dịch vụ</button></div>}><Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Dịch vụ', 'Nhóm', 'Giá', 'Hoa hồng / lần', 'Trạng thái', 'Thao tác']} rows={listRows('services').map(r => [r.name, r.category || 'Chưa phân nhóm', vnd(r.price), vnd(r.commission || 0), <Badge key="s" value={r.active ? 'ACTIVE' : 'INACTIVE'} />, owner ? <div key="actions" className="actions"><button disabled={busy} onClick={() => open('Sửa dịch vụ', 'updateService', serviceFields, edit(r))}>Sửa</button><button disabled={busy} onClick={() => statusAction(r, 'serviceStatus')}>{r.active ? 'Ngừng hoạt động' : 'Hoạt động lại'}</button></div> : '—'])} /></Panel>; break;
    case 'package_catalog': {
      const fields: Field[] = [{ key: 'name', label: 'Tên gói' }, {...serviceField,type:'service-picker'}, { key: 'price', label: 'Giá toàn gói (VNĐ)', type: 'number', min: 1, max: 1_000_000_000_000 }];
      content = <Panel title="Danh mục liệu trình" action={<button className="primary" onClick={() => open('Thêm gói mẫu', 'packageTemplate', fields)}>+ Thêm gói mẫu</button>}><Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Gói', 'Nhóm', 'Dịch vụ', 'Quyền lợi', 'Giá', 'Trạng thái', 'Thao tác']} rows={listRows('packageTemplates').map(r => [r.name, lookup('services', r.serviceId, 'category'), appointmentServiceName(r, lookup('services', r.serviceId)), packageLabel(r), vnd(r.price), r.active ? 'Đang bán' : 'Ngừng bán', <div key="actions" className="actions"><button onClick={() => open('Sửa gói mẫu', 'updatePackageTemplate', fields, edit(r))}>Sửa</button><button onClick={() => statusAction(r, 'packageTemplateStatus')}>{r.active ? 'Ngừng bán' : 'Bán lại'}</button></div>])} /></Panel>; break;
    }
    case 'appointments': content = <Panel title="Lịch hẹn" action={appointmentButton}><div className="inline-note">Chỉ ghi giờ khách đến; spa tự cân đối ca. Dời lịch khi đã có giờ mới; hoãn khi chưa chốt giờ. Xem gói và lý do trong Chi tiết.</div><div className="view-switch" role="group" aria-label="Cách xem lịch"><button aria-pressed={!agendaView} onClick={() => setAgenda(false)}>Danh sách</button><button aria-pressed={agendaView} onClick={() => setAgenda(true)}>Lịch theo ngày</button></div>{agendaView ? <AppointmentAgenda rows={listRows('appointments')} data={data} pagination={primaryPagination} busy={busy} onCustomer={id => setDetail({ kind: 'customer', id })} onComplete={r => r.treatmentId ? completePackage(r) : completeWithInvoice(r)} /> : <Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Khách / dịch vụ', 'Nhân viên', 'Thời gian', 'Trạng thái', 'Chi tiết', 'Thao tác']} rows={listRows('appointments').map(r => [<div key="customer" className="cell-stack"><strong>{lookup('customers', r.customerId)}</strong><small>{lookup('customers', r.customerId, 'phone')}</small><small>{appointmentServiceName(r, lookup('services', r.serviceId))}</small></div>, lookup('staff', r.staffId), <div key="time" className="cell-stack">{r.status === 'POSTPONED' && <strong>Chờ xếp lại</strong>}<span>{r.status === 'POSTPONED' ? 'Giờ cũ: ' : ''}{time(r.startAt)}</span>{r.endAt && <small>Kết thúc dự kiến cũ: {time(r.endAt)}</small>}</div>, <div key="status" className="cell-stack"><Badge value={r.status} />{linkedInvoice(r) && <button onClick={() => viewInvoice(linkedInvoice(r)._id)}>{invoiceCode(linkedInvoice(r))}</button>}</div>, <details key="details" className="record-details"><summary>Xem chi tiết</summary><div className="cell-stack"><span>{r.treatmentId ? lookup('treatments', r.treatmentId) : 'Dịch vụ lẻ'}</span><small>Lý do: {r.changeReason || '—'}</small><small>Ghi chú: {r.notes || '—'}</small>{r.rescheduledFromId && <small>Lịch cũ: #{r.rescheduledFromId.slice(-6)}</small>}{data.appointments.find((a: Row) => a.rescheduledFromId === r._id) && <small>Đã xếp lại thành lịch #{data.appointments.find((a: Row) => a.rescheduledFromId === r._id)._id.slice(-6)}</small>}</div></details>, ['CONFIRMED', 'POSTPONED'].includes(r.status) && !data.appointments.some((a: Row) => a.rescheduledFromId === r._id) && (finance || r.staffId === data.user.id) ? <div key="actions" className="actions">{r.status === 'CONFIRMED' && <button disabled={busy} onClick={() => r.treatmentId ? completePackage(r) : completeWithInvoice(r)}>{r.treatmentId ? 'Hoàn thành & ghi nhận lần làm' : 'Hoàn thành & lập hóa đơn'}</button>}<button disabled={busy} onClick={() => open(r.status === 'POSTPONED' ? 'Xếp lại lịch · tạo lịch mới' : 'Dời lịch hẹn', 'rescheduleAppointment', [{ key: 'startAt', label: 'Giờ mới · giờ Việt Nam', type: 'datetime-local' }, { key: 'staffId', label: 'Nhân viên thực hiện', options: choices('staff', r => r.name).filter(([id]) => finance || id === data.user.id) }, reasonField], { id: r._id, staffId: r.staffId, startAt: new Date(new Date(r.startAt).getTime() + 7 * 3600000).toISOString().slice(0, 16) })}>{r.status === 'POSTPONED' ? 'Xếp lại lịch' : 'Dời lịch'}</button>{r.status === 'CONFIRMED' && <button disabled={busy} onClick={() => open('Hoãn lịch · chưa xác định giờ mới', 'appointmentStatus', [reasonField], { id: r._id, status: 'POSTPONED' })}>Hoãn lịch</button>}<button disabled={busy} onClick={() => open('Hủy lịch hẹn', 'appointmentStatus', [reasonField], { id: r._id, status: 'CANCELLED' })}>Hủy lịch</button></div> : finance && r.status === 'COMPLETED' && !r.treatmentId && !linkedInvoice(r) ? <button key="create-invoice" disabled={busy} onClick={() => completeWithInvoice(r)}>Lập / liên kết hóa đơn</button> : '—'])} />}</Panel>; break;
    case 'invoices': content = <div className="invoice-list-emphasis"><Panel title="Hóa đơn & công nợ" action={finance && <button className="primary" onClick={() => changeTab('cashier')}>＋ Tạo hóa đơn</button>}><Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Khách / hóa đơn', 'Dịch vụ', 'Thanh toán', 'Trạng thái', 'Liên kết / hạn trả', 'Thao tác']} rows={listRows('invoices').map(r => [<div key="customer" className="cell-stack" data-invoice-origin={r.openingBalance ? "opening" : undefined}>{r.openingBalance && <span className="invoice-import-badge">Nhập ban đầu</span>}<strong>{lookup('customers', r.customerId)}</strong><strong className="invoice-code">{invoiceCode(r)}</strong><small>Ngày lập: {r.createdAt ? <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time> : 'Chưa ghi nhận'}</small><button onClick={() => setDetail({ kind: 'invoice', id: r._id })}>Chi tiết / chữ ký</button><small>Người tạo: {r.creatorName || 'Chưa ghi nhận'}</small></div>, <strong key="service" className="invoice-service-name">{r.description}</strong>, <div key="amounts" className="cell-stack invoice-payment"><div className="invoice-payment-line"><span>Tổng:</span><strong>{vnd(r.total)}</strong></div><div className="invoice-payment-line"><span>Đã trả:</span><strong>{vnd(r.paid)}</strong></div><div className="invoice-payment-line"><span>Còn nợ:</span><strong>{vnd(r.total - r.paid)}</strong></div></div>, <strong key="status" className="invoice-status"><Badge value={r.status === 'CANCELLED' ? 'CANCELLED' : r.paid >= r.total ? 'PAID' : r.paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'} /></strong>, <div key="reference" className="cell-stack"><small>Hạn: {r.dueDate || 'Chưa đặt'}</small>{r.appointmentId && <button onClick={() => { changeTab('appointments', r.appointmentId); }}>Lịch #{r.appointmentId.slice(-6)}</button>}</div>, <div key="invoice-actions" className="cell-stack">{owner && r.status !== 'CANCELLED' && <div className="actions"><button disabled={busy} onClick={()=>editInvoiceFromList(r)}>Sửa hóa đơn</button><button disabled={busy} onClick={()=>cancelInvoice(r)}>Hủy hóa đơn</button></div>}{r.total > r.paid ? <div className="actions"><button disabled={busy} onClick={() => openPayment(r, 'CASH')}>Tiền mặt</button><button disabled={busy} onClick={() => openPayment(r, 'BANK_TRANSFER')}>Chuyển khoản / QR</button></div> : <span key="done">{r.status === 'CANCELLED' ? 'Đã hủy · không tính nợ' : r.total === 0 ? 'Không thu tiền' : 'Đã thu đủ'}</span>}</div>])} /></Panel></div>; break;
    case 'deposits': content = <><Panel title="Tiền cọc của khách" action={<div className="actions">{finance && <button className="primary" onClick={() => open('Nhận tiền cọc', 'deposit', [customerField, amountField, methodField, noteField])}>＋ Nhận cọc</button>}{data.invoices.some((i: Row) => i.canAllocate && i.total > i.paid) && <button onClick={() => open('Phân bổ cọc', 'allocate', [{ key: 'depositId', label: 'Khoản cọc', options: choices('deposits', r => `${lookup('customers', r.customerId)} · Dư ${vnd(r.balance)} · ${invoiceCode(r)}`) }, { ...invoiceField, options: invoiceField.options?.filter(([id]) => data.invoices.some((i: Row) => i._id === id && i.canAllocate && i.total > i.paid)) }, amountField, reasonField])}>Áp dụng cọc</button>}</div>}><div className="inline-note">Phân bổ cọc không phát sinh khoản thu mới. Tiền dư tiếp tục nằm trong số dư cọc.</div><Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Mã', 'Khách hàng', 'Cọc gốc', 'Số dư', 'Ghi chú']} rows={listRows('deposits').map(r => [`#${r._id.slice(-6)}`, lookup('customers', r.customerId), vnd(r.amount), <strong key="balance">{vnd(r.balance)}</strong>, r.note || '—'])} /></Panel><Panel title="Lịch sử phân bổ"><Table resetKey={tableResetKey} headers={['Cọc', 'Hóa đơn', 'Số tiền', 'Lý do', 'Trạng thái', 'Thao tác']} pagination={pageFor('allocations')} rows={listRows('allocations').map((r: Row) => [`#${r.depositId.slice(-6)}`, `#${r.invoiceId.slice(-6)}`, vnd(r.amount), r.reason, r.reversed ? 'Đã đảo' : 'Có hiệu lực', owner && !r.reversed ? <button key="reverse" onClick={() => open('Đảo phân bổ cọc', 'reverseAllocation', [reasonField], { id: r._id })}>Đảo phân bổ</button> : '—'])} /></Panel></>; break;
    case 'packages':
    case 'treatments': content = <><Panel title="Gói liệu trình" action={<div className="actions">{finance && <button className="primary" onClick={() => router.push('/workspace/cashier?mode=package')}>＋ Bán gói</button>}</div>}><div className="inline-note">Dừng liệu trình không tự sinh hoàn tiền. Đã đặt lịch: hoàn thành ca tại Lịch hẹn. Không đặt lịch: ghi nhận buổi tại đây. Cả hai đều cần khách ký. Gói theo buổi trừ 1 buổi; gói theo thời gian ghi nhận lần làm, không giới hạn số lần.</div><Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Khách hàng', 'Số điện thoại', 'Gói', 'Tiến độ', 'Còn lại', 'Trạng thái', 'Thao tác']} rows={listRows('treatments').map(r => [lookup('customers', r.customerId), lookup('customers', r.customerId, 'phone'), <div key="package" className="cell-stack"><strong>{r.name}</strong>{r.giftOfInvoiceId && <small>Quà tặng 0đ · {r.promotion}</small>}{r.status === 'PAUSED' && <small>Bảo lưu đến: {r.holdUntil} · {r.holdReason}. Chờ chủ spa mở lại.</small>}{r.expiresOn && <small>Hạn sử dụng được duyệt: {r.expiresOn}</small>}<small>Hạn thanh toán: {r.paymentDueDate || 'Chưa chọn (gói cũ)'}</small>{r.paymentOverdue && <small className="negative">Quá hạn thanh toán · cần đối soát</small>}</div>, <div key="progress">{r.openingBalance ? `Đã làm ${r.usedSessions || 0} buổi từ chuyển đổi` : timedPackage(r) ? `Đã làm ${r.usedSessions || 0} lần` : <div className="progress"><span style={{ width: `${100 * (r.totalSessions - r.remaining) / r.totalSessions}%` }} /></div>}</div>, packageLabel(r), <Badge key="s" value={r.status} />, <div key="actions" className="actions">{treatmentAvailable(r) && <button disabled={busy} onClick={() => signSession(r)}>Khách không đặt lịch · ghi nhận buổi</button>}{owner && (timedPackage(r) || r.remaining > 0) && (r.status === 'PAUSED' ? <><button disabled={busy} onClick={() => open('Mở lại gói bảo lưu', 'resumeTreatment', [reasonField, { key: 'expiresOn', label: 'Hạn sử dụng mới nếu chủ spa duyệt gia hạn', type: 'date', optional: true, hint: 'Để trống giữ nguyên hạn cũ. Không tự cộng thời gian bảo lưu.' }], { id: r._id }, 'Giữ quyền lợi gói. Gói chỉ được dùng sau khi mở lại thành công; không tự gia hạn sử dụng.')}>Mở lại gói</button><button disabled={busy} onClick={() => open('Gia hạn thời gian bảo lưu', 'extendTreatmentHold', [{ key: 'holdUntil', label: 'Bảo lưu đến ngày', type: 'date' }, reasonField], { id: r._id, holdUntil: r.holdUntil })}>Gia hạn bảo lưu</button></> : r.status === 'ACTIVE' && <button disabled={busy} onClick={() => open('Chủ spa duyệt bảo lưu gói', 'pauseTreatment', [{ key: 'holdUntil', label: 'Bảo lưu đến ngày', type: 'date' }, reasonField], { id: r._id }, 'Xét lý do từng trường hợp. Giữ nguyên số buổi; phải được chủ spa mở lại mới dùng tiếp.')}>Bảo lưu gói</button>)}</div>])} /></Panel></>; break;
    case 'treatment_uses': {
      const filteredUses = listRows('uses');
      content = <>
        <div className="metrics">
          <Metric title="Tổng số buổi đã ghi" value={String(data.totals.uses)} sub="Lịch sử các buổi đã xác nhận" />
          <Metric title="Gói đang hoạt động" value={String(data.totals.activeTreatments)} sub="Gói còn hiệu lực" />
        </div>
        <Panel title="Nhật ký các buổi đã sử dụng" action={<button className="text-button" onClick={() => changeTab('packages')}>← Quay lại Gói liệu trình</button>}>
          <div className="inline-note">Nhân viên cho khách xác nhận buổi liệu trình trên app. Chữ ký được lưu cùng thông tin buổi thực hiện. Các phiếu cũ vẫn giữ lịch sử.</div>
          <Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Gói liệu trình', 'Khách hàng', 'Người ghi', 'Thời gian', 'Phương thức', 'Xác nhận của khách']} rows={filteredUses.map((r: Row) => {
            const trt = data.treatments.find((t: Row) => t._id === r.treatmentId);
            return [
              trt ? trt.name : lookup('treatments', r.treatmentId),
              trt ? lookup('customers', trt.customerId) : '—',
              lookup('staff', r.actorId),
              time(r.performedAt),
              label(r.method),
              <div key="ref" className="cell-stack">
                {r.method === 'DRAWN_SIGNATURE' ? (owner || r.actorId === data.user.id || r.staffId === data.user.id ? <button disabled={busy} onClick={() => viewSignature(r)}>Xem chữ ký · buổi {r.sessionNumber}</button> : <span>Đã ký · buổi {r.sessionNumber}</span>) : <span>Phiếu cũ: {r.evidenceReference || label(r.method)}</span>}
                {r.reason && <small>Lý do: {r.reason}</small>}
              </div>
            ];
          })} />
        </Panel>
      </>;
      break;
    }
    case 'cash': content = <><div className="metrics"><Metric title="Thu trong bộ lọc" value={viewPending ? '…' : vnd(data.pages.cash?.summary?.incoming || 0)} sub="Toàn bộ kết quả phù hợp" /><Metric title="Chi trong bộ lọc" value={viewPending ? '…' : vnd(data.pages.cash?.summary?.outgoing || 0)} sub="Toàn bộ kết quả phù hợp" /><Metric title="Chênh lệch thu / chi" value={viewPending ? '…' : vnd((data.pages.cash?.summary?.incoming || 0) - (data.pages.cash?.summary?.outgoing || 0))} sub="Giữ cả giao dịch đảo" /></div><Panel title="Sổ giao dịch" action={finance && <button className="primary" onClick={() => open('Ghi thu / chi khác', 'cash', [{ key: 'direction', label: 'Loại giao dịch', options: [['IN', 'Thu khác'], ['OUT', 'Chi phí']] }, amountField, methodField, { ...noteField, optional: false }])}>＋ Ghi thu chi</button>}><div className="inline-note">Tiền khách trả hóa đơn và tiền cọc phải ghi ở đúng module để cập nhật công nợ. Đảo giao dịch tạo bút toán ngược trong ngày hiện tại.</div><Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Thời gian', 'Nội dung', 'Người tạo', 'Loại', 'Phương thức', 'Số tiền', 'Trạng thái', 'Thao tác']} rows={listRows('cash').map(r => [time(r.createdAt), <div key="receipt-note" className="cell-stack"><span>{r.note || label(r.kind)}</span><small>#{r._id.slice(-6)}</small>{r.transferReference && <small>Ảnh nhóm: {r.transferReference}</small>}</div>, lookup('staff', r.actorId), label(r.kind), label(r.method), <span key="amount" className={r.direction === 'IN' ? 'positive' : 'negative'}>{r.direction === 'IN' ? '+' : '−'}{vnd(r.amount)}</span>, r.reversed ? 'Đã đảo · vẫn giữ sổ gốc' : 'Đã ghi nhận', owner && !r.reversed && !['REVERSAL', 'PAYROLL', 'REFUND'].includes(r.kind) ? <button key="reverse" onClick={() => open('Đảo giao dịch sai · không phải hoàn tiền khách', 'reverseCash', [reasonField], { id: r._id })}>Đảo sai sót</button> : '—'])} /></Panel></>; break;
    case 'days': content = <Panel title="Chốt sổ tiền mặt" action={data.todayDay ? data.todayDay.status === 'CLOSED' && owner ? <button className="primary" disabled={busy} onClick={() => open('Mở lại sổ hôm nay', 'reopenDay', [reasonField], { day: data.today })}>Mở lại sổ hôm nay</button> : <button disabled>{data.todayDay.status === 'OPEN' ? 'Sổ hôm nay đang mở' : 'Sổ hôm nay đã chốt'}</button> : <button className="primary" disabled={busy || viewPending} onClick={() => open('Mở sổ hôm nay', 'openDay', [{ key: 'day', label: 'Ngày', type: 'date' }, { key: 'opening', label: 'Tiền mặt đầu ngày (VND)', type: 'number', min: 0 }], { day: data.today, opening: 0 })}>+ Mở sổ</button>}><div className="inline-note" role="status">Sổ hôm nay ({data.today}): {data.todayDay ? data.todayDay.status === 'OPEN' ? 'Đang mở — có thể ghi nhận thu chi.' : 'Đã chốt — chủ spa cần mở lại trước khi ghi tiền.' : 'Chưa mở.'} Trạng thái này không phụ thuộc bộ lọc danh sách.</div><div className="inline-note">Tiền mặt kỳ vọng = đầu ngày + thực thu tiền mặt − thực chi tiền mặt. Chênh lệch được giữ nguyên, không tự tạo khoản cân sổ.</div><Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Ngày', 'Đầu ngày', 'Kỳ vọng khi chốt', 'Đã đếm', 'Chênh lệch', 'Trạng thái', 'Thao tác']} rows={listRows('days').map((r: Row) => [r.day, vnd(r.opening), r.expected === undefined ? '—' : vnd(r.expected), r.counted === undefined ? '—' : vnd(r.counted), r.difference === undefined ? '—' : <span key="diff" className={r.difference ? 'negative' : 'positive'}>{vnd(r.difference)}</span>, <Badge key="s" value={r.status} />, r.status === 'OPEN' ? <button key="close" onClick={() => open('Chốt sổ cuối ngày', 'closeDay', [{ key: 'counted', label: 'Tiền mặt đếm thực tế (VNĐ)', type: 'number', min: 0 }, noteField], { day: r.day })}>Chốt sổ</button> : owner ? <button key="reopen" onClick={() => open('Mở lại sổ · chỉ chủ spa', 'reopenDay', [reasonField], { day: r.day })}>Mở lại</button> : '—'])} /></Panel>; break;
    case 'reports': content = <Reports report={data.report} today={data.today} period={period} onPeriod={setPeriod} pending={viewPending} owner={owner} onInvoice={id => setDetail({ kind: 'invoice', id })} onStaff={setSelectedStaff} onPage={page => setListPaging(previous => ({ ...previous, key: filterKey, page }))} />; break;
    case 'staff': content = <div className="staff-workspace">
      <div className="report-stats staff-stats" aria-label="Thống kê nhân sự">
        <div className="report-stat"><small>Tổng nhân sự</small><strong>{data.staff.length}</strong></div>
        <div className="report-stat"><small>Đang hoạt động</small><strong>{data.staff.filter((s: Row) => s.active).length}</strong></div>
        <div className="report-stat"><small>Đã khóa</small><strong>{data.staff.filter((s: Row) => !s.active).length}</strong></div>
      </div>
      <Panel title="Nhân sự trong spa" action={owner && <button className="primary" onClick={() => open('Tạo tài khoản nhân viên', 'user', [{ key: 'name', label: 'Họ và tên' }, { key: 'phone', label: 'Số điện thoại', type: 'tel' }, { key: 'password', label: 'Mật khẩu ban đầu · tối thiểu 12 ký tự', type: 'password' }, { key: 'cashier', label: 'Cấp quyền thu ngân', type: 'checkbox', optional: true }])}>＋ Thêm nhân viên</button>}>
        <Table pagination={primaryPagination} resetKey={tableResetKey} headers={['Nhân viên', 'Vai trò & quyền', 'Trạng thái', 'Thao tác']} rows={listRows('staff').map((r: Row) => [
          <div key="identity" className="cell-stack staff-identity"><button className="text-button" onClick={() => setSelectedStaff(r._id)}>{r.name}</button><small>{r.phone || r.email || 'Chưa có số điện thoại'}</small></div>,
          <div key="role" className="cell-stack"><span>{label(r.role)}</span><small>{r.role === 'OWNER' ? 'Toàn quyền quản lý' : r.cashier ? 'Có quyền thu ngân' : 'Quyền nhân viên'}</small></div>,
          <span key="status" className={'badge ' + (r.active ? 'active' : 'inactive')}>{r.active ? 'Hoạt động' : 'Đã khóa'}</span>,
          owner && r.role === 'STAFF' ? <div key="actions" className="actions"><button disabled={busy} onClick={() => open('Sửa nhân viên', 'updateUser', staffFields, edit(r))}>Sửa</button><button disabled={busy} onClick={() => statusAction(r, 'userStatus')}>{r.active ? 'Khóa tài khoản' : 'Mở lại tài khoản'}</button></div> : <span key="owner">Tài khoản chủ spa</span>
        ])} />
      </Panel>
    </div>; break;
    case 'audit': content = <AuditLog data={data} filters={auditFilters} onFiltersChange={changes => setAuditFilters(previous => ({ ...previous, ...changes }))} pagination={primaryPagination} />; break;
    default: content = null;
  }
  if (!canViewPage(tab, data.user)) content = <Panel title="Không thể mở mục này"><p>Mục chưa triển khai hoặc tài khoản không có quyền truy cập.</p></Panel>;
  function renderMenu(node: (typeof menu)[number]): React.ReactNode {
    if (node.key === 'audit' || node.key === 'treatment_uses') return null;
    if (node.children) {
      const children = node.children.map(child => renderMenu(child)).filter(Boolean);
      if (!children.length) return null;
      return <div className="nav-group" key={node.key}><button type="button" className="nav-group-header" aria-expanded={!!expandedGroups[node.key]} onClick={() => toggleGroup(node.key)}><span>{node.title}</span><span aria-hidden="true">{expandedGroups[node.key] ? '▾' : '▸'}</span></button>{expandedGroups[node.key] && <div className="nav-group-items">{children}</div>}</div>;
    }
    if (node.pending) return <span key={node.key} className="nav-item nav-pending" aria-disabled="true" title="Chờ xác định nghiệp vụ">{node.title}<small>Chưa triển khai</small></span>;
    if (!canViewPage(node.key, data!.user)) return null;
    return <Link key={node.key} href={workspaceHref(node.key)} className={tab === node.key ? 'nav-item active' : 'nav-item'} aria-current={tab === node.key ? 'page' : undefined} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); changeTab(node.key); }} prefetch={false}>{node.title}</Link>;
  }
  return <div className="app has-notification-bar">
    <header className="mobile-toolbar">
      <div className="mobile-brand-row">
        <button ref={mobileMenuButton} type="button" className="mobile-menu-toggle" aria-label="Mở hoặc đóng menu" title="Menu" aria-expanded={mobileMenuOpen} aria-controls="mobile-menu-panel" onClick={() => setMobileMenuOpen(open => !open)}>☰</button>
        <Brand href="/workspace" />
        <span className="mobile-account" title={data.user.name + " · " + label(data.user.role)}>{data.user.name}<small>{label(data.user.role)}</small></span>
        <button type="button" aria-label="Đăng xuất" onClick={logout}>↪</button>
      </div>
    </header>
    <aside className="sidebar">
      <Brand href="/workspace" />
      <div className="workspace-label">KHÔNG GIAN QUẢN LÝ</div>
      <nav aria-label="Menu chính">{menu.map(node => renderMenu(node))}</nav>
      <div className="sidebar-bottom">
        <div className="avatar">{data.user.name.charAt(0)}</div>
        <div><strong>{data.user.name}</strong><small>{label(data.user.role)}{data.user.cashier && !owner ? ' · Thu ngân' : ''}</small></div>
        <button aria-label="Đăng xuất" title="Đăng xuất" onClick={logout}>↪</button>
      </div>
    </aside>
    <main className="main">
      <Notifications key={data.user.id} />
      <header className="topbar">
        <span>SpaCare <b>/</b> {currentBreadcrumbs.join(' / ')}</span>
        <div><span className="online-dot" />{new Date(`${data.today}T00:00:00+07:00`).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </header>
      <div className="page" data-section={tab}>
        <div className="page-heading">
          <div>
            <span className="eyebrow">SPACARE / {currentBreadcrumbs.join(' / ').toUpperCase()}</span>
            <h1>{pageTitle}</h1>
            <p>{headers[tab]}</p>
          </div>
          {!['cash_cards', 'overview', 'cashier', 'reports', 'days', 'salary', 'commission', 'audit', 'products', 'product_groups', 'inventory'].includes(tab) && (
            <input className="search" maxLength={100} placeholder="Tìm trong danh sách…" aria-label="Tìm kiếm" value={search} onCompositionStart={() => { composingSearch.current = true; clearTimeout(searchTimer.current); }} onCompositionEnd={e => { composingSearch.current = false; setSearch(e.currentTarget.value); }} onChange={e => setSearch(e.target.value)} />
          )}
        </div>
        {error && !modal && <div className="alert error" role="alert">{error}</div>}
        {notice && <div className="alert success" role="status">{notice}</div>}
        <ListFiltersBar section={tab} values={filterValues} today={data.today} staff={data.staff} categories={serviceGroupNames(data.serviceGroups||[],data.services)} onChange={setFilters} />{viewPending && !['customers', 'salary', 'commission', 'products', 'product_groups', 'inventory', 'cash_cards'].includes(tab) ? <p role="status">{'Đang tải dữ liệu...'}</p> : content}
        <footer>SpaCare · MVP nội bộ <span>Giờ Việt Nam · VNĐ</span></footer>
      </div>
    </main>
    {mobileMenuOpen && <>
      <button className="mobile-menu-backdrop" type="button" aria-label="Đóng menu" onClick={closeMobileMenu} />
      <section className="mobile-menu-panel" id="mobile-menu-panel" aria-label="Điều hướng di động">
        <div className="mobile-menu-heading"><strong>Menu SpaCare</strong><button type="button" aria-label="Đóng menu" onClick={closeMobileMenu}>✕</button></div>
        <nav aria-label="Menu di động">{menu.map(node => renderMenu(node))}</nav>
      </section>
    </>}
    <nav className="mobile-bottom-nav" aria-label="Menu chính trên điện thoại" style={{ gridTemplateColumns: `repeat(${menu.filter(node => pageKeys([node]).some(key => canViewPage(key, data.user))).length}, minmax(0, 1fr))` }}>
      {menu.filter(node => pageKeys([node]).some(key => canViewPage(key, data.user))).map(node => node.children ? (
        <button type="button" key={node.key} className={activeMenuGroup === node.key ? 'active' : ''} aria-expanded={mobileMenuOpen && !!expandedGroups[node.key]} aria-controls="mobile-menu-panel" onClick={() => openMobileGroup(node.key)}>
          <span className="mobile-nav-icon" aria-hidden="true">{({ products_group: '▣', operations: '◷', services_treatments: '✧', finance: '₫', admin: '⚙' } as Record<string, string>)[node.key]}</span><small>{node.title}</small>
        </button>
      ) : (
        <Link href={workspaceHref(node.key)} key={node.key} className={tab === node.key ? 'active' : ''} aria-current={tab === node.key ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}><span className="mobile-nav-icon" aria-hidden="true">⌂</span><small>{node.title}</small></Link>
      ))}
    </nav>
    {selectedStaff && <StaffDetail key={selectedStaff} id={selectedStaff} onClose={() => setSelectedStaff(null)} onSchedule={id => router.push('/workspace/appointments?employee=' + id)} />}
    {detail && <InvoiceDetail onCancel={owner ? cancelInvoice : undefined} canManageCards={finance} key={detail.kind + detail.id} record={detail} onClose={() => setDetail(null)} onEdit={owner ? editInvoice : undefined} onInvoice={id => setDetail({ kind: 'invoice', id })} onPayment={(invoice, method) => { setDetail(null); openPayment(invoice, method); }} onRefund={owner ? invoice => { setDetail(null); open('Ghi nhận hoàn tiền gói', 'refundPackage', [amountField, methodField, reasonField, {key:'exceptionApproved',label:'Chủ spa đã duyệt ngoại lệ hoàn tiền, không phải tự hoàn khi dừng gói',type:'checkbox'}, {key:'receivedConfirmation',label:'Đã thực trả tiền cho khách',type:'checkbox'}, {key:'transferReference',label:'Tham chiếu chuyển khoản',optional:true}], {invoiceId:invoice._id,method:'CASH'}, 'Chỉ ghi sau khi chủ spa quyết định và đã thực hoàn tiền. Điều chỉnh hoa hồng tương ứng; không tự khôi phục buổi, xóa nợ hoặc sửa bảng lương đã duyệt.'); } : undefined} onCompleteService={finance ? invoice => { setDetail(null); open('Hoàn thành dịch vụ lẻ', 'completeInvoiceService', [{ key: 'staffId', label: 'Nhân viên trực tiếp thực hiện', options: choices('staff', r => r.name) }], { id: invoice._id }, 'Xác nhận dịch vụ đã thực hiện xong. Hoa hồng cố định được ghi cho nhân viên bạn chọn, không phụ thuộc hóa đơn đã trả tiền.'); } : undefined} onBook={bookCustomer} onSell={finance ? id => router.push('/workspace/cashier?customer=' + id) : undefined} />}
    {modal && <FormModal catalogs={data} fieldErrors={fieldErrors} spec={modal} busy={busy} error={error} onClose={() => { if (!busy) { setModal(null); setError(''); } }} onSubmit={values => run(modal.action, values)} />}
  </div>;
}
function Metric({ title, value, sub }: { title: string; value: string; sub: string }) { return <section className="metric"><span>{title}</span><strong>{value}</strong><small>{sub}</small></section>; }
function Badge({ value }: { value: string }) { return <span className={`badge ${value.toLowerCase()}`}>{label(value)}</span>; }
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="panel"><div className="section-head"><h3>{title}</h3>{action}</div>{children}</section>; }
function CustomerList({ search, refreshKey, renderRows }: { search: string; refreshKey: unknown; renderRows: (rows: Row[]) => React.ReactNode[][] }) {
  const [paging, setPaging] = useState({ search, page: 1, pageSize: 10 });
  const page = paging.search === search ? paging.page : 1;
  const [result, setResult] = useState<{ customers: Row[]; total: number; page: number; query: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const query = new URLSearchParams({ search, page: String(page), pageSize: String(paging.pageSize) }).toString();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/customers?' + query, { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Không tải được khách hàng.');
        if (!controller.signal.aborted) { setResult({ ...payload, query }); setLoading(false); }
      } catch (e) { if (!controller.signal.aborted) { setError((e as Error).message); setLoading(false); } }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, refreshKey, retry]);
  const current = result?.query === query && !loading && !error ? result : null;
  return <>
    {loading && <p role="status">Đang tải khách hàng…</p>}
    {error && <div className="alert error" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Thử lại</button></div>}
    {!loading && !error && <Table resetKey={query} headers={['Khách hàng', 'Điện thoại', 'Ghi chú', 'Lịch chăm sóc', 'Thao tác']} rows={renderRows(current?.customers || [])} pagination={{ page: current?.page || page, pageSize: paging.pageSize, total: current?.total || 0, onChange: (next, pageSize) => setPaging({ search, page: next, pageSize }) }} />}
  </>;
}
type ServerPagination = { loading?: boolean; page: number; pageSize: number; total: number; onChange: (page: number, pageSize: number) => void };
function Table({ headers, rows, resetKey, pagination }: { headers: string[]; rows: React.ReactNode[][]; resetKey: string; pagination?: ServerPagination }) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => { if (window.matchMedia('(max-width: 700px)').matches) setPageSize(5); }, []);
  useEffect(() => { setPage(1); }, [resetKey, pageSize, rows.length]);
  const size = pagination?.pageSize || pageSize;
  const total = pagination?.total ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(pagination?.page || page, pageCount);
  const offset = (currentPage - 1) * size;
  const visibleRows = pagination ? rows : rows.slice(offset, offset + size);
  const changePage = (next: number) => {
    const target = Math.max(1, Math.min(next, pageCount));
    if (pagination) pagination.onChange(target, size); else setPage(target);
    container.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  return <div className="paginated-table" ref={container}>
    <div className="table-toolbar"><label>Số dòng<select aria-label="Số dòng mỗi trang" value={size} onChange={e => pagination ? pagination.onChange(1, Number(e.target.value)) : setPageSize(Number(e.target.value))}>{[5, 10, 20, 50].map(size => <option value={size} key={size}>{size}</option>)}</select></label><span role="status">{rows.length ? offset + 1 : 0}–{Math.min(offset + size, total)} / {total} bản ghi</span></div>
    <div className="table-scroll"><table className="responsive-table" role="table"><thead role="rowgroup"><tr role="row">{headers.map(h => <th key={h} scope="col" role="columnheader">{h}</th>)}</tr></thead><tbody role="rowgroup">{visibleRows.length ? visibleRows.map((r, i) => <tr key={offset + i} role="row">{r.map((v, j) => <td key={j} role="cell" data-label={headers[j]} className={headers[j] === 'Thao tác' ? 'table-actions' : ''}><div className="cell-value"><CompactCell value={v} actions={headers[j] === "Thao tác"} /></div></td>)}</tr>) : <tr className="empty-row" role="row"><td colSpan={headers.length} role="cell"><div className="empty"><span aria-hidden="true">✧</span>{pagination?.loading ? 'Đang tải dữ liệu…' : 'Không có bản ghi phù hợp.'}</div></td></tr>}</tbody></table></div>
    {pageCount > 1 && <nav className="table-pagination" aria-label="Phân trang danh sách"><button type="button" disabled={pagination?.loading || currentPage === 1} onClick={() => changePage(currentPage - 1)}>← Trước</button><span>Trang {currentPage} / {pageCount}</span><button type="button" disabled={pagination?.loading || currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>Sau →</button></nav>}
  </div>;
}
function CompactCell({ value, actions }: { value: React.ReactNode; actions: boolean }) {
  if (!actions || !isValidElement<{ className?: string }>(value) || value.props.className !== 'actions') return <>{value}</>;
  return <details className="row-action-menu" onClick={e => { if (e.target instanceof Element && e.target.closest('button:not(:disabled)')) e.currentTarget.open = false; }}><summary>Thao tác <span aria-hidden="true">⌄</span></summary><div className="row-action-options">{value}</div></details>;
}
export function FormModal({ spec, busy, error, fieldErrors={}, onClose, onSubmit, catalogs }: { catalogs: Row; fieldErrors?:Record<string,string>; spec: FormSpec; busy: boolean; error: string; onClose: () => void; onSubmit: (values: Row) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Row>(spec.defaults || {});
  const [localError,setLocalError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [signature, setSignature] = useState<Signature>({ version: 1, strokes: [] });
  const packageOptions = spec.fields.find(f => f.key === 'treatmentId');
  useEffect(() => {
    if (!packageOptions?.optionScopes) return;
    const matches = (packageOptions.options || []).filter(([id]) => packageOptions.optionScopes?.[id]?.customerId === selected.customerId && packageOptions.optionScopes?.[id]?.serviceId === selected.serviceId);
    setSelected(previous => ({ ...previous, treatmentId: matches.length === 1 ? matches[0][0] : '' }));
  }, [selected.customerId, selected.serviceId, packageOptions]);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('input,select,button')?.focus(); }, []);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    if (uploadingImage) { e.preventDefault(); return; }
    e.preventDefault(); setLocalError(''); try { const fd = new FormData(e.currentTarget); const values: Row = { ...spec.defaults };
    for (const field of spec.fields) {
      const value = fd.get(field.key);
      if (field.optional && (value === '' || value === null) && field.type !== 'checkbox') { delete values[field.key]; continue; }
      if (field.type === 'number' && moneyField(field.key) && value !== null && value !== '') {
        const amount = parseMoney(String(value));
        if (amount < (field.min ?? 0) || amount > (field.max ?? 1_000_000_000_000)) {setLocalError(field.label + ': số tiền ngoài giới hạn cho phép.');return;}
      }
      values[field.key] = field.type === 'checkbox' ? value === 'on' : field.type === 'number' ? (moneyField(field.key) ? parseMoney(String(value)) : Number(value)) : field.type === 'datetime-local' ? new Date(`${value}:00+07:00`).toISOString() : value;
    }
    if (['packageTemplate', 'updatePackageTemplate'].includes(spec.action)) {
      values.packageType = fd.get('packageType'); delete values.totalSessions; delete values.durationMonths;
      const key = values.packageType === 'TIME' ? 'durationMonths' : 'totalSessions'; values[key] = Number(fd.get(key));
    }
    if (spec.action === 'sellPackage' && fd.get('participantIds')) values.participantIds = JSON.parse(String(fd.get('participantIds')));
    if (spec.action === 'sellPackage' && fd.get('startsOn')) values.startsOn = fd.get('startsOn');
    if (spec.action === 'invoice' || spec.action === 'sellPackage') {
      for (const key of spec.action === 'invoice' ? ['serviceId', 'description', 'total'] : ['templateId', 'total', 'promotion', 'gifts']) {
        values[key] = key === 'total' ? parseMoney(String(fd.get(key))) : key === 'gifts' ? JSON.parse(String(fd.get(key) || '[]')) : fd.get(key);
      }
    }
    if (spec.action === 'invoice' && fd.get('cashCard')) values.cashCard = JSON.parse(String(fd.get('cashCard')));
    if (spec.action === 'invoice' && !String(values.description || '').trim()) delete values.description;
    if (spec.action === 'invoice' && fd.get('treatmentId')) {
      const drawn = JSON.parse(String(fd.get('signature') || 'null'));
      if (!isValidSignature(drawn)) { window.alert('Khách cần ký xác nhận buổi liệu trình.'); return; }
      values.treatmentId = fd.get('treatmentId'); values.signature = drawn; values.remainingBefore = Number(fd.get('remainingBefore'));
    }
    if (spec.signatureContext) { if (!isValidSignature(signature)) return; values.signature = signature; }
    onSubmit(values); } catch(e) {setLocalError((e as Error).message);}
  }
  return <div className="modal-backdrop"><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onKeyDown={e => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Tab') {
      const focusable = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }}><div className="section-head"><h2 id="modal-title">{spec.title}</h2><button disabled={busy} aria-label="Đóng" onClick={onClose}>×</button></div><ValidatedForm fieldErrors={fieldErrors} onSubmit={submit}>{spec.description && <p>{spec.description}</p>}{spec.transfer && <section className="payment-instructions"><strong>Thông tin nhận chuyển khoản</strong>{spec.transfer.bankName && spec.transfer.accountNumber && spec.transfer.accountName ? <><p>{spec.transfer.bankName}<br />Số tài khoản: {spec.transfer.accountNumber}<br />Chủ tài khoản: {spec.transfer.accountName}</p>{spec.transfer.qrImagePath && <img src={spec.transfer.qrImagePath} alt="Mã QR tài khoản nhận tiền của spa" width={240} height={240} />}<p>Nhập số tiền muốn thanh toán và nội dung bên dưới khi chuyển khoản. QR tài khoản không tự điền số tiền của hóa đơn.</p></> : <p>Chưa cấu hình tài khoản nhận tiền/QR. Liên hệ chủ spa để lấy thông tin chính xác.</p>}<p>Nội dung: <strong>{spec.transfer.reference}</strong></p><small>Quét mã chưa có nghĩa là đã thanh toán. Chỉ xác nhận sau khi kiểm tra tiền thực nhận.</small></section>}{spec.fields.length === 0 && !spec.description && <p>Thay đổi trạng thái bản ghi này? Lịch sử được giữ lại. Lịch hẹn chưa xử lý cần được hoàn thành hoặc hủy trước.</p>}{spec.signatureContext && <section className="session-confirmation"><dl><dt>Khách hàng</dt><dd>{spec.signatureContext.customer}</dd><dt>Gói liệu trình</dt><dd>{spec.signatureContext.packageName}</dd><dt>Nhân viên thực hiện</dt><dd>{selected.staffId ? spec.fields.find(f => f.key === 'staffId')?.options?.find(([id]) => id === selected.staffId)?.[1] || spec.signatureContext.staff : spec.signatureContext.staff}</dd><dt>Buổi xác nhận</dt><dd>Buổi {spec.signatureContext.sessionNumber} · quyền lợi trước khi ghi: {spec.signatureContext.remaining}</dd></dl>{spec.fields.find(f => f.key === 'staffId') && <label>Nhân viên trực tiếp thực hiện<select name="staffId" required value={selected.staffId || ''} disabled={busy} onChange={e => { setSelected(previous => ({ ...previous, staffId: e.target.value })); setSignature({ version: 1, strokes: [] }); }}><option value="">Chọn nhân viên…</option>{spec.fields.find(f => f.key === 'staffId')?.options?.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>}<SignaturePad value={signature} onChange={setSignature} disabled={busy || (!!spec.fields.find(f => f.key === 'staffId') && !selected.staffId)} /></section>}{spec.readOnly && (spec.signaturePreview ? <SignatureImage signature={spec.signaturePreview} /> : <p>Phiếu cũ không có chữ ký trên màn hình.</p>)}{spec.fields.filter(f => !(spec.signatureContext && f.key === 'staffId')).map(f => f.type==='service-group' ? <ServiceGroupField key={f.key} groups={catalogs.serviceGroups||[]} services={catalogs.services||[]} initial={spec.defaults?.category||''} disabled={busy}/> : f.type==='service-picker' ? <ServicePickerField key={f.key} services={catalogs.services||[]} initial={spec.defaults?.serviceId||''} disabled={busy}/> : f.remoteCustomers ? <div key={f.key}><CustomerPicker label={f.label} value={selected[f.key] || ''} onChange={value => setSelected(previous => ({ ...previous, [f.key]: value }))} required={!f.optional} disabled={busy} />{['invoice', 'sellPackage'].includes(spec.action) && <CommercialFields key={selected.customerId || 'new'} action={spec.action} data={catalogs} disabled={busy} customerId={selected.customerId} />}</div> : f.type === 'product-image' ? <ProductImagePicker key={f.key} name={f.key} initialValue={spec.defaults?.[f.key]} disabled={busy} onBusyChange={setUploadingImage} /> : <label key={f.key}>{f.label}{f.type === 'checkbox' ? <input type="checkbox" name={f.key} required={!f.optional} defaultChecked={spec.defaults?.[f.key]} /> : f.options ? <select name={f.key} required={!f.optional} value={selected[f.key] || ''} onChange={e => { setSelected(previous => ({ ...previous, [f.key]: e.target.value })); if (spec.signatureContext && f.key === 'staffId') setSignature({ version: 1, strokes: [] }); }}><option value="">Chọn…</option>{f.options.filter(([id]) => !f.optionScopes || (f.optionScopes[id]?.customerId === selected.customerId && f.optionScopes[id]?.serviceId === selected.serviceId)).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select> : f.type === 'number' && moneyField(f.key) ? <MoneyInput name={f.key} required={!f.optional} defaultValue={spec.defaults?.[f.key]} /> : <input name={f.key} type={f.type || 'text'} required={!f.optional} min={f.min} max={f.max} step={f.type === 'number' ? f.step ?? 1 : undefined} maxLength={f.type === 'password' ? 128 : 2000} defaultValue={spec.defaults?.[f.key]} />}{f.hint && <small>{f.hint}</small>}</label>)}{['packageTemplate', 'updatePackageTemplate'].includes(spec.action) && <PackageTypeFields initial={spec.defaults} />}{(error || localError) && <div className="alert error" role="alert">{error || localError}</div>}<div className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>{spec.readOnly ? 'Đóng' : 'Hủy'}</button>{!spec.readOnly && <button className="primary" disabled={busy || uploadingImage || (['packageTemplate','updatePackageTemplate'].includes(spec.action) && !(catalogs.services||[]).some((service:Row)=>service.active!==false||service._id===spec.defaults?.serviceId)) || (!!spec.signatureContext && !isValidSignature(signature))}>{busy ? 'Đang lưu…' : spec.action === 'completeAppointment' ? 'Xác nhận hoàn thành & liên kết hóa đơn' : spec.action === 'completeTreatmentAppointment' ? 'Xác nhận hoàn thành & trừ 1 buổi' : spec.action === 'use' ? 'Xác nhận chữ ký & ghi 1 buổi' : spec.action === 'payment' ? 'Xác nhận đã nhận tiền' : 'Lưu thông tin'}</button>}</div></ValidatedForm></div></div>;
}
