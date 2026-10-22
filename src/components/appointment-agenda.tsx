type Row = Record<string, any>;
const statuses: Record<string, string> = { CONFIRMED: 'Đã đặt', POSTPONED: 'Đang hoãn', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };
export default function AppointmentAgenda({ rows, data, onCustomer, onComplete, busy, pagination }: {
  rows: Row[]; data: Row; onCustomer: (id: string) => void; onComplete: (row: Row) => void; busy: boolean;
  pagination?: { page: number; pageSize: number; total: number; loading?: boolean; onChange: (page: number, pageSize: number) => void };
}) {
  const lookup = (key: string, id: string) => data[key].find((r: Row) => r._id === id)?.name || '—';
  const groups = new Map<string, Row[]>();
  for (const row of [...rows].sort((a, b) => a.startAt.localeCompare(b.startAt))) {
    const day = new Date(row.startAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    groups.set(day, [...groups.get(day) || [], row]);
  }
  return <div className="appointment-agenda">
    {[...groups].map(([day, visits]) => <section key={day}><h3>{day}</h3>{visits.map(r => <article key={r._id} className="agenda-visit">
      <strong className="agenda-time">{new Date(r.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</strong>
      <div className="cell-stack"><button className="text-button" onClick={() => onCustomer(r.customerId)}>{lookup('customers', r.customerId)}</button><strong>{lookup('services', r.serviceId)}</strong><small>{lookup('staff', r.staffId)}{r.treatmentId ? ' · Dùng liệu trình' : ' · Dịch vụ lẻ'}</small>{r.notes && <small>{r.notes}</small>}</div>
      <div className="cell-stack"><span className={'badge ' + r.status.toLowerCase()}>{statuses[r.status]}</span>{r.status === 'CONFIRMED' && <button disabled={busy} onClick={() => onComplete(r)}>Hoàn thành</button>}</div>
    </article>)}</section>)}
    {!rows.length && <p role="status">{pagination?.loading ? 'Đang tải lịch…' : 'Không có lịch phù hợp.'}</p>}
    {pagination && pagination.total > pagination.pageSize && <div className="customer-picker-pages"><button disabled={pagination.loading || pagination.page <= 1} onClick={() => pagination.onChange(pagination.page - 1, pagination.pageSize)}>Trước</button><span>Trang {pagination.page}/{Math.ceil(pagination.total / pagination.pageSize)}</span><button disabled={pagination.loading || pagination.page * pagination.pageSize >= pagination.total} onClick={() => pagination.onChange(pagination.page + 1, pagination.pageSize)}>Sau</button></div>}
  </div>;
}
