import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/cn';

interface StepperProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: 'sm' | 'md';
  tone?: 'dark' | 'light';
  disabled?: boolean;
}

/** Accessible − / + quantity stepper. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 5,
  label,
  size = 'md',
  tone = 'dark',
  disabled,
}: StepperProps) {
  const btn = cn(
    'grid place-items-center rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed',
    size === 'sm' ? 'h-11 w-11 lg:h-9 lg:w-9' : 'h-11 w-11',
    tone === 'dark'
      ? 'bg-white/10 hover:bg-white/20 text-cream'
      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900',
  );
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label}`}
      >
        <Minus size={16} aria-hidden />
      </button>
      <span
        className={cn(
          'min-w-6 text-center font-semibold tabular-nums',
          size === 'sm' ? 'text-sm' : 'text-base',
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}
