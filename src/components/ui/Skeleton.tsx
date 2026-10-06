import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-current/10 opacity-60',
        'animate-pulse',
        className,
      )}
      aria-hidden
    />
  );
}
