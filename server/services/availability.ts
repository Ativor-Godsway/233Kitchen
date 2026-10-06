import { OrderModel, ACTIVE_STATUSES } from '../models/Order.js';
import {
  cutoffFor,
  formatCutoff,
  formatPickupDate,
  openPickupDates,
  windowRemaining,
} from '../../shared/schedule.js';
import type { PickupDateOption, Settings } from '../../shared/types.js';

/** Active (non-cancelled) order counts per "date|windowId". */
export async function windowCounts(dates: string[]): Promise<Map<string, number>> {
  if (!dates.length) return new Map();
  const rows = await OrderModel.aggregate<{ _id: { d: string; w: string }; n: number }>([
    { $match: { pickupDate: { $in: dates }, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: { d: '$pickupDate', w: '$pickupWindowId' }, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [`${r._id.d}|${r._id.w}`, r.n]));
}

/** Open pickup dates with live per-window capacity. */
export async function getPickupOptions(settings: Settings, now = new Date()): Promise<PickupDateOption[]> {
  const dates = openPickupDates(now, settings);
  const counts = await windowCounts(dates);
  return dates.map((date) => ({
    date,
    label: formatPickupDate(date, settings.timezone),
    cutoffAt: cutoffFor(date, settings).toUTC().toISO()!,
    cutoffLabel: formatCutoff(date, settings),
    windows: settings.windows.map((w) => {
      const remaining = windowRemaining(w, counts.get(`${date}|${w.id}`) ?? 0);
      return { ...w, remaining, isFull: remaining !== null && remaining <= 0 };
    }),
  }));
}
