'use client';
import { useId, useRef } from 'react';
import type { Signature } from '@/lib/signature';

export function SignatureImage({ signature }: { signature: Signature }) {
  return <svg viewBox="0 0 600 220" preserveAspectRatio="none" className="signature-image" role="img" aria-label="Chữ ký xác nhận của khách">
    {signature.strokes.map((stroke, i) => <polyline key={i} points={stroke.map(([x, y]) => `${x * 600},${y * 220}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}

export default function SignaturePad({ value, onChange, disabled }: { value: Signature; onChange: (value: Signature) => void; disabled: boolean }) {
  const helpId = useId();
  const pointer = useRef<number | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const point = (event: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top].map((n, i) => Math.round(Math.max(0, Math.min(1, n / (i ? rect.height : rect.width))) * 1000) / 1000) as [number, number];
  };
  const update = (next: Signature) => { latest.current = next; onChange(next); };
  function finish(event: React.PointerEvent<SVGSVGElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div className="signature-field">
    <p id={helpId}>Khách ký bằng tay hoặc chuột trong khung bên dưới để xác nhận đã thực hiện buổi này.</p>
    <svg viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label="Ô ký xác nhận của khách" aria-describedby={helpId} className="signature-pad"
      onPointerDown={event => {
        if (disabled || pointer.current !== null || (event.pointerType === 'mouse' && event.button !== 0) || latest.current.strokes.length >= 30) return;
        event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
        update({ version: 1, strokes: [...latest.current.strokes, [point(event)]] });
      }}
      onPointerMove={event => {
        if (disabled || pointer.current !== event.pointerId) return;
        const strokes = latest.current.strokes;
        if (strokes.reduce((n, stroke) => n + stroke.length, 0) >= 1000) return;
        update({ version: 1, strokes: [...strokes.slice(0, -1), [...strokes[strokes.length - 1], point(event)]] });
      }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { pointer.current = null; }}>
      {value.strokes.map((stroke, i) => <polyline key={i} points={stroke.map(([x, y]) => `${x * 600},${y * 220}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <button type="button" disabled={disabled} onClick={() => { pointer.current = null; update({ version: 1, strokes: [] }); }}>Ký lại</button>
  </div>;
}
