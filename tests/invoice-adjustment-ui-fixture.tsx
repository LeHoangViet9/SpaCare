import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import InvoiceListActions from '../src/components/invoice-list-actions';
import InvoiceAdjustmentDialog from '../src/components/invoice-adjustment';
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
const correction=renderDialog('CORRECT');assert.ok(correction.includes('Ngày hóa đơn'));assert.ok(correction.includes('type="date"'));assert.ok(correction.includes('Xem trước thay đổi'));
const handling=renderToStaticMarkup(createElement(InvoiceHandlingMenu,{invoice,treatment:null,reasons:{edit:'',date:'',cancel:'',replace:'Chưa đủ đối soát hoa hồng',void:''},onEdit(){},onVoid(){},onReplaced(){}}));
assert.ok(handling.includes('>Sửa hóa đơn</button>'));assert.ok(handling.includes('>Vô hiệu hóa hóa đơn</button>'));
assert.ok(!handling.includes('>Sửa ngày hóa đơn</button>'));assert.ok(!handling.includes('Hủy hóa đơn chưa thanh toán'));assert.ok(!handling.includes('Vô hiệu hóa hóa đơn nhập nhầm'));
