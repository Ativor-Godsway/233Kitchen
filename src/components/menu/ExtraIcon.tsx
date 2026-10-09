import { iconSrc } from '../../../shared/icons';
import { cn } from '../../lib/cn';

/**
 * Transparent extras icon: WebP (128/256w) with a PNG fallback, lazy-loaded.
 * `surface` picks the drop-shadow strength; `pop` replays the bump animation whenever it changes.
 */
export function ExtraIcon({
  name,
  size = 48,
  surface = 'dark',
  pop,
  className,
}: {
  name: string | undefined;
  size?: number;
  surface?: 'dark' | 'light';
  pop?: number;
  className?: string;
}) {
  if (!name) return null;
  return (
    <span
      key={pop}
      aria-hidden
      className={cn('inline-block shrink-0', pop ? 'icon-pop' : '', className)}
      style={{ width: size, height: size }}
    >
      <picture>
        <source
          type="image/webp"
          srcSet={`${iconSrc(name, 128)} 128w, ${iconSrc(name, 256)} 256w`}
          sizes={`${size}px`}
        />
        <img
          src={iconSrc(name, 256, 'png')}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn(
            'h-full w-full object-contain',
            surface === 'dark' ? 'icon-shadow-dark' : 'icon-shadow-light',
          )}
        />
      </picture>
    </span>
  );
}
