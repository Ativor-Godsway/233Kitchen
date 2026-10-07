import { CalendarClock } from 'lucide-react';
import { usePublicConfig } from '../../lib/queries';
import { Skeleton } from '../ui/Skeleton';

/** One-line live cutoff info, e.g. "Orders for Wed, Oct 14 close Mon at 11:59 PM". */
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
