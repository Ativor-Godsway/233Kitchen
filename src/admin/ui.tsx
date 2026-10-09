/** Light-theme admin UI kit (Linear/Stripe-style): white surfaces, soft borders, brand accents. */
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { PAYMENT_LABELS, STATUS_LABELS } from '../../shared/constants';
import type { OrderStatus, PaymentStatus } from '../../shared/types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: 'sm' | 'md';
    loading?: boolean;
  }
>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-11 px-3 text-xs lg:h-8' : 'h-11 px-4 text-sm lg:h-10',
        variant === 'primary' && 'bg-neutral-900 text-white hover:bg-neutral-700',
        variant === 'brand' && 'bg-ghana-green text-white hover:bg-ghana-green-600',
        variant === 'secondary' &&
          'border border-neutral-200 bg-white text-neutral-900 shadow-sm hover:bg-neutral-50',
        variant === 'ghost' && 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
        variant === 'danger' && 'border border-red-200 bg-white text-ghana-red hover:bg-red-50',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-neutral-200 bg-white shadow-card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        {sub && <p className="mt-1 text-sm text-neutral-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const fieldCls =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-ghana-green focus:outline-none focus:ring-2 focus:ring-ghana-green/20 disabled:bg-neutral-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(fieldCls, 'h-11 lg:h-10', className)} {...rest} />;
  },
);

/**
 * Password field with a show/hide toggle. The toggle never submits, never steals focus from a
 * focused input (pointer/touch), keeps the caret where it was, and the field goes back to
 * hidden whenever its form is submitted.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    autoComplete: 'current-password' | 'new-password';
  }
>(function PasswordInput({ className, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caret = useRef<{ start: number | null; end: number | null; focused: boolean } | null>(null);

  const setRefs = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  // Hide again after the form is submitted, so the password isn't left on screen.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener('submit', hide);
    return () => form.removeEventListener('submit', hide);
  }, []);

  // Changing `type` can reset the selection in some browsers; put the caret back.
  useLayoutEffect(() => {
    const el = inputRef.current;
    const c = caret.current;
    caret.current = null;
    if (!el || !c) return;
    if (c.focused) el.focus();
    if (c.start !== null && c.end !== null) el.setSelectionRange(c.start, c.end);
  }, [visible]);

  const toggle = () => {
    const el = inputRef.current;
    caret.current = el
      ? {
          start: el.selectionStart,
          end: el.selectionEnd,
          focused: document.activeElement === el,
        }
      : null;
    setVisible((v) => !v);
  };

  const label = visible ? 'Hide password' : 'Show password';
  return (
    <div className="relative">
      <input
        ref={setRefs}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn(fieldCls, 'h-11 pr-11 lg:h-10', className)}
        {...rest}
      />
      <button
        type="button"
        onClick={toggle}
        // Keep focus (and the mobile keyboard) on the input when tapped or clicked.
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        aria-label={label}
        aria-pressed={visible}
        aria-controls={rest.id}
        title={label}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ghana-green/40"
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldCls, 'py-2', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(fieldCls, 'h-11 pr-8 lg:h-10', className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-ghana-red">{error}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        // The after: layer grows the tap area to 44px without changing the look.
        "relative h-6 w-11 shrink-0 rounded-full transition after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-[''] disabled:opacity-50",
        checked ? 'bg-ghana-green' : 'bg-neutral-300',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  new: 'bg-ghana-red-50 text-ghana-red-700 ring-ghana-red-200',
  confirmed: 'bg-ghana-gold-50 text-ghana-gold-800 ring-ghana-gold-200',
  preparing: 'bg-orange-50 text-orange-800 ring-orange-200',
  ready: 'bg-ghana-green-50 text-ghana-green-700 ring-ghana-green-200',
  completed: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  cancelled: 'bg-white text-neutral-500 ring-neutral-200 line-through',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLES[status],
      )}
    >
      {status === 'new' && <span className="h-1.5 w-1.5 rounded-full bg-ghana-red" aria-hidden />}
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentPill({ status }: { status: PaymentStatus }) {
  const paid = status !== 'unpaid';
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        paid
          ? 'bg-ghana-green-50 text-ghana-green-700 ring-ghana-green-200'
          : 'bg-neutral-50 text-neutral-600 ring-neutral-200',
      )}
    >
      {PAYMENT_LABELS[status]}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('animate-spin text-neutral-400', className)}
      size={20}
      aria-label="Loading"
    />
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-500">
          {icon}
        </div>
      )}
      <p className="font-medium text-neutral-900">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-neutral-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      role="alert"
    >
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-neutral-100" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 w-20 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 flex-1 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}
