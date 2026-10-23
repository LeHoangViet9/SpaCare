// Local, synthetic-only browser fixture. No database, cookies or production data.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
const output = mkdtempSync(join(tmpdir(), 'spacare-pdf-'));
const compile = path => ts.transpileModule(readFileSync(path, 'utf8').replace(/^import .*;$/mg, '').replace(/^export /mg, ''),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const source = compile('src/lib/pdf-bytes.ts') + '\n' + compile('src/lib/render-pdf.ts');
const docs = [
  { receipt: { name: 'Thanh Thư Spa', address: 'CL12 Đầm Lau, xã Phụng Công, tỉnh Hưng Yên', phone: '0329 357 116', cashier: 'Thanh Thư' }, filename: 'invoice.pdf', title: 'HÓA ĐƠN DỊCH VỤ', subtitle: 'SpaCare | Hotline 0329 357 116',
    notes: ['Bản PDF tra cứu/giao khách, không phải hóa đơn điện tử có mã cơ quan thuế.'],
    tables: [{ columns: ['Thông tin', 'Chi tiết'], widths: [.28,.72], rows: [['Khách hàng','Nguyễn Thị Huyền Trang'],['Số điện thoại','0329357116'],['Mã hóa đơn','0123456789abcdef01234567']] },
      { heading: 'Thanh toán', columns: ['Khoản mục','Số tiền'], widths: [.65,.35], rows: [['Gói chăm sóc da chuyên sâu và phục hồi cấp ẩm', '2.000.000 đ'],['Quà tặng: Chăm sóc da','0 đ'],['Đã thanh toán','1.500.000 đ'],['Còn phải thanh toán','500.000 đ']] }] },
  { filename: 'commission.pdf', title: 'BẢNG KÊ HOA HỒNG', subtitle: 'Tháng 10/2026 | Nguyễn Thị Huyền Trang', notes: ['Đủ 120 khoản, gồm cả khoản điều chỉnh âm. Không xác nhận đã chi lương.'], tables: [
    { heading: 'Chi tiết phát sinh', columns: ['Ngày','Nhân viên','Nội dung','Hoa hồng'], widths: [.2,.22,.36,.22],
      rows: Array.from({length:120}, (_, i) => ['23/10/2026, 14:30:00','Nguyễn Thị Huyền Trang',`Khoản ${i+1}: ${i%2 ? 'Bán gói 5%: Chăm sóc da chuyên sâu, phục hồi và cấp ẩm | HĐ #012345' : 'Dịch vụ: Gội đầu dưỡng sinh'}`,i===119 ? '-100.000 đ' : '20.000 đ']) }] },
];
const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDF fixture</title><body><p id="status">Đang kiểm tra PDF…</p><script>${source}
window.runFixture = async () => { for (const doc of ${JSON.stringify(docs)}) { const file = await renderPdf(doc); await fetch('/result/'+doc.filename, {method:'POST',body:file}); } document.getElementById('status').textContent='Đã tạo 2 PDF kiểm thử'; return true; };</script></body></html>`;
const server = createServer(async (request,response) => {
  if (request.method === 'POST' && ['/result/invoice.pdf','/result/commission.pdf'].includes(request.url)) {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    writeFileSync(join(output, request.url.split('/').at(-1)), Buffer.concat(chunks)); response.end('ok'); return;
  }
  response.setHeader('Content-Type','text/html; charset=utf-8'); response.end(html);
});
if (process.argv.includes('--inject')) {
  mkdirSync('.next/pdf-qa', { recursive: true });
  writeFileSync('.next/pdf-qa/browser.js', (`async () => { const previews=[]; const original=HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL=function(...args){const small=document.createElement('canvas');small.width=620;small.height=877;small.getContext('2d').drawImage(this,0,0,620,877);previews.push(original.call(small,'image/jpeg',0.8));return original.apply(this,args);}; ${source}\n const files=[]; for(const doc of ${JSON.stringify(docs)}) { const file=await renderPdf(doc); const bytes=new Uint8Array(await file.arrayBuffer()); let binary=''; for(const byte of bytes) binary+=String.fromCharCode(byte); files.push({name:doc.filename,base64:btoa(binary)}); } HTMLCanvasElement.prototype.toDataURL=original; window.pdfPreviews=previews; return files.map(f=>({name:f.name,bytes:f.base64.length})); }`).replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')));
  console.log('Browser fixture prepared in .next/pdf-qa');
} else server.listen(3889,'127.0.0.1',()=>console.log(JSON.stringify({url:'http://127.0.0.1:3889',output})));
