'use client';
import { useEffect, useRef, useState } from 'react';
import { renderPdf } from '@/lib/render-pdf';
export default function PdfExport({ endpoint }: { endpoint: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileUrl = useRef('');
  const pending = useRef<AbortController | null>(null);
  const currentEndpoint = useRef(endpoint); currentEndpoint.current = endpoint;
  useEffect(() => { setFile(null); setError(''); setBusy(false); return () => { pending.current?.abort(); if (fileUrl.current) URL.revokeObjectURL(fileUrl.current); fileUrl.current = ''; }; }, [endpoint]);
  async function prepare() {
    setBusy(true); setError('');
    const target = endpoint;
    const controller = new AbortController(); pending.current?.abort(); pending.current = controller;
    try {
      const response = await fetch(target, { cache: 'no-store', signal: controller.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Không xuất được PDF.');
      const result = await renderPdf(data);
      if (controller.signal.aborted || target !== currentEndpoint.current) return;
      setFile(result);
      if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
      fileUrl.current = URL.createObjectURL(result);
      const link = document.createElement('a'); link.href = fileUrl.current; link.download = result.name;
      document.body.appendChild(link); link.click(); link.remove();
    } catch (cause) { if (!controller.signal.aborted && target === currentEndpoint.current) setError((cause as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function share() {
    if (!file) return;
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: file.name });
      else window.open(fileUrl.current, '_blank', 'noopener,noreferrer');
    } catch (cause) { if ((cause as Error).name !== 'AbortError') setError('Chưa chia sẻ được. Bạn có thể chia sẻ file đã tải trong Tệp/Tải xuống.'); }
  }
  return <div className="pdf-export">
    <div className="actions"><button type="button" disabled={busy} onClick={prepare}>{busy ? 'Đang tạo PDF…' : 'Tải PDF'}</button>
      {file && <><button type="button" onClick={() => window.open(fileUrl.current, '_blank', 'noopener,noreferrer')}>Xem / In PDF</button><button type="button" onClick={share}>Chia sẻ PDF</button></>}
    </div>
    {file && <small>Đã tạo PDF. Trên điện thoại, mở file để in hoặc lưu vào Tệp.</small>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
