import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../lib/cn';

/**
 * Thin kente-inspired accent band (red · gold · green · black blocks with
 * fine weave lines). Only ever used as a divider, never as a background.
 */
export function KenteBand({ className, animate = false, height = 8 }: { className?: string; animate?: boolean; height?: number }) {
  const reduce = useReducedMotion();
  const style = {
    height,
    backgroundImage: [
      'repeating-linear-gradient(90deg, rgba(0,0,0,.35) 0 1px, transparent 1px 6px)',
      'linear-gradient(90deg, #C81010 0 22%, #E1A10C 22% 30%, #1E6131 30% 52%, #0B0B0B 52% 56%, #E1A10C 56% 78%, #1E6131 78% 86%, #C81010 86% 100%)',
    ].join(','),
    backgroundSize: '96px 100%, 96px 100%',
  };
  if (!animate || reduce) return <div aria-hidden className={cn('w-full', className)} style={style} />;
  return (
    <motion.div
      aria-hidden
      className={cn('w-full origin-left', className)}
      style={style}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}
