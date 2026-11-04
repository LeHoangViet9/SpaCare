type Row = Record<string, any>;
export function salaryOverviewRows(people:Row[], payrolls:Row[], pending:Row[], work:Row[], leaves:Row[], month:string) {
 return people.map(person=> {
  const id=String(person._id), payroll=payrolls.find(p=>String(p.staffId)===id);
  const currentWorkdays=work.find(w=>String(w._id)===id)?.days ?? null;
  const currentLeaveStats=leaves.find(l=>String(l.staffId)===id) || null;
  const latest = pending.filter(c=>String(c._id.staffId)===id);
  const latestServiceCommission = latest.filter(c=>c._id.category==='SERVICE').reduce((n,c)=>n+c.amount,0);
  const latestSaleCommission = latest.filter(c=>c._id.category==='PACKAGE_SALE').reduce((n,c)=>n+c.amount,0);
  const sourceIds = latest.flatMap(c=>c.ids || []).map(String).sort().join(',');
  const savedIds = payroll ? ['commissionIds','invoiceLineCommissionIds','saleCommissionIds','sharedSaleCommissionIds'].flatMap(k=>payroll[k] || []).map(String).sort().join(',') : '';
  if(payroll) return {...payroll,currentWorkdays,currentLeaveStats,latestServiceCommission,latestSaleCommission,
    latestCommissionTotal:latestServiceCommission+latestSaleCommission,
    needsRecalculation:payroll.status === 'DRAFT' && (!!payroll.needsRecalculation || sourceIds!==savedIds || latestServiceCommission!==(payroll.serviceCommissionTotal ?? payroll.commissionTotal ?? 0) || latestSaleCommission!==(payroll.saleCommissionTotal || 0))};
  const amount=(category:string)=>pending.find(c=>String(c._id.staffId)===id&&c._id.category===category)?.amount || 0;
  return {_id:'uncreated-'+id,staffId:person._id,staffName:person.name,month,status:'NOT_CREATED',baseSalary:person.baseSalary ?? null,
    serviceCommissionTotal:amount('SERVICE'),saleCommissionTotal:amount('PACKAGE_SALE'),currentWorkdays,currentLeaveStats,total:null};
 });
}
