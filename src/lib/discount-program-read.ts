import type {Actor} from './auth';
import {DiscountProgram} from './models';
import {ensure,spaDay} from './rules';
import {programDay,selectDiscountProgram} from './discount-program-rules';
export async function readDiscountPrograms(user:Actor,params:URLSearchParams){
 const scope={spaId:user.spaId};
 if(params.get('manage')==='1'){
  ensure(user.role==='OWNER','Chỉ chủ spa được quản lý chương trình giảm giá.',403);
  const requested=Number(params.get('page')||1);ensure(Number.isSafeInteger(requested)&&requested>0,'Trang không hợp lệ.');
  const total=await DiscountProgram.countDocuments(scope),page=Math.min(requested,Math.max(1,Math.ceil(total/20)));
  const rows=await DiscountProgram.find(scope).sort({startsOn:-1,_id:-1}).skip((page-1)*20).limit(20).lean();
  return {rows,total,page,today:spaDay()};
 }
 ensure(user.role==='OWNER'||user.role==='STAFF','Không có quyền xem chương trình áp dụng.',403);
 const day=programDay.parse(params.get('day')||spaDay());
 const programs=await DiscountProgram.find({...scope,enabled:true,startsOn:{$lte:day},endsOn:{$gte:day}}).limit(2).lean();
 return {program:selectDiscountProgram(programs as any[],day),day};
}
