// Synthetic browser rendering only; never connects to a database.
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {invoiceExportDocument} from '../src/lib/export-read';

const doc=invoiceExportDocument({invoice:{code:'HD000001',kind:'PACKAGE',createdAt:'2026-11-11T05:00:00Z',description:'Hóa đơn kiểm thử',creatorName:'Thu ngân QA',saleParticipants:[{staffName:'Tư vấn QA'}],subtotal:2300000,discount:{type:'PERCENT',value:10,amount:230000},total:2070000,paid:2000000,
  serviceItems:[{lineId:'1',name:'Massage cổ vai gáy',total:350000,performerName:'Thư'},{lineId:'2',name:'Chăm sóc da phục hồi chuyên sâu',total:450000,performerName:'Quỳnh'},{lineId:'3',name:'Dịch vụ đặt trước',total:100000}],
  packageItems:[{name:'Gói chăm sóc da 10 buổi',total:1200000}],productItems:[{name:'Sản phẩm dưỡng da',quantity:1,unit:'chai',unitPrice:200000,total:200000}]},customer:{name:'Khách hàng kiểm thử',phone:'0900000000'},gifts:[],adjustments:[]} as any);
const bundle=await build({stdin:{contents:"import {renderPdf} from './src/lib/render-pdf'; window.renderInvoicePdf=renderPdf;",resolveDir:process.cwd()},bundle:true,write:false,format:'iife'});
const browser=await chromium.launch({executablePath:process.env.SPACARE_TEST_CHROME || undefined,headless:true});
try{
  const page=await browser.newPage();await page.setContent('<!doctype html><html lang="vi"><meta charset="utf-8"><body></body></html>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const rendered=await page.evaluate(async(doc)=>{
    const previews:string[]=[],texts:string[]=[];
    const original=HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL=function(...args){previews.push(original.call(this,'image/png'));return original.apply(this,args);};
    const fill=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){texts.push(text);return fill.call(this,text,x,y,...args);};
    const file=await (window as any).renderInvoicePdf(doc);
    const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
    return {previews,texts,pdf:btoa(binary)};
  },doc);
  assert.ok(rendered.texts.includes('Kỹ thuật viên: Thư'));assert.ok(rendered.texts.includes('Kỹ thuật viên: Quỳnh'));
  assert.ok(rendered.texts.includes('Kỹ thuật viên: Chưa có'));assert.ok(rendered.texts.includes('Cảm ơn và hẹn gặp lại Quý khách!'));
  assert.ok(!rendered.texts.some(text=>/Xuất lúc:|Bản PDF tra cứu|Số tiền phản ánh/.test(text)));
  await mkdir('outputs/invoice-discount-pdf',{recursive:true});
  await writeFile('outputs/invoice-discount-pdf/invoice.pdf',Buffer.from(rendered.pdf,'base64'));
  for(const [index,url]of rendered.previews.entries())await writeFile(`outputs/invoice-discount-pdf/page-${index+1}.png`,Buffer.from(url.split(',')[1],'base64'));
  console.log(`PASS: PDF 80mm, ${rendered.previews.length} page(s); synthetic previews: outputs/invoice-discount-pdf`);
}finally{await browser.close();}
