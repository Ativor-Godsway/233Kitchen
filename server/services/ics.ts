import { windowRange } from '../../shared/schedule.js';
import type { OrderDTO, Settings } from '../../shared/types.js';
import { env } from '../env.js';

const fmt = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const escIcs = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Folds lines at 75 octets as required by RFC 5545. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function orderIcs(order: OrderDTO, s: Settings): string {
  const w = s.windows.find((x) => x.id === order.pickupWindowId);
  const range = w
    ? windowRange(order.pickupDate, w, s.timezone)
    : windowRange(order.pickupDate, { start: '12:00', end: '13:00' }, s.timezone);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//+233 Kitchen//Orders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${order.number}@233kitchen`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(range.start.toJSDate())}`,
    `DTEND:${fmt(range.end.toJSDate())}`,
    `SUMMARY:${escIcs(`+233 Kitchen pickup · ${order.number}`)}`,
    `LOCATION:${escIcs(s.pickupAddressFull)}`,
    `DESCRIPTION:${escIcs(`Order ${order.number} · ${order.pickupWindowLabel}\n${s.paymentInstructions}\nQuestions? ${s.businessPhone}`)}`,
    `URL:${env.siteUrl}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:+233 Kitchen pickup in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
