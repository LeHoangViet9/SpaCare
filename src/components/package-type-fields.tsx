 'use client';
import { useState } from 'react';
export default function PackageTypeFields({ initial = {} }: { initial?: Record<string, any> }) {
  const [kind, setKind] = useState(initial.packageType || 'SESSIONS');
  return <><label>Loại liệu trình<select name="packageType" required value={kind} onChange={e => setKind(e.target.value)}><option value="SESSIONS">Theo số buổi</option><option value="TIME">Theo thời gian · không giới hạn số lần</option></select></label>
    {kind === 'SESSIONS' ? <label>Số buổi<input name="totalSessions" type="number" min={1} max={1000} step={1} required defaultValue={initial.totalSessions} /></label>
      : <label>Thời hạn (tháng)<input name="durationMonths" type="number" min={1} max={120} step={1} required defaultValue={initial.durationMonths} /><small>Ví dụ: 24 tháng = 2 năm, 36 tháng = 3 năm. Không giới hạn số lần làm.</small></label>}</>;
}
