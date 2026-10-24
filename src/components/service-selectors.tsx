'use client';
import {useId,useState} from 'react';
import {serviceGroupNames,selectableServices,serviceGroupName,serviceGroupKey} from '@/lib/service-groups';
type Row=Record<string,any>;
export function ServiceGroupField({groups,services,initial='',disabled=false}:{groups:Row[];services:Row[];initial?:string;disabled?:boolean}) {
 const id=useId(),[value,setValue]=useState(initial),[creating,setCreating]=useState(false);
 const names=serviceGroupNames(groups,services,initial);
 return <div className="service-selector-field"><label htmlFor={id}>Nhóm dịch vụ</label>
 <select id={id} name={creating?undefined:'category'} value={creating?'__new__':value} disabled={disabled} onChange={e=>{if(e.target.value==='__new__'){setCreating(true);setValue('');}else{setCreating(false);setValue(e.target.value);}}}>
 <option value="">Chưa phân nhóm</option>{names.map(name=><option key={name} value={name}>{name}</option>)}<option value="__new__">+ Nhập nhóm mới…</option></select>
 {creating&&<><label htmlFor={id+'-new'}>Tên nhóm mới <span className="required-mark">*</span></label><input id={id+'-new'} name="category" required maxLength={100} value={value} onChange={e=>setValue(e.target.value)} disabled={disabled} onBlur={()=>{const existing=names.find(name=>serviceGroupKey(name)===serviceGroupKey(value));if(existing){setValue(existing);setCreating(false);}else setValue(serviceGroupName(value));}} placeholder="Ví dụ: Chăm sóc da"/><small>Nhóm mới được lưu khi lưu dịch vụ.</small></>}
 </div>;
}
export function ServicePickerField({services,initial='',disabled=false}:{services:Row[];initial?:string;disabled?:boolean}) {
 const id=useId(),[value,setValue]=useState(initial);
 const rows=selectableServices(services,initial),groups=serviceGroupNames([],rows);
 const names=[...groups,...(rows.some(s=>!s.category)?['']:[])];
 return <div className="service-selector-field"><label htmlFor={id}>Dịch vụ có sẵn <span className="required-mark">*</span></label>
 <select id={id} name="serviceId" required value={value} onChange={e=>setValue(e.target.value)} disabled={disabled||!rows.length}><option value="">{rows.length?'Chọn dịch vụ…':'Chưa có dịch vụ đang hoạt động'}</option>
 {names.map(name=><optgroup key={name} label={name||'Chưa phân nhóm'}>{rows.filter(s=>(s.category||'')===name).map(s=><option key={s._id} value={s._id}>{s.name}{s.active===false?' · Đã ngừng':''}</option>)}</optgroup>)}</select>
 {!rows.length&&<p role="status">Chưa có dịch vụ trong môi trường này. Vào Danh mục dịch vụ để thêm trước khi tạo gói mẫu.</p>}
 </div>;
}
