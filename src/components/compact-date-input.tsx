'use client';
import type { InputHTMLAttributes } from 'react';

// Keep the native picker while giving its platform-specific text a fixed boundary.
export default function CompactDateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const value = typeof props.value === 'string' ? props.value : '';
  const display = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : 'dd/mm/yyyy';
  return <span className="compact-date-control">
    <span aria-hidden="true" className="compact-date-value">{display}</span>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 11h18" /></svg>
    <input {...props} type="date" onClick={event => {
      props.onClick?.(event);
      if (!event.defaultPrevented) { try { event.currentTarget.showPicker?.(); } catch { /* Native focus remains available. */ } }
    }} />
  </span>;
}
