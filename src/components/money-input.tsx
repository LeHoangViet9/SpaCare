'use client';
import { useState, type InputHTMLAttributes } from 'react';
// Preserve the raw draft while typing: no reformatting or caret moves in onChange.
export default function MoneyInput({ value, defaultValue, onValueChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & { value?: string | number; defaultValue?: string | number; onValueChange?: (value: string) => void }) {
  const [draft, setDraft] = useState(String(defaultValue ?? ''));
  return <input {...props} type="text" inputMode="numeric" pattern="(?:[0-9]+|[0-9]{1,3}(?:[.][0-9]{3})+)" value={value ?? draft} onChange={e => { setDraft(e.target.value); onValueChange?.(e.target.value); }} />;
}
