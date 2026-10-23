import type { ExportDocument, ExportTable } from './export-document';
import { imagePdf } from './pdf-bytes';
export async function renderPdf(doc: ExportDocument): Promise<File> {
  await document.fonts.ready;
  const width = 1240, height = 1754, margin = 68, bottom = height - 90, line = 29;
  const pages: { jpeg: Uint8Array; width: number; height: number }[] = [];
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let y = 0;
  const font = (size = 21, bold = false) => { ctx.font = `${bold ? '700 ' : ''}${size}px Arial, sans-serif`; ctx.fillStyle = '#253d37'; ctx.textBaseline = 'top'; };
  function wrap(text: string, max: number) {
    const rows: string[] = [];
    for (const paragraph of String(text).normalize('NFC').split(/\r?\n/)) {
      let current = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = current ? current + ' ' + word : word;
        if (current && ctx.measureText(candidate).width > max) { rows.push(current); current = ''; }
        else if (current) { current = candidate; continue; }
        for (const character of Array.from(word)) {
          if (current && ctx.measureText(current + character).width > max) { rows.push(current); current = ''; }
          current += character;
        }
      }
      rows.push(current);
    }
    return rows;
  }
  function finish() {
    if (!canvas) return;
    font(17); ctx.fillStyle = '#52666b';
    ctx.fillText(`SpaCare | Trang ${pages.length + 1}`, margin, height - 55);
    const raw = atob(canvas.toDataURL('image/jpeg', 0.94).split(',')[1]);
    pages.push({ jpeg: Uint8Array.from(raw, character => character.charCodeAt(0)), width, height });
    canvas.width = 0; canvas.height = 0;
  }
  async function nextPage() {
    finish();
    await new Promise(resolve => setTimeout(resolve, 0));
    canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Trình duyệt không hỗ trợ tạo PDF.');
    ctx = context; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
    font(32, true); ctx.fillText(doc.title, margin, 54);
    font(20); y = 103;
    for (const part of wrap(doc.subtitle, width - margin * 2)) { ctx.fillText(part, margin, y); y += line; }
    ctx.strokeStyle = '#c9d5d8'; ctx.beginPath(); ctx.moveTo(margin, y + 8); ctx.lineTo(width - margin, y + 8); ctx.stroke(); y += 34;
  }
  await nextPage();
  async function paragraph(text: string, bold = false) {
    font(21, bold);
    for (const part of wrap(text, width - margin * 2)) {
      if (y + line > bottom) { await nextPage(); font(21, bold); }
      ctx.fillText(part, margin, y); y += line;
    }
    y += 12;
  }
  async function table(table: ExportTable) {
    if (table.heading) await paragraph(table.heading, true);
    const widths = table.widths.map(ratio => ratio * (width - margin * 2));
    async function row(values: string[], header = false) {
      font(20, header);
      const cells = values.map((text, index) => wrap(text, widths[index] - 24));
      const count = Math.max(1, ...cells.map(cell => cell.length));
      // Keep ordinary rows together; exceptionally long cells can span pages.
      if (!header && y + count * line + 20 > bottom && count * line + 20 < 1100) {
        await nextPage(); await row(table.columns, true); font(20, header);
      }
      let offset = 0;
      while (offset < count) {
        let available = Math.floor((bottom - y - 20) / line);
        if (available < 1) {
          await nextPage();
          if (!header) await row(table.columns, true);
          font(20, header); available = Math.floor((bottom - y - 20) / line);
        }
        const take = Math.min(count - offset, available), rowHeight = take * line + 20;
        ctx.fillStyle = header ? '#e8eee5' : '#fff'; ctx.fillRect(margin, y, width - margin * 2, rowHeight);
        ctx.strokeStyle = '#dce3da'; ctx.strokeRect(margin, y, width - margin * 2, rowHeight);
        font(20, header);
        let x = margin;
        cells.forEach((parts, column) => {
          for (let index = 0; index < take; index++) ctx.fillText(parts[offset + index] || '', x + 12, y + 10 + index * line);
          x += widths[column];
        });
        y += rowHeight; offset += take;
      }
    }
    if (y + 90 > bottom) await nextPage();
    await row(table.columns, true);
    for (const values of table.rows) await row(values);
    y += 28;
  }
  for (const block of doc.tables) await table(block);
  for (const note of doc.notes) await paragraph(note);
  await paragraph(`Xuất lúc: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
  finish();
  return new File([imagePdf(pages) as Uint8Array<ArrayBuffer>], doc.filename, { type: 'application/pdf' });
}
