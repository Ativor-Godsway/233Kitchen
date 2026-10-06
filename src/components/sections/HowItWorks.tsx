import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock } from 'lucide-react';
import { SITE } from '../../content/site';
import { BrandIcon, type BrandIconName } from '../BrandIcon';
import { SectionHeading } from './SectionHeading';
import { usePublicConfig } from '../../lib/queries';
import { Skeleton } from '../ui/Skeleton';

export function CutoffNotice({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { data, isLoading, isError } = usePublicConfig();
  if (isLoading) return <Skeleton className="h-6 w-72" />;
  if (isError || !data) return null;
  const next = data.pickupDates[0];
  const text = data.settings.orderingPaused
    ? data.settings.pausedMessage
    : next
      ? `Orders for ${next.label} close ${next.cutoffLabel}`
      : 'No pickup dates are open right now. Check back soon!';
  return (
    <p
      className={
        tone === 'dark'
          ? 'inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-cream ring-1 ring-white/10'
          : 'inline-flex items-center gap-2 rounded-full bg-ink/5 px-4 py-2 text-sm text-ink ring-1 ring-ink/10'
      }
    >
      <CalendarClock size={16} className="shrink-0 text-ghana-gold" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

export function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-ink-800 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Pre-order. We cook. You pick up."
          sub="A small kitchen that cooks once a week, so every box is fresh."
        />
        <div className="mt-6">
          <CutoffNotice />
        </div>
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {SITE.howItWorks.map((step, i) => (
            <motion.li
              key={step.title}
              initial={reduce ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-3xl bg-white/[0.03] p-7 ring-1 ring-white/10"
            >
              <div className="flex items-center justify-between">
                <BrandIcon
                  name={step.icon as BrandIconName}
                  tone={(['gold', 'red', 'green'] as const)[i]}
                />
                {/* Decorative numeral (order is conveyed by the <ol>). */}
                <span
                  aria-hidden
                  data-step={`0${i + 1}`}
                  className="font-display text-5xl font-semibold text-white/10 before:content-[attr(data-step)]"
                />
              </div>
              <h3 className="mt-6 font-display text-2xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-cream/70">{step.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
