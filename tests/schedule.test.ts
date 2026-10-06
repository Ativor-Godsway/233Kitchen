import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import {
  cutoffFor,
  cutoffMessage,
  isDateOrderable,
  isWindowFull,
  openPickupDates,
  windowRange,
  windowRemaining,
} from '../shared/schedule.js';
import type { ScheduleSettings } from '../shared/types.js';

const s: ScheduleSettings = { ...DEFAULT_SETTINGS };
const at = (iso: string) => new Date(iso);

describe('cutoff (America/New_York)', () => {
  it('closes Wednesday orders on Monday 11:59 PM local time (EDT)', () => {
    // Wed Oct 14 2026; Mon Oct 12 23:59:59.999 EDT = Oct 13 03:59:59.999Z
    expect(cutoffFor('2026-10-14', s).toUTC().toISO()).toBe('2026-10-13T03:59:59.999Z');
  });

  it('accepts an order at Mon 11:59:30 PM and rejects at Tue 12:00 AM', () => {
    expect(isDateOrderable('2026-10-14', at('2026-10-13T03:59:30Z'), s)).toBe(true);
    expect(isDateOrderable('2026-10-14', at('2026-10-13T04:00:00Z'), s)).toBe(false);
  });

  it('after the cutoff the next open date is the following Wednesday', () => {
    expect(openPickupDates(at('2026-10-13T04:00:00Z'), s)[0]).toBe('2026-10-21');
    expect(openPickupDates(at('2026-10-13T03:00:00Z'), s)[0]).toBe('2026-10-14');
  });

  it('handles the fall DST change (EDT → EST, Nov 1 2026)', () => {
    // Wed Nov 4 2026; Mon Nov 2 23:59 EST = Nov 3 04:59Z
    expect(cutoffFor('2026-11-04', s).toUTC().toISO()).toBe('2026-11-03T04:59:59.999Z');
    expect(isDateOrderable('2026-11-04', at('2026-11-03T04:30:00Z'), s)).toBe(true); // 11:30 PM EST
    expect(isDateOrderable('2026-11-04', at('2026-11-03T05:00:00Z'), s)).toBe(false); // 12:00 AM EST
  });

  it('handles the spring DST change (EST → EDT, Mar 8 2026)', () => {
    // Wed Mar 11 2026; Mon Mar 9 23:59 EDT = Mar 10 03:59Z
    expect(cutoffFor('2026-03-11', s).toUTC().toISO()).toBe('2026-03-10T03:59:59.999Z');
    expect(isDateOrderable('2026-03-11', at('2026-03-10T03:59:00Z'), s)).toBe(true);
    expect(isDateOrderable('2026-03-11', at('2026-03-10T04:00:00Z'), s)).toBe(false);
  });

  it('a late Tuesday-night order in UTC terms still respects New York time', () => {
    // Mon Oct 12 22:00 EDT is already Tuesday 02:00 UTC — still open.
    expect(isDateOrderable('2026-10-14', at('2026-10-13T02:00:00Z'), s)).toBe(true);
  });

  it('only returns pickup weekdays (Wednesdays) within the booking horizon', () => {
    const dates = openPickupDates(at('2026-10-06T15:00:00Z'), s);
    expect(dates).toEqual(['2026-10-14', '2026-10-21', '2026-10-28']);
    // On Monday before the cutoff, this Wednesday is still bookable.
    expect(openPickupDates(at('2026-10-05T15:00:00Z'), s)[0]).toBe('2026-10-07');
  });

  it('on Wednesday itself the same-day pickup is closed', () => {
    expect(openPickupDates(at('2026-10-07T16:00:00Z'), s)[0]).toBe('2026-10-14');
  });

  it('skips closed dates and returns nothing when paused', () => {
    expect(
      openPickupDates(at('2026-10-06T15:00:00Z'), { ...s, closedDates: ['2026-10-14'] })[0],
    ).toBe('2026-10-21');
    expect(openPickupDates(at('2026-10-06T15:00:00Z'), { ...s, orderingPaused: true })).toEqual([]);
  });

  it('builds a friendly cutoff message', () => {
    expect(cutoffMessage('2026-10-14', s)).toBe('Orders for Wed, Oct 14 close Mon at 11:59 PM');
  });

  it('computes absolute window ranges in local time', () => {
    const r = windowRange('2026-11-04', { start: '14:00', end: '16:00' }, s.timezone);
    expect(r.start.toUTC().toISO()).toBe('2026-11-04T19:00:00.000Z');
    expect(r.end.toUTC().toISO()).toBe('2026-11-04T21:00:00.000Z');
  });
});

describe('capacity', () => {
  it('unlimited windows are never full', () => {
    expect(windowRemaining({ capacity: null }, 999)).toBeNull();
    expect(isWindowFull({ capacity: null }, 999)).toBe(false);
  });
  it('limited windows fill up', () => {
    expect(windowRemaining({ capacity: 5 }, 3)).toBe(2);
    expect(isWindowFull({ capacity: 5 }, 4)).toBe(false);
    expect(isWindowFull({ capacity: 5 }, 5)).toBe(true);
    expect(windowRemaining({ capacity: 5 }, 7)).toBe(0);
  });
});
