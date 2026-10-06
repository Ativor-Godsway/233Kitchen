import { DateTime } from 'luxon';
import type { ScheduleSettings, TimeWindow } from './types.js';

/**
 * Pickup / cutoff logic. Everything is computed in the business timezone
 * (America/New_York by default), so DST changes are handled by Luxon.
 */

export const DATE_FMT = 'yyyy-MM-dd';

function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(':').map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

/** Start of the given pickup date in the business zone. */
export function pickupDay(date: string, tz: string): DateTime {
  return DateTime.fromFormat(date, DATE_FMT, { zone: tz }).startOf('day');
}

/**
 * The last instant orders are accepted for a pickup date.
 * Default: Monday 23:59 for a Wednesday pickup — the whole 23:59 minute counts,
 * so the cutoff instant is 23:59:59.999 local time.
 */
export function cutoffFor(
  date: string,
  s: Pick<ScheduleSettings, 'timezone' | 'cutoffDaysBefore' | 'cutoffTime'>,
): DateTime {
  const { hour, minute } = parseHm(s.cutoffTime);
  return pickupDay(date, s.timezone)
    .minus({ days: s.cutoffDaysBefore })
    .set({ hour, minute, second: 59, millisecond: 999 });
}

export function isBeforeCutoff(date: string, now: Date, s: ScheduleSettings): boolean {
  return DateTime.fromJSDate(now).toMillis() <= cutoffFor(date, s).toMillis();
}

/** Candidate pickup dates (by weekday) from today for the booking horizon. */
function candidateDates(now: Date, s: ScheduleSettings): string[] {
  const today = DateTime.fromJSDate(now, { zone: s.timezone }).startOf('day');
  const out: string[] = [];
  const days = Math.max(1, s.bookingWeeksAhead) * 7 + 7;
  for (let i = 0; i <= days; i++) {
    const d = today.plus({ days: i });
    if (s.pickupDays.includes(d.weekday)) out.push(d.toFormat(DATE_FMT));
  }
  return out;
}

/**
 * Pickup dates still open for ordering right now, soonest first.
 * Limited to `bookingWeeksAhead` open dates per pickup weekday.
 */
export function openPickupDates(now: Date, s: ScheduleSettings): string[] {
  if (s.orderingPaused) return [];
  const closed = new Set(s.closedDates);
  const open = candidateDates(now, s).filter((d) => !closed.has(d) && isBeforeCutoff(d, now, s));
  return open.slice(0, Math.max(1, s.bookingWeeksAhead) * Math.max(1, s.pickupDays.length));
}

/** Whether a customer may order for `date` right now (ignores capacity). */
export function isDateOrderable(date: string, now: Date, s: ScheduleSettings): boolean {
  return openPickupDates(now, s).includes(date);
}

/** "Wed, Oct 14" */
export function formatPickupDate(date: string, tz: string): string {
  return pickupDay(date, tz).toFormat('ccc, LLL d');
}

/** "Wednesday, October 14" */
export function formatPickupDateLong(date: string, tz: string): string {
  return pickupDay(date, tz).toFormat('cccc, LLLL d');
}

/** "Mon at 11:59 PM" */
export function formatCutoff(date: string, s: ScheduleSettings): string {
  return cutoffFor(date, s).toFormat("ccc 'at' h:mm a");
}

/** "Orders for Wed, Oct 14 close Mon at 11:59 PM" */
export function cutoffMessage(date: string, s: ScheduleSettings): string {
  return `Orders for ${formatPickupDate(date, s.timezone)} close ${formatCutoff(date, s)}`;
}

/** Absolute start/end of a pickup window, for calendar files. */
export function windowRange(date: string, w: Pick<TimeWindow, 'start' | 'end'>, tz: string) {
  const day = pickupDay(date, tz);
  return { start: day.set(parseHm(w.start)), end: day.set(parseHm(w.end)) };
}

/** Remaining capacity for a window given the current number of active orders. */
export function windowRemaining(
  w: Pick<TimeWindow, 'capacity'>,
  activeOrders: number,
): number | null {
  if (w.capacity === null || w.capacity === undefined) return null;
  return Math.max(0, w.capacity - activeOrders);
}

export function isWindowFull(w: Pick<TimeWindow, 'capacity'>, activeOrders: number): boolean {
  const r = windowRemaining(w, activeOrders);
  return r !== null && r <= 0;
}

/** Today's date string in the business timezone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  return DateTime.fromJSDate(now, { zone: tz }).toFormat(DATE_FMT);
}
