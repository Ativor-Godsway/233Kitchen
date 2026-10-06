import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/cn';

export function SectionHeading({
  eyebrow,
  title,
  sub,
  tone = 'dark',
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  tone?: 'dark' | 'light';
  align?: 'left' | 'center';
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}
    >
      <p className={cn('text-xs font-semibold uppercase tracking-[0.22em]', tone === 'dark' ? 'text-ghana-gold' : 'text-ghana-red')}>
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.02em] sm:text-5xl">{title}</h2>
      {sub && <p className={cn('mt-4 text-base sm:text-lg', tone === 'dark' ? 'text-cream/70' : 'text-ink/70')}>{sub}</p>}
    </motion.div>
  );
}
