import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import InvoiceListActions from '../src/components/invoice-list-actions';
import InvoiceAdjustmentDialog, {InvoiceAdjustmentCashReview,InvoiceReceiptFields,InvoiceReceiptCorrectionHistory,invoiceAdjustmentErrorText} from '../src/components/invoice-adjustment';
import InvoiceHandlingMenu from '../src/components/invoice-handling-menu';
const invoice={_id:'a'.repeat(24),description:'Hóa đơn đã trả đủ',total:1000000,paid:1000000,status:'PAID',updatedAt:'2026-11-06T00:00:00Z',createdAt:'2026-11-05T05:00:00Z',customerName:'Khách thử'};
const calls:string[]=[];
const props={invoice,owner:true,busy:false,onEdit:()=>calls.push('correct'),onDelete:()=>calls.push('void'),onPayment:()=>calls.push('pay')};
const html=renderToStaticMarkup(createElement(InvoiceListActions,props));
assert.ok(!html.includes('row-action-menu'));assert.ok(!html.includes('<details'));
assert.ok(html.includes('aria-label="Sửa hóa đơn"'));assert.ok(html.includes('title="Vô hiệu hóa hóa đơn"'));
const tree=InvoiceListActions(props);
const buttons=(node:any):any[]=>Array.isArray(node)?node.flatMap(buttons):node?.type==='button'?[node]:node?.props?.children?buttons(node.props.children):[];
const actions=buttons(tree);assert.equal(actions.length,2);actions[0].props.onClick();actions[1].props.onClick();assert.deepEqual(calls,['correct','void']);
for(const owner of [false,true]){
  const debt=renderToStaticMarkup(createElement(InvoiceListActions,{...props,owner,invoice:{...invoice,paid:200000}}));
  assert.ok(debt.includes('Thanh toán'));
  assert.equal(debt.includes('aria-label="Sửa hóa đơn"'),owner);
  assert.equal(debt.includes('aria-label="Vô hiệu hóa hóa đơn"'),owner);
}
const cancelled=renderToStaticMarkup(createElement(InvoiceListActions,{...props,invoice:{...invoice,status:'CANCELLED',paid:0}}));assert.ok(!cancelled.includes('>Thanh toán<'));assert.equal((cancelled.match(/disabled=""/g)||[]).length,2);
const renderDialog=(mode:'CORRECT'|'VOID',context={})=>renderToStaticMarkup(createElement(InvoiceAdjustmentDialog,{invoice:{...invoice,adjustmentContext:context},mode,onChanged(){},onClose(){}}));
const serviceOnly=renderDialog('VOID');
assert.ok(serviceOnly.includes('Khách thử'));assert.ok(serviceOnly.includes('Còn nợ'));
assert.ok(serviceOnly.includes('>Quay lại</button>'));assert.ok(serviceOnly.includes('>Vô hiệu hóa hóa đơn</button>'));
for(const text of ['Hàng đã bán','Gói đã bán','Quà tặng','Nội dung hóa đơn','revisedTotal','Đã đối soát'])assert.ok(!serviceOnly.includes(text),text+' must be absent from a simple service void');
for(const flag of ['stock','packages','gifts']){
 const form=renderDialog('VOID',{[flag]:true});
 const labels={stock:'Hàng đã bán',packages:'Gói đã bán',gifts:'Quà tặng'};
 for(const [key,label]of Object.entries(labels))assert.equal(form.includes(label),key===flag);
}
const missing=renderDialog('CORRECT');assert.ok(missing.includes('Đang tải nội dung và kỹ thuật viên'));assert.ok(!missing.includes('Tổng tiền sau sửa'));assert.ok(!missing.includes('Xem trước thay đổi'));
const editContext={client:{customerId:'b'.repeat(24),description:invoice.description,dueDate:null,promotion:'',consultantId:null,participantIds:[],serviceItems:[],productItems:[],packageItems:[]},
 source:{serviceItems:[],productItems:[],packageItems:[],treatmentSessions:[]},catalogs:{staff:[],services:[],products:[],packageTemplates:[]},locks:{services:[],packages:[]},references:{gifts:[],giftCards:[]}};
