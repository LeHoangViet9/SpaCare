import {z} from 'zod';
import {dayBounds,ensure,spaDay} from './rules.ts';
const id=z.string().regex(/^[a-f\d]{24}$/i);
export const programDay=z.string().refine(value=>{try{dayBounds(value);return true;}catch{return false;}},'Ngày chương trình không hợp lệ.');
export const discountProgramInput=z.object({id:id.optional(),expectedUpdatedAt:z.string().datetime().optional(),name:z.string().trim().min(1).max(200),startsOn:programDay,endsOn:programDay,percent:z.number().int().min(0).max(100),enabled:z.boolean(),confirmedRunning:z.boolean().optional()}).strict()
 .refine(d=>d.endsOn>=d.startsOn,'Ngày kết thúc không được trước ngày bắt đầu.')
 .refine(d=>!d.id||!!d.expectedUpdatedAt,'Cần phiên bản chương trình đang sửa.');
export const discountProgramStatusInput=z.object({id,expectedUpdatedAt:z.string().datetime(),enabled:z.boolean(),confirmedRunning:z.boolean().optional()}).strict();
export type DiscountProgramRecord={_id:unknown;code:string;name:string;startsOn:string;endsOn:string;percent:number;enabled:boolean;updatedAt:Date|string};
export function programActive(program:Pick<DiscountProgramRecord,'enabled'|'startsOn'|'endsOn'>,day=spaDay()) {return program.enabled&&program.startsOn<=day&&program.endsOn>=day;}
export function programPhase(program:Pick<DiscountProgramRecord,'startsOn'|'endsOn'>,day=spaDay()) {return day<program.startsOn?'Sắp chạy':day>program.endsOn?'Đã kết thúc':'Đang chạy';}
export function selectDiscountProgram<T extends DiscountProgramRecord>(programs:T[],day:string):T|null{
 programDay.parse(day);const matches=programs.filter(p=>programActive(p,day));
 ensure(matches.length<=1,'Có nhiều chương trình giảm giá đang bật cùng ngày. Chủ spa cần xử lý chồng lấn trước khi tạo hóa đơn.',409);
 return matches[0]||null;
}
export function discountProgramSnapshot(program:DiscountProgramRecord){return {programId:String(program._id),programCode:program.code,programName:program.name,type:'PERCENT' as const,value:program.percent};}
