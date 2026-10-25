'use client';

import { useState, type ComponentProps } from 'react';

export default function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ display: 'block', position: 'relative' }}>
      <input {...props} type={visible ? 'text' : 'password'} style={{ ...props.style, paddingRight: '76px' }} />
      <button
        type="button"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        onClick={() => setVisible(value => !value)}
        style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', width: 'auto', minHeight: '44px', padding: '8px 12px', margin: 0, border: 0, background: 'transparent', color: 'var(--green)', fontSize: '14px', cursor: 'pointer' }}
      >
        {visible ? 'Ẩn' : 'Hiện'}
      </button>
    </span>
  );
}
