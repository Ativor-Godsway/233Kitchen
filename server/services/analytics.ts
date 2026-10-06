import { DateTime } from 'luxon';
import { OrderModel, toOrderDTO } from '../models/Order.js';
import { DATE_FMT, formatPickupDate, openPickupDates, todayIn } from '../../shared/schedule.js';
import type { AnalyticsResult, RangeKey, Settings } from '../../shared/types.js';

export type { AnalyticsResult, RangeKey };

/** Resolves a range to inclusive pickup-date bounds in the business timezone. */
/** Ranges are by pickup date; multi-week ranges include already-booked upcoming pickups. */
export function resolveRange(key: RangeKey, tz: string, from?: string, to?: string, now = new Date(), weeksAhead = 3) {
  const today = DateTime.fromJSDate(now, { zone: tz }).startOf('day');
  const weekStart = today.startOf('week'); // Monday
  const weekEnd = weekStart.plus({ days: 6 });
  if (key === 'custom' && from && to) {
    const [a, b] = from <= to ? [from, to] : [to, from];
    return { key, from: a, to: b, label: `${formatPickupDate(a, tz)} – ${formatPickupDate(b, tz)}` };
  }
  const horizon = weekEnd.plus({ weeks: weeksAhead }).toFormat(DATE_FMT);
  if (key === '4w') return { key, from: weekStart.minus({ weeks: 3 }).toFormat(DATE_FMT), to: horizon, label: 'Last 4 weeks + upcoming' };
  if (key === '3m') return { key, from: weekStart.minus({ weeks: 12 }).toFormat(DATE_FMT), to: horizon, label: 'Last 3 months + upcoming' };
  return { key: 'week' as const, from: weekStart.toFormat(DATE_FMT), to: weekEnd.toFormat(DATE_FMT), label: 'This week' };
}

/** All analytics are by pickup date and exclude cancelled orders; revenue is estimated (unpaid included). */
export async function buildAnalytics(s: Settings, key: RangeKey, from?: string, to?: string, now = new Date()): Promise<AnalyticsResult> {
  const tz = s.timezone;
  const range = resolveRange(key, tz, from, to, now, s.bookingWeeksAhead);
  const active = { status: { $ne: 'cancelled' } };

  const rows = (await OrderModel.find({ ...active, pickupDate: { $gte: range.from, $lte: range.to } }).lean()).map(toOrderDTO);
  const revenue = rows.reduce((n, o) => n + o.total, 0);

  // New vs returning: a customer is "returning" if they had an earlier active order before the range.
  const customerIds = [...new Set(rows.map((o) => o.customerId).filter(Boolean))] as string[];
  const earlier = customerIds.length
    ? await OrderModel.distinct('customerId', { ...active, customerId: { $in: customerIds }, pickupDate: { $lt: range.from } })
    : [];
  const returningSet = new Set(earlier.map(String));

  // Last 12 pickup days (by configured weekday), ending at the latest booked pickup (or a week ahead).
  const today = DateTime.fromJSDate(now, { zone: tz }).startOf('day');
  const latest = (await OrderModel.find(active).sort({ pickupDate: -1 }).limit(1).select('pickupDate').lean())[0]?.pickupDate;
  const latestDay = latest ? DateTime.fromFormat(latest, DATE_FMT, { zone: tz }) : null;
  const end = latestDay && latestDay > today.plus({ days: 7 }) ? latestDay : today.plus({ days: 7 });
  const pickupDays: string[] = [];
  for (let d = end; pickupDays.length < 12 && d > end.minus({ weeks: 26 }); d = d.minus({ days: 1 })) {
    if (s.pickupDays.includes(d.weekday)) pickupDays.unshift(d.toFormat(DATE_FMT));
  }
  const weeklyAgg = await OrderModel.aggregate<{ _id: string; orders: number; revenue: number }>([
    { $match: { ...active, pickupDate: { $in: pickupDays } } },
    { $group: { _id: '$pickupDate', orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
  ]);
  const weeklyMap = new Map(weeklyAgg.map((w) => [w._id, w]));

  const items = new Map<string, { name: string; quantity: number; revenue: number }>();
  const extras = new Map<string, { name: string; item: string; count: number }>();
  const windows = new Map<string, number>();
  for (const o of rows) {
    windows.set(o.pickupWindowLabel, (windows.get(o.pickupWindowLabel) ?? 0) + 1);
    for (const l of o.items) {
      const it = items.get(l.slug) ?? { name: l.name, quantity: 0, revenue: 0 };
      it.quantity += l.quantity;
      it.revenue += l.lineTotal;
      items.set(l.slug, it);
      for (const sel of l.selections) {
        const key2 = `${l.slug}:${sel.optionKey}`;
        const e = extras.get(key2) ?? { name: sel.name, item: l.name, count: 0 };
        e.count += sel.qty * l.quantity;
        extras.set(key2, e);
      }
    }
  }

  const nextDate = openPickupDates(now, s)[0] ?? null;
  const todayStr = todayIn(tz, now);
  const upcomingDate =
    (await OrderModel.find({ ...active, pickupDate: { $gte: todayStr } }).sort({ pickupDate: 1 }).limit(1).lean())[0]?.pickupDate ?? nextDate;
  let upcoming: AnalyticsResult['upcoming'] = null;
  if (upcomingDate) {
    const [agg] = await OrderModel.aggregate<{ orders: number; revenue: number }>([
      { $match: { ...active, pickupDate: upcomingDate } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]);
    upcoming = { date: upcomingDate, label: formatPickupDate(upcomingDate, tz), orders: agg?.orders ?? 0, revenue: agg?.revenue ?? 0 };
  }

  return {
    range,
    kpis: {
      orders: rows.length,
      revenue,
      avgOrderValue: rows.length ? Math.round(revenue / rows.length) : 0,
      newCustomers: customerIds.filter((id) => !returningSet.has(id)).length,
      returningCustomers: customerIds.filter((id) => returningSet.has(id)).length,
      pendingOrders: await OrderModel.countDocuments({ status: 'new' }),
      unpaidRevenue: rows.filter((o) => o.paymentStatus === 'unpaid').reduce((n, o) => n + o.total, 0),
    },
    weekly: pickupDays.map((d) => ({
      date: d,
      label: DateTime.fromFormat(d, DATE_FMT, { zone: tz }).toFormat('LLL d'),
      orders: weeklyMap.get(d)?.orders ?? 0,
      revenue: weeklyMap.get(d)?.revenue ?? 0,
    })),
    bestSellers: [...items.values()].sort((a, b) => b.quantity - a.quantity),
    extras: [...extras.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    byWindow: s.windows.map((w) => ({ label: w.label, orders: windows.get(w.label) ?? 0 })),
    upcoming,
  };
}
