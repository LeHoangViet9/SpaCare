type Row = Record<string, any>;
const statuses: Record<string, string> = { CONFIRMED: 'Đã đặt', POSTPONED: 'Đang hoãn', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };
const OPEN_MINUTES = 9 * 60;
const CLOSE_MINUTES = 22 * 60;
const SLOT_MINUTES = 30;
const SLOT_COUNT = (CLOSE_MINUTES - OPEN_MINUTES) / SLOT_MINUTES;

function localMinutes(value: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

export default function AppointmentAgenda({ rows, data, onCustomer, onComplete, busy, pagination }: {
  rows: Row[]; data: Row; onCustomer: (id: string) => void; onComplete: (row: Row) => void; busy: boolean;
  pagination?: { page: number; pageSize: number; total: number; loading?: boolean; onChange: (page: number, pageSize: number) => void };
}) {
  const lookup = (key: string, id: string) => data[key].find((r: Row) => r._id === id)?.name || '-';
  const groups = new Map<string, Row[]>();
  for (const row of [...rows].sort((a, b) => a.startAt.localeCompare(b.startAt))) {
    const day = new Date(row.startAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    groups.set(day, [...groups.get(day) || [], row]);
  }
  return <div className="appointment-agenda">
    {[...groups].map(([day, visits]) => {
      const staffIds = [...new Set(visits.map(row => row.staffId))];
      return <section key={day}>
      <h3>{day}</h3>
      <div className="appointment-timeline-scroll" role="region" aria-label={`Lịch hẹn ngày ${day}`} tabIndex={0}>
        <div className="appointment-timeline">
          <div className="timeline-corner">Nhân viên</div>
          {Array.from({ length: 14 }, (_, index) => <strong className="timeline-hour" key={index}>{`${String(index + 9).padStart(2, '0')}:00`}</strong>)}
          {staffIds.map(staffId => {
            const staffVisits = visits.filter(row => row.staffId === staffId);
            return <div className="timeline-staff-row" key={`${day}-${staffId}`}>
              <strong className="timeline-staff-name" title={lookup('staff', staffId)}>{lookup('staff', staffId)}</strong>
              <div className="timeline-track">
                {Array.from({ length: SLOT_COUNT }, (_, index) => <span className="timeline-slot" key={index} />)}
                {staffVisits.map(row => {
                  const start = localMinutes(row.startAt);
                  const end = localMinutes(row.endAt);
                  const startSlot = Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor((start - OPEN_MINUTES) / SLOT_MINUTES)));
                  const endSlot = Math.max(startSlot + 1, Math.min(SLOT_COUNT, Math.ceil((end - OPEN_MINUTES) / SLOT_MINUTES)));
                  const outside = start < OPEN_MINUTES || end > CLOSE_MINUTES || end <= start;
                  const gridStart = startSlot + 1;
                  const span = endSlot - startSlot;
                  const clock = new Date(row.startAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
                  return <article key={row._id} className={`timeline-appointment${outside ? ' outside-hours' : ''}`} style={{ gridColumn: `${gridStart} / span ${span}` }} title={`${clock} · ${lookup('customers', row.customerId)} · ${lookup('services', row.serviceId)}`}>
                    <div className="timeline-appointment-content">
                      <button className="text-button" onClick={() => onCustomer(row.customerId)}>{clock} · {lookup('customers', row.customerId)}</button>
                      <span>{lookup('services', row.serviceId)} · {statuses[row.status]}</span>
                      {row.status === 'CONFIRMED' && <button className="timeline-complete" disabled={busy} onClick={() => onComplete(row)}>Hoàn thành</button>}
                    </div>
                  </article>;
                })}
              </div>
            </div>;
          })}
        </div>
      </div>
      {visits.some(row => localMinutes(row.startAt) < OPEN_MINUTES || localMinutes(row.endAt) > CLOSE_MINUTES) && <p className="timeline-note">Lịch viền cam nằm ngoài khung giờ hoạt động 09:00–22:00.</p>}
      </section>;
    })}
    {!rows.length && <p role="status">{pagination?.loading ? 'Đang tải lịch.' : 'Không có lịch phù hợp.'}</p>}
    {pagination && pagination.total > pagination.pageSize && <div className="customer-picker-pages"><button disabled={pagination.loading || pagination.page <= 1} onClick={() => pagination.onChange(pagination.page - 1, pagination.pageSize)}>Trước</button><span>Trang {pagination.page}/{Math.ceil(pagination.total / pagination.pageSize)}</span><button disabled={pagination.loading || pagination.page * pagination.pageSize >= pagination.total} onClick={() => pagination.onChange(pagination.page + 1, pagination.pageSize)}>Sau</button></div>}
  </div>;
}
