// Minimal PDF image container. Text is rasterized by the browser so Vietnamese uses
// the device's installed fonts, without uploading or redistributing proprietary fonts.
export function imagePdf(pages: { jpeg: Uint8Array; width: number; height: number }[]): Uint8Array {
  if (!pages.length) throw new Error('PDF requires a page');
  const encode = (value: string) => new TextEncoder().encode(value);
  const chunks: Uint8Array[] = [];
  let position = 0;
  const offsets: number[] = [0];
  const push = (value: string | Uint8Array) => { const bytes = typeof value === 'string' ? encode(value) : value; chunks.push(bytes); position += bytes.length; };
  const object = (id: number, value: string) => { offsets[id] = position; push(`${id} 0 obj\n${value}\nendobj\n`); };
  push('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] >>`);
  pages.forEach((page, index) => {
    const id = 3 + index * 3;
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Image ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
    offsets[id + 1] = position;
    push(`${id + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
    push(page.jpeg); push('\nendstream\nendobj\n');
    const content = 'q\n595.28 0 0 841.89 0 0 cm\n/Image Do\nQ\n';
    object(id + 2, `<< /Length ${encode(content).length} >>\nstream\n${content}endstream`);
  });
  const xref = position;
  push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let id = 1; id < offsets.length; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const result = new Uint8Array(position);
  let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
