import { OrderModel, toOrderDTO } from '../models/Order.js';
import { MenuItemModel } from '../models/MenuItem.js';
import { formatPickupDateLong } from '../../shared/schedule.js';
import { describeSelections, formatMoney } from '../../shared/pricing.js';
import { FULFILMENT_LABELS, PAYMENT_LABELS, STATUS_LABELS } from '../../shared/constants.js';
import type { PrepItemTotal, PrepSheet, Settings } from '../../shared/types.js';

/** Aggregated cooking quantities for one pickup date (cancelled orders excluded). */
export async function buildPrepSheet(date: string, s: Settings): Promise<PrepSheet> {
  const rows = await OrderModel.find({ pickupDate: date, status: { $ne: 'cancelled' } })
    .sort({ pickupWindowId: 1, seq: 1 })
    .lean();
  const orders = rows.map(toOrderDTO);
  const menu = await MenuItemModel.find().select('slug sortOrder optionGroups').lean();
  const menuOrder = new Map(menu.map((m) => [m.slug, m.sortOrder ?? 0]));
  // Current icons, for orders placed before icons existed.
  const menuIcons = new Map(
    menu.flatMap((m) =>
      (m.optionGroups ?? []).flatMap((g) =>
        (g.options ?? []).map((o) => [`${m.slug}:${g.key}:${o.key}`, o.icon ?? undefined]),
      ),
    ),
  );

  const items = new Map<
    string,
    PrepItemTotal & {
      opt: Map<string, { group: string; name: string; count: number; icon?: string }>;
    }
  >();
  for (const o of orders) {
    for (const l of o.items) {
      const t = items.get(l.slug) ?? {
        slug: l.slug,
        name: l.name,
        quantity: 0,
        options: [],
        opt: new Map(),
      };
      t.quantity += l.quantity;
      for (const sel of l.selections) {
        const key = `${sel.groupKey}:${sel.optionKey}`;
        const icon = sel.icon ?? menuIcons.get(`${l.slug}:${key}`);
        const cur = t.opt.get(key) ?? {
          group: sel.groupName,
          name: sel.name,
          count: 0,
          ...(icon ? { icon } : {}),
        };
        // Extras multiply by the line quantity (2 boxes × 1 extra plantain = 2 extra plantain).
        cur.count += sel.qty * l.quantity;
        t.opt.set(key, cur);
      }
      items.set(l.slug, t);
    }
  }

  const windowOrder = new Map(s.windows.map((w, i) => [w.id, i]));
  orders.sort(
    (a, b) =>
      (windowOrder.get(a.pickupWindowId) ?? 99) - (windowOrder.get(b.pickupWindowId) ?? 99) ||
      a.number.localeCompare(b.number),
  );

  return {
    date,
    label: formatPickupDateLong(date, s.timezone),
    orderCount: orders.length,
    revenue: orders.reduce((n, o) => n + o.total, 0),
    items: [...items.values()]
      .sort((a, b) => (menuOrder.get(a.slug) ?? 99) - (menuOrder.get(b.slug) ?? 99))
      .map(({ opt, ...t }) => ({
        ...t,
        options: [...opt.values()].sort(
          (a, b) => a.group.localeCompare(b.group) || b.count - a.count,
        ),
      })),
    windows: s.windows.map((w) => ({
      id: w.id,
      label: w.label,
      count: orders.filter((o) => o.pickupWindowId === w.id).length,
    })),
    fulfilment: {
      pickup: orders.filter((o) => o.fulfilment === 'pickup').length,
      uber: orders.filter((o) => o.fulfilment === 'uber').length,
    },
    orders,
  };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  // Neutralise spreadsheet formula injection and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function toCsv(rows: Array<Array<string | number>>): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function prepSheetCsv(sheet: PrepSheet): string {
  const rows: Array<Array<string | number>> = [
    [
      'Order',
      'Window',
      'Customer',
      'Phone',
      'Fulfilment',
      'Item',
      'Qty',
      'Options',
      'Item notes',
      'Order notes',
      'Order total',
      'Status',
      'Payment',
    ],
  ];
  for (const o of sheet.orders) {
    for (const l of o.items) {
      rows.push([
        o.number,
        o.pickupWindowLabel,
        o.customer.name,
        o.customer.phone,
        FULFILMENT_LABELS[o.fulfilment],
        l.name,
        l.quantity,
        describeSelections(l.selections),
        l.notes,
        o.notes,
        formatMoney(o.total),
        STATUS_LABELS[o.status],
        PAYMENT_LABELS[o.paymentStatus],
      ]);
    }
  }
  rows.push([]);
  rows.push(['TOTALS']);
  for (const i of sheet.items) {
    rows.push([i.name, '', '', '', '', '', i.quantity]);
    for (const opt of i.options) rows.push(['', '', '', '', '', `  ${opt.name}`, opt.count]);
  }
  return toCsv(rows);
}
