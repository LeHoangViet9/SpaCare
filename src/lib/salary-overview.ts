type Row = Record<string, any>;
export function salaryOverviewRows(people:Row[], payrolls:Row[], pending:Row[], work:Row[], leaves:Row[], month:string) {
 return people.map(person=> {
  const id=String(person._id), payroll=payrolls.find(p=>String(p.staffId)===id);
  const currentWorkdays=work.find(w=>String(w._id)===id)?.days ?? null;
  const currentLeaveStats=leaves.find(l=>String(l.staffId)===id) || null;
  if(payroll) return {...payroll,currentWorkdays,currentLeaveStats};
  const amount=(category:string)=>pending.find(c=>String(c._id.staffId)===id&&c._id.category===category)?.amount || 0;
  return {_id:'uncreated-'+id,staffId:person._id,staffName:person.name,month,status:'NOT_CREATED',baseSalary:person.baseSalary ?? null,
    serviceCommissionTotal:amount('SERVICE'),saleCommissionTotal:amount('PACKAGE_SALE'),currentWorkdays,currentLeaveStats,total:null};
 });
}
