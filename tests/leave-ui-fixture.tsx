import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import AttendanceDialog from '../src/components/attendance-dialog';
import {FormModal} from '../src/components/workspace';
import {summarizeLeave} from '../src/lib/leave-rules';
const params=new URLSearchParams(location.search),role=params.get('role') || 'OWNER',scenario=params.get('case');
const staffName='Nguyễn Thị Minh Anh – nhân viên thử nghiệm';
const leaves=Array.from({length:12},(_,i)=>({_id:'leave-'+i,staffId:'staff',staffName,day:`2026-11-${String(i+1).padStart(2,'0')}`,startDay:`2026-11-${String(i+1).padStart(2,'0')}`,endDay:i===0?'2026-11-03':`2026-11-${String(i+1).padStart(2,'0')}`,period:i===0?'AM':'FULL',type:i%2?'UNPERMITTED':'PERMITTED',paid:i%3===1,status:['PENDING','APPROVED','REJECTED'][i%3],note:i===0?'Nghỉ việc gia đình. '+('ghichúdài'.repeat(24)):'Lý do nghỉ thử nghiệm'}));
let failedOnce=false;
window.fetch=async (input)=>{
 const url=new URL(String(input),location.origin);
 if(url.pathname!=='/api/payroll')throw Error('Fixture only supports local payroll reads');
 if(scenario==='retry'&&!failedOnce){failedOnce=true;return Response.json({error:'Không tải được ngày nghỉ thử nghiệm.'},{status:500});}
 const page=Number(url.searchParams.get('leavePage') || 1),rows=scenario==='empty'?[]:leaves;
 return Response.json({people:[{_id:'staff',name:staffName,role:'STAFF'}],leaves:rows.slice((page-1)*10,page*10),leaveTotal:rows.length,leavePage:page,leaveSummary:[{staffId:'staff',...summarizeLeave(rows,'2026-11')}]});
};
type FormSpec = React.ComponentProps<typeof FormModal>['spec'];
function Fixture(){
 const [open,setOpen]=useState(true),[action,setAction]=useState('');
 const [modal,setModal]=useState<FormSpec|null>(null);
 return <main><button onClick={()=>setOpen(true)}>Mở nghỉ phép</button><output data-testid="action" hidden>{action}</output>
  {open&&<AttendanceDialog person={{staffId:'staff',staffName}} month="2026-11" today="2026-11-04" user={{id:role==='OWNER'?'owner':'staff',role}} refreshKey={0} onClose={()=>setOpen(false)} onOpen={(title,action,fields,defaults,description)=>{
   const spec={title,action,fields,defaults,description};
   setAction(JSON.stringify(spec));setModal(spec);
  }}/>}
  {modal&&<FormModal spec={modal} catalogs={{today:'2026-11-04',people:[{_id:'staff',name:staffName,role:'STAFF'}]}} busy={false} error="" onClose={()=>setModal(null)} onSubmit={values=>{
   // Capture only: the fixture never writes to an API or database.
   setAction(JSON.stringify({action:modal.action,values}));setModal(null);
  }}/>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
