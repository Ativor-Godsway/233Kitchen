import { BrandIcon } from '../BrandIcon';
import { srcSetFor } from '../../lib/images';
import { cn } from '../../lib/cn';
import type { MenuItem } from '../../../shared/types';

/** Dish photo, or a tasteful gradient placeholder (e.g. Ice Kenkey) until a photo is added. */
export function MenuImage({ item, sizes, className, eager }: { item: MenuItem; sizes: string; className?: string; eager?: boolean }) {
  if (!item.image) {
    return (
      <div
        className={cn('relative grid place-items-center overflow-hidden', className)}
        style={{ background: 'radial-gradient(120% 90% at 30% 20%, #F5D684 0%, #E1A10C 35%, #8C6407 75%, #3D2B03 100%)' }}
        role="img"
        aria-label={`${item.name} (photo coming soon)`}
      >
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.5) 1px, transparent 1.5px)', backgroundSize: '14px 14px' }} />
        <BrandIcon name="ice-kenkey" size={40} tone="plain" className="relative !bg-white/20 !text-white backdrop-blur-sm" />
      </div>
    );
  }
  return (
    <img
      src={item.image}
      srcSet={srcSetFor(item.image)}
      sizes={sizes}
      alt={item.name}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('object-cover', className)}
    />
  );
}