const correction=renderToStaticMarkup(createElement(InvoiceAdjustmentDialog,{invoice:{...invoice,editContext},mode:'CORRECT',onChanged(){},onClose(){}}));
assert.ok(correction.includes('Ngày hóa đơn'));assert.ok(correction.includes('type="date"'));assert.ok(correction.includes('Tổng tiền sau sửa'));assert.ok(correction.includes('Hóa đơn đã trả đủ'));assert.ok(correction.includes('Xem trước thay đổi'));assert.ok(correction.includes('invoice-adjustment-scroll'));assert.ok(correction.includes('invoice-adjustment-actions'));
const handling=renderToStaticMarkup(createElement(InvoiceHandlingMenu,{invoice,treatment:null,reasons:{edit:'',date:'',cancel:'',replace:'Chưa đủ đối soát hoa hồng',void:''},onEdit(){},onVoid(){},onReplaced(){}}));
for(const removed of ['Chỉ sửa tổng hóa đơn không tạo khoản thu','Ngày thu cũ và mới phải có sổ','Không dùng Thanh toán hôm nay','vì cần đối soát hoa hồng riêng','tổng hóa đơn − số tiền đã thanh toán'])assert.ok(!correction.includes(removed));
assert.equal(invoiceAdjustmentErrorText('Sổ ngày 2026-11-07 chưa mở hoặc đã chốt. Chưa có quy trình điều chỉnh khoản thu của ngày đã chốt an toàn; không sửa snapshot.'),'Không thể chỉnh khoản thu: sổ ngày 07/11/2026 chưa mở hoặc đã chốt.');
assert.equal(invoiceAdjustmentErrorText('Hóa đơn đã thay đổi.'),'Hóa đơn đã thay đổi.');
const source={_id:'payment',receiptId:'receipt',amount:30000,day:'2026-11-07',method:'CASH'};
const edits:any[]=[];
const fields=InvoiceReceiptFields({original:[source],edited:[source],paid:30000,oldPaid:30000,total:300000,onChange:(id,change)=>edits.push({id,...change})});
function inputs(node:any):any[]{return Array.isArray(node)?node.flatMap(inputs):node?.type==='input'?[node]:node?.props?.children?inputs(node.props.children):[];}
const singleInputs=inputs(fields);
const paidInput=singleInputs.find(input=>input.props.name==='revisedPaid');assert.equal(paidInput.props.readOnly,false);
paidInput.props.onChange({target:{value:'300000'}});singleInputs.find(input=>input.props.type==='date').props.onChange({target:{value:'2026-11-06'}});
assert.deepEqual([...edits],[{id:'payment',amount:300000},{id:'payment',day:'2026-11-06'}]);
const pair=[source,{...source,_id:'bank',method:'BANK_TRANSFER'}];
const many=InvoiceReceiptFields({original:pair,edited:pair,paid:60000,oldPaid:60000,total:300000,onChange:(id,change)=>edits.push({id,...change})});
assert.equal(inputs(many).filter(input=>input.props.type==='date').length,2);assert.equal(inputs(many).find(input=>input.props.name==='revisedPaid').props.readOnly,true);
inputs(many).filter(input=>input.props.type==='number'&&input.props.name!=='revisedPaid')[1].props.onChange({target:{value:'270000'}});assert.deepEqual(edits.at(-1),{id:'bank',amount:270000});
const noSources=InvoiceReceiptFields({original:[],edited:[],paid:0,oldPaid:0,total:300000,onChange(){assert.fail('No fabricated payment');}});assert.equal(inputs(noSources)[0].props.readOnly,true);
const history=renderToStaticMarkup(createElement(InvoiceReceiptCorrectionHistory,{changes:[{paymentId:'payment',receiptId:'receipt',before:{amount:30000,day:'2026-11-07'},after:{amount:300000,day:'2026-11-06'}}]}));
assert.ok(history.includes('30.000'));assert.ok(history.includes('300.000'));assert.ok(history.includes('2026-11-07'));assert.ok(history.includes('2026-11-06'));assert.ok(history.includes('#receipt'));
const cashReview=(paid:number,receipts:any[])=>renderToStaticMarkup(createElement(InvoiceAdjustmentCashReview,{preview:{after:{total:300000,paid},reconciliation:{receipts}}}));
const recorded=cashReview(300000,[{_id:'receipt',day:'2026-11-07',amount:300000,method:'CASH'}]);
assert.ok(recorded.includes('Khoản thu giữ nguyên'));assert.ok(!recorded.includes('snapshot'));assert.ok(!recorded.includes('Còn nợ'));
const owing=cashReview(30000,[{_id:'receipt',day:'2026-11-07',amount:30000,method:'CASH'}]);assert.ok(owing.includes('270.000'));
assert.ok(cashReview(0,[]).includes('Còn nợ'));
const tooMuch=renderToStaticMarkup(createElement(InvoiceReceiptFields,{original:[source],edited:[{...source,amount:400000}],paid:400000,oldPaid:30000,total:300000,onChange(){}}));
assert.ok(tooMuch.includes('aria-describedby="invoice-paid-error"'));assert.ok(tooMuch.includes('Số đã thanh toán vượt tổng hóa đơn.'));
const invalid=renderToStaticMarkup(createElement(InvoiceReceiptFields,{original:pair,edited:[source,{...source,_id:'bank',amount:-1}],paid:29999,oldPaid:60000,total:300000,onChange(){}}));assert.ok(invalid.includes('receipt-amount-error-1'));assert.ok(invalid.includes('Số tiền không hợp lệ.'));
assert.ok(handling.includes('>Sửa hóa đơn</button>'));assert.ok(handling.includes('>Vô hiệu hóa hóa đơn</button>'));
assert.ok(!handling.includes('>Sửa ngày hóa đơn</button>'));assert.ok(!handling.includes('Hủy hóa đơn chưa thanh toán'));assert.ok(!handling.includes('Vô hiệu hóa hóa đơn nhập nhầm'));
