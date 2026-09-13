import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, ChangeEvent } from 'react';

export function Panel({
  title,
  actions,
  children,
  className = '',
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-discord-muted">
          <span>{title}</span>
          {actions}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-discord-text">
        {label}
        {hint && <span className="ml-2 font-normal text-discord-muted">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-discord-red">{error}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded border border-discord-sidebar bg-discord-sidebar px-2.5 py-1.5 text-sm text-discord-text placeholder-discord-muted outline-none transition focus:border-discord-accent disabled:opacity-50';

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${className}`} />;
}

export function TextArea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} min-h-24 resize-y leading-relaxed ${className}`} />;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <TextInput
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '') return onChange(undefined);
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-xs font-semibold text-discord-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-discord-accent' : 'bg-discord-sidebar'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? 'left-4.5' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} appearance-none`}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ColorInput({
  value,
  onChange,
}: {
  /** RGB integer or null */
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  const hex =
    typeof value === 'number' ? '#' + value.toString(16).padStart(6, '0').slice(-6) : '#5865f2';
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(parseInt(e.target.value.slice(1), 16))}
        className="h-8 w-10 cursor-pointer rounded border border-discord-sidebar bg-discord-sidebar p-0.5"
      />
      <TextInput
        value={typeof value === 'number' ? String(value) : ''}
        placeholder="null (no accent)"
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === '') return onChange(null);
          const n = Number(raw);
          if (Number.isFinite(n) && n >= 0 && n <= 0xffffff) onChange(Math.floor(n));
        }}
      />
      <button
        type="button"
        className="rounded px-1.5 py-1 text-xs text-discord-muted hover:bg-discord-hover hover:text-discord-text"
        onClick={() => onChange(null)}
        title="Clear accent color"
      >
        ✕
      </button>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles = {
    default: 'bg-discord-panel hover:bg-discord-hover text-discord-text',
    primary: 'bg-discord-accent hover:bg-discord-accent-hover text-white',
    danger: 'bg-discord-red/90 hover:bg-discord-red text-white',
    ghost: 'bg-transparent hover:bg-discord-hover text-discord-muted hover:text-discord-text',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  title,
  danger,
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={`grid h-6 w-6 place-items-center rounded text-xs transition-colors ${
        danger
          ? 'text-discord-muted hover:bg-discord-red hover:text-white'
          : 'text-discord-muted hover:bg-discord-hover hover:text-discord-text'
      }`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'error' | 'warning' | 'success';
}) {
  const tones = {
    neutral: 'bg-discord-sidebar text-discord-muted',
    error: 'bg-discord-red/20 text-discord-red',
    warning: 'bg-discord-yellow/15 text-discord-yellow',
    success: 'bg-discord-green/20 text-discord-green',
  }[tone];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${tones}`}>
      {children}
    </span>
  );
}
