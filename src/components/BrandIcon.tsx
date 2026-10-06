import {
  CalendarCheck,
  Car,
  ChefHat,
  Clock,
  CupSoda,
  Flame,
  MapPin,
  Phone,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Single slot for brand icons. Today these are lucide line icons in a soft
 * badge; later, drop 3D renders into /public/icons/<name>.png (or a Spline
 * scene) and list them in THREE_D below — no other component changes needed.
 */
export type BrandIconName =
  | 'preorder'
  | 'cook'
  | 'pickup'
  | 'location'
  | 'phone'
  | 'time'
  | 'courier'
  | 'ice-kenkey'
  | 'spice'
  | 'sparkle'
  | 'dish';

const ICONS: Record<BrandIconName, LucideIcon> = {
  preorder: ShoppingBag,
  cook: ChefHat,
  pickup: CalendarCheck,
  location: MapPin,
  phone: Phone,
  time: Clock,
  courier: Car,
  'ice-kenkey': CupSoda,
  spice: Flame,
  sparkle: Sparkles,
  dish: UtensilsCrossed,
};

/** Names with a 3D asset available at /icons/<name>.png. Empty until assets arrive. */
const THREE_D: Partial<Record<BrandIconName, string>> = {};

const TONES = {
  gold: 'bg-ghana-gold/15 text-ghana-gold ring-ghana-gold/30',
  red: 'bg-ghana-red/15 text-ghana-red-300 ring-ghana-red/30',
  green: 'bg-ghana-green/20 text-ghana-green-300 ring-ghana-green/40',
  plain: 'bg-white/5 text-cream ring-white/10',
  ink: 'bg-ink/5 text-ink ring-ink/10',
} as const;

interface BrandIconProps {
  name: BrandIconName;
  size?: number;
  tone?: keyof typeof TONES;
  badge?: boolean;
  className?: string;
}

export function BrandIcon({ name, size = 24, tone = 'gold', badge = true, className }: BrandIconProps) {
  const asset = THREE_D[name];
  const Icon = ICONS[name];
  const content = asset ? (
    <img src={asset} alt="" width={size * 1.6} height={size * 1.6} loading="lazy" />
  ) : (
    <Icon size={size} strokeWidth={1.75} aria-hidden />
  );
  if (!badge) return <span className={cn('inline-grid place-items-center', className)}>{content}</span>;
  return (
    <span
      className={cn('inline-grid place-items-center rounded-2xl ring-1', TONES[tone], className)}
      style={{ width: size * 2.1, height: size * 2.1 }}
      aria-hidden
    >
      {content}
    </span>
  );
}
