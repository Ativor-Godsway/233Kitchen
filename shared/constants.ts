import type { Fulfilment, OrderStatus, PaymentStatus, Settings } from './types.js';

export const ORDER_STATUSES: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** The normal forward flow. Cancelled can be reached from any non-completed state. */
export const STATUS_FLOW: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'completed'];

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'unpaid',
  'paid_zelle',
  'paid_applepay',
  'paid_cash',
];

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid_zelle: 'Paid (Zelle)',
  paid_applepay: 'Paid (Apple Pay)',
  paid_cash: 'Paid (Cash)',
};

export const FULFILMENT_LABELS: Record<Fulfilment, string> = {
  pickup: 'I’ll pick up',
  uber: 'I’ll send an Uber courier',
};

/** Exact pickup address, shown on the website, in emails and in the calendar invite. */
export const PICKUP_ADDRESS = '25 Hollywood St, Worcester, MA 01610';

export const DEFAULT_SETTINGS: Settings = {
  timezone: 'America/New_York',
  pickupDays: [3],
  cutoffDaysBefore: 2,
  cutoffTime: '23:59',
  windows: [
    { id: 'w12', label: '12–2 PM', start: '12:00', end: '14:00', capacity: null },
    { id: 'w14', label: '2–4 PM', start: '14:00', end: '16:00', capacity: null },
    { id: 'w16', label: '4–6 PM', start: '16:00', end: '18:00', capacity: null },
    { id: 'w18', label: '6–8 PM', start: '18:00', end: '20:00', capacity: null },
  ],
  bookingWeeksAhead: 3,
  closedDates: [],
  orderingPaused: false,
  pausedMessage:
    'We’re taking a short break this week. Pre-orders reopen soon. Thank you for your patience!',
  notificationEmails: [],
  paymentInstructions:
    'No payment now. Once we confirm your order, pay via Zelle (amankwaherica98@gmail.com) or Apple Pay (508-353-8191), or pay at pickup.',
  pickupAddressPublic: PICKUP_ADDRESS,
  mapQuery: PICKUP_ADDRESS,
  pickupAddressFull: PICKUP_ADDRESS,
  businessAddressLine: `+233 Kitchen · ${PICKUP_ADDRESS}`,
  businessPhone: '(508) 353-8191',
  social: { instagram: '', whatsapp: '', tiktok: '', facebook: '' },
  notifyOnStatus: ['confirmed', 'ready', 'cancelled'],
};

export const BUSINESS_NAME = '+233 Kitchen';
