'use client';

import { useId, useState } from 'react';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  hint?: string;
}

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--foreground)] opacity-90 mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          aria-describedby={hint ? `${id}-hint` : undefined}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-24 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary-light)] focus:border-[var(--primary-light)] transition-all placeholder-[var(--foreground)]/40"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-pressed={visible}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-[var(--foreground)]/60">
          {hint}
        </p>
      )}
    </div>
  );
}
