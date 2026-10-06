import { cn } from '../lib/cn';

/** Circular logo badge generated from reference/logo.jpeg. */
export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/images/logo-256.png"
      srcSet="/images/logo-256.png 1x, /images/logo-512.webp 2x"
      width={size}
      height={size}
      alt="+233 Kitchen"
      className={cn('rounded-full', className)}
      decoding="async"
    />
  );
}
