import assert from 'node:assert/strict';
import {renderPdf} from '../src/lib/render-pdf';
import type {ExportDocument} from '../src/lib/export-document';

type Text = {text:string;x:number;y:number;size:number};
type Page = {width:number;height:number;text:Text[]};
let pages:Page[]=[];
function createCanvas() {
  const canvas={width:0,height:0,text:[] as Text[],getContext:()=>context,
    toDataURL:()=>{
      pages.push({width:canvas.width,height:canvas.height,text:structuredClone(canvas.text)});
      return `data:image/jpeg;base64,${Buffer.from([255,216,255,217]).toString('base64')}`;
    }};
  const context={font:'20px Arial',measureText:(text:string)=>({width:text.length*8}),
    fillText(text:string,x:number,y:number){canvas.text.push({text,x,y,size:Number(this.font.match(/(\d+)px/)![1])});},
    drawImage(source:typeof canvas){canvas.text=structuredClone(source.text);},
    fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},strokeRect(){}};
  return canvas;
}
(globalThis as any).document={fonts:{ready:Promise.resolve()},createElement:createCanvas};
const receipt={name:'Thanh Thư Spa',address:'Địa chỉ kiểm thử',phone:'0900000000',cashier:'Thu ngân thử'};
for(const count of [1,80]){
  pages=[];
  const doc:ExportDocument={filename:'receipt.pdf',title:'HÓA ĐƠN BÁN HÀNG',subtitle:'',receipt,notes:[],tables:[
    {columns:['Thông tin','Chi tiết'],widths:[0.28,0.72],rows:[['Mã hóa đơn','HD000001']]},
    {heading:'Dịch vụ / gói / sản phẩm',columns:['Nội dung','Thành tiền'],widths:[0.72,0.28],
      rows:Array.from({length:count},(_,i)=>[`DV_${String(i+1).padStart(3,'0')} Chăm sóc da chuyên sâu và phục hồi cấp ẩm`, '100.000 đ'])},
    {heading:'Thanh toán',columns:['Khoản mục','Số tiền'],widths:[0.65,0.35],rows:[['Tổng thanh toán sau giảm','100.000 đ'],['Còn nợ','0 đ']]},
  ]};
  const file=await renderPdf(doc);
  const pdf=Buffer.from(await file.arrayBuffer()).toString('latin1');
  if(count===1)assert.equal(pages.length,1);
  else assert.ok(pages.length>1);
  assert.equal((pdf.match(/\/MediaBox \[0 0 226\.77 /g)||[]).length,pages.length);
  const text=pages.flatMap(page=>page.text.map(row=>row.text));
  assert.ok(!text.some(value=>/\bTrang\s+\d+/.test(value)),'receipt footer has no visible page number');
  for(const page of pages){
    assert.equal(page.width,680);
    assert.ok(page.height<=1754);
    assert.equal(page.text.at(-1)!.text,receipt.name,'spa name remains on every footer');
    for(const row of page.text){
      assert.ok(row.x>=0&&row.x+row.text.length*8<=page.width,'text stays within the receipt width');
      assert.ok(row.y>=0&&row.y+row.size<=page.height,'text is not cropped vertically');
    }
  }
  for(let i=1;i<=count;i++){
    const marker=`DV_${String(i).padStart(3,'0')}`;
    assert.equal(text.filter(value=>value.includes(marker)).length,1,marker+' appears exactly once');
  }
  for(const label of ['Chữ ký khách hàng','Người lập hóa đơn','Thu ngân thử','Cảm ơn và hẹn gặp lại Quý khách!','Còn nợ'])
    assert.equal(text.filter(value=>value===label).length,1,label);
}
// A4 report pagination retains its existing footer.
pages=[];
await renderPdf({filename:'report.pdf',title:'Báo cáo',subtitle:'',notes:[],tables:[]});
assert.equal(pages[0].text.at(-1)!.text,'SpaCare | Trang 1');
