import { motion, useTransform, type MotionValue } from 'framer-motion';
import { useEffect, useState } from 'react';
import { srcSetFor } from '../../lib/images';

/**
 * Isolated hero visual. It only receives scroll progress (0 → 1), so it can be
 * swapped for a 3D/Spline scene later without touching the rest of the hero.
 */
const MAIN = {
  src: '/images/fried-rice-chicken-960.webp',
  alt: 'Loaded fried rice with grilled chicken, plantain and coleslaw',
};
/** Left, right, back. */
const FAN = [
  { src: '/images/banku-tilapia-960.webp', alt: 'Banku with grilled tilapia' },
  { src: '/images/waakye-fish-960.webp', alt: 'Loaded Hajia waakye with fried fish' },
  { src: '/images/braised-rice-960.webp', alt: 'Braised rice plate with plantain and omelette' },
];

/** Matches the card widths below: w-[min(48vw,300px)] md:w-[min(26vw,300px)]. */
const SIZES = '(min-width: 768px) min(26vw, 300px), min(52vw, 300px)';

function useIsWide() {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

function Card({
  src,
  alt,
  eager,
  className,
}: {
  src: string;
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`h-full w-full overflow-hidden rounded-[28px] bg-ink-700 shadow-lift ring-1 ring-white/10 ${className ?? ''}`}
    >
      <img
        src={src}
        srcSet={srcSetFor(src)}
        sizes={SIZES}
        alt={alt}
        className="h-full w-full object-cover"
        loading={eager ? 'eager' : 'lazy'}
        // @ts-expect-error fetchpriority is valid HTML but not yet in React 18 types
        fetchpriority={eager ? 'high' : 'auto'}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}

export function HeroVisual({ progress }: { progress: MotionValue<number> }) {
  const wide = useIsWide();
  const spread = wide ? 68 : 58; // % of card width

  // Phase 1 (0 → .42): the main dish rises, straightens and scales up.
  const mainY = useTransform(progress, [0, 0.42], ['38svh', '0svh']);
  const mainScale = useTransform(progress, [0, 0.42], [0.66, 1]);
  const mainRotate = useTransform(progress, [0, 0.42], [-9, 0]);

  // Phase 2 (.42 → .66): three dishes fan out from behind it.
  const fanP = useTransform(progress, [0.42, 0.66], [0, 1], { clamp: true });
  const fanOpacity = useTransform(progress, [0.4, 0.5], [0, 1]);
  const leftX = useTransform(fanP, [0, 1], ['0%', `-${spread}%`]);
  const rightX = useTransform(fanP, [0, 1], ['0%', `${spread}%`]);
  const sideRotL = useTransform(fanP, [0, 1], [0, -11]);
  const sideRotR = useTransform(fanP, [0, 1], [0, 11]);
  const sideY = useTransform(fanP, [0, 1], ['0%', '7%']);
  const backY = useTransform(fanP, [0, 1], ['0%', '-17%']);
  const sideScale = useTransform(fanP, [0, 1], [0.8, 0.9]);
  const backScale = useTransform(fanP, [0, 1], [0.8, 0.84]);

  // Glow behind the dishes intensifies as they arrive.
  const glow = useTransform(progress, [0.1, 0.5], [0.25, 1]);

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden={false}
    >
      <motion.div
        aria-hidden
        className="absolute h-[70vmin] w-[70vmin] rounded-full"
        style={{
          opacity: glow,
          background:
            'radial-gradient(closest-side, rgba(225,161,12,.28), rgba(200,16,16,.10) 55%, transparent)',
        }}
      />
      <div className="relative aspect-[3/4] w-[min(48vw,300px)] md:w-[min(26vw,300px)]">
        <motion.div
          className="absolute inset-0"
          style={{ y: backY, scale: backScale, opacity: fanOpacity }}
        >
          <Card {...FAN[2]} />
        </motion.div>
        <motion.div
          className="absolute inset-0"
          style={{ x: leftX, y: sideY, rotate: sideRotL, scale: sideScale, opacity: fanOpacity }}
        >
          <Card {...FAN[0]} />
        </motion.div>
        <motion.div
          className="absolute inset-0"
          style={{ x: rightX, y: sideY, rotate: sideRotR, scale: sideScale, opacity: fanOpacity }}
        >
          <Card {...FAN[1]} />
        </motion.div>
        <motion.div
          className="absolute inset-0"
          style={{ y: mainY, scale: mainScale, rotate: mainRotate }}
        >
          <Card {...MAIN} eager />
        </motion.div>
      </div>
    </div>
  );
}

/** Static arrangement for prefers-reduced-motion. */
export function HeroVisualStatic() {
  return (
    <div className="relative mx-auto mt-14 aspect-[3/4] w-[min(52vw,280px)]" aria-hidden={false}>
      <div className="absolute inset-0 -translate-x-[58%] translate-y-[6%] -rotate-[10deg] scale-90">
        <Card {...FAN[0]} />
      </div>
      <div className="absolute inset-0 translate-x-[58%] translate-y-[6%] rotate-[10deg] scale-90">
        <Card {...FAN[1]} />
      </div>
      <div className="absolute inset-0">
        <Card {...MAIN} eager />
      </div>
    </div>
  );
}
