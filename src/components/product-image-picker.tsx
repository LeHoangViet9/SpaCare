'use client';
import { useRef, useState } from 'react';

export default function ProductImagePicker({ name, initialValue, disabled, onBusyChange }: {
  name: string; initialValue?: string; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [url, setUrl] = useState(initialValue || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file || busy) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Chọn ảnh JPG, PNG hoặc WebP. Ảnh HEIC cần đổi sang JPG.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Ảnh tối đa 5 MB. Vui lòng chọn ảnh có dung lượng nhỏ hơn.'); return; }
    setBusy(true); onBusyChange(true);
    try {
      const data = new FormData(); data.set('image', file);
      const response = await fetch('/api/product-images', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không tải được ảnh.');
      setUrl(result.imageUrl);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được ảnh.'); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <div className="product-image-picker">
    <strong>Ảnh sản phẩm</strong>
    <input type="hidden" name={name} value={url} />
    {url ? <img src={url} alt="Ảnh sản phẩm đã chọn" className="product-image-preview" /> : <div className="product-image-empty">Chưa có ảnh sản phẩm</div>}
    <div className="product-image-actions">
      <button type="button" disabled={disabled || busy} onClick={() => library.current?.click()}>Chọn ảnh</button>
      <button type="button" disabled={disabled || busy} onClick={() => camera.current?.click()}>Chụp ảnh</button>
      {url && <button type="button" disabled={disabled || busy} onClick={() => setUrl('')}>Bỏ ảnh</button>}
    </div>
    <input ref={library} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
    <input ref={camera} type="file" hidden accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
    <small>JPG, PNG hoặc WebP, tối đa 5 MB. Lưu sản phẩm để áp dụng ảnh.</small>
    {busy && <p role="status">Đang tải ảnh…</p>}
    {error && <p className="alert error" role="alert">{error}</p>}
  </div>;
}
