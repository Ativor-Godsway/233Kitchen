/**
 * Types shared by the React client and the Express API.
 * All money values are integer US cents.
 */

export type OptionGroupType = 'single' | 'multi' | 'quantity';

export interface MenuOption {
  key: string;
  name: string;
  /** Price in cents (per unit for `quantity` groups). */
  price: number;
  isAvailable: boolean;
}

export interface OptionGroup {
  key: string;
  name: string;
  type: OptionGroupType;
  required: boolean;
  /** single/multi: min/max options chosen. quantity: min total units / max units per option. */
  min: number;
  max: number;
  options: MenuOption[];
}

export type MenuCategory = 'mains' | 'desserts-drinks';

export interface MenuItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: MenuCategory;
  basePrice: number;
  /** Image URL. Local images follow `/images/<name>-960.webp` so srcsets can be derived. */
  image: string | null;
  isAvailable: boolean;
  sortOrder: number;
  optionGroups: OptionGroup[];
}

/** What the client sends for one bag line. Never contains prices. */
export interface SelectionInput {
  groupKey: string;
  optionKey: string;
  qty: number;
}

export interface LineInput {
  slug: string;
  quantity: number;
  selections: SelectionInput[];
  notes?: string;
}

export interface PricedSelection {
  groupKey: string;
  groupName: string;
  optionKey: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface PricedLine {
  menuItemId: string;
  slug: string;
  name: string;
  unitBase: number;
  selections: PricedSelection[];
  quantity: number;
  notes: string;
  /** base + all selections, for one unit */
  unitTotal: number;
  lineTotal: number;
}

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid_zelle' | 'paid_applepay' | 'paid_cash';
export type Fulfilment = 'pickup' | 'uber';

export interface TimeWindow {
  id: string;
  label: string;
  /** 24h "HH:mm" in the business timezone */
  start: string;
  end: string;
  /** Max orders for this window per pickup date. null = unlimited. */
  capacity: number | null;
}

export interface ScheduleSettings {
  timezone: string;
  /** Luxon weekdays: 1 = Monday … 7 = Sunday. Default [3] (Wednesday). */
  pickupDays: number[];
  /** Orders close this many days before the pickup date … */
  cutoffDaysBefore: number;
  /** … at this local time ("HH:mm"); the whole minute is included. */
  cutoffTime: string;
  windows: TimeWindow[];
  /** How many weeks ahead customers may book. */
  bookingWeeksAhead: number;
  /** Specific dates ("yyyy-MM-dd") with no pickup, e.g. holidays. */
  closedDates: string[];
  orderingPaused: boolean;
}

export interface SocialLinks {
  instagram: string;
  whatsapp: string;
  tiktok: string;
  facebook: string;
}

export interface Settings extends ScheduleSettings {
  pausedMessage: string;
  notificationEmails: string[];
  paymentInstructions: string;
  /** Shown on the website (street only). */
  pickupAddressPublic: string;
  /** Shared only in confirmation emails. */
  pickupAddressFull: string;
  /** Postal address line required in marketing emails (CAN-SPAM). */
  businessAddressLine: string;
  businessPhone: string;
  social: SocialLinks;
  /** Email the customer automatically on these status changes (admin can override per change). */
  notifyOnStatus: OrderStatus[];
}

/** Settings safe to expose publicly (no notification emails, no full address). */
export type PublicSettings = Omit<Settings, 'notificationEmails' | 'pickupAddressFull'>;

export interface WindowAvailability extends TimeWindow {
  remaining: number | null;
  isFull: boolean;
}

export interface PickupDateOption {
  date: string;
  label: string;
  cutoffAt: string;
  cutoffLabel: string;
  windows: WindowAvailability[];
}

export interface PublicConfig {
  settings: PublicSettings;
  pickupDates: PickupDateOption[];
  now: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  at: string;
  by: string;
  notified: boolean;
  note?: string;
}

export interface OrderDTO {
  id: string;
  number: string;
  items: PricedLine[];
  subtotal: number;
  total: number;
  customer: { name: string; phone: string; email: string };
  customerId: string | null;
  pickupDate: string;
  pickupDateLabel: string;
  pickupWindowId: string;
  pickupWindowLabel: string;
  fulfilment: Fulfilment;
  notes: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  statusHistory: StatusHistoryEntry[];
  internalNotes: string;
  marketingConsent: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Order as shown to the customer on the confirmation page. */
export interface PublicOrderDTO {
  number: string;
  items: PricedLine[];
  total: number;
  customerName: string;
  email: string;
  pickupDate: string;
  pickupDateLabel: string;
  pickupWindowLabel: string;
  fulfilment: Fulfilment;
  status: OrderStatus;
  paymentInstructions: string;
  pickupAddressPublic: string;
  businessPhone: string;
  createdAt: string;
}

export interface CustomerDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  marketingConsent: boolean;
  unsubscribedAt: string | null;
  tags: string[];
  notes: string;
  createdAt: string;
}

export type EmailType =
  | 'owner_new_order'
  | 'customer_order_received'
  | 'customer_status_update'
  | 'marketing'
  | 'direct'
  | 'test';

export interface EmailLogDTO {
  id: string;
  type: EmailType;
  to: string;
  subject: string;
  status: 'sent' | 'sent_dev' | 'failed';
  error: string | null;
  orderId: string | null;
  orderNumber: string | null;
  campaignId: string | null;
  createdAt: string;
}

export type SegmentType =
  'all_opted_in' | 'ordered_last_30' | 'lapsed_60' | 'tag' | 'selected' | 'single';

export interface CampaignDTO {
  id: string;
  subject: string;
  heading: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  segment: SegmentType;
  tag: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: 'sending' | 'sent' | 'partial' | 'failed';
  isTransactional: boolean;
  sentAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PrepItemTotal {
  slug: string;
  name: string;
  quantity: number;
  options: Array<{ group: string; name: string; count: number }>;
}

export interface PrepSheet {
  date: string;
  label: string;
  orderCount: number;
  revenue: number;
  items: PrepItemTotal[];
  windows: Array<{ id: string; label: string; count: number }>;
  fulfilment: { pickup: number; uber: number };
  orders: OrderDTO[];
}

export interface OrdersListResponse extends Paginated<OrderDTO> {
  statusCounts: Partial<Record<OrderStatus, number>>;
}

export type RangeKey = 'week' | '4w' | '3m' | 'custom';

export interface AnalyticsResult {
  range: { key: RangeKey; from: string; to: string; label: string };
  kpis: {
    orders: number;
    revenue: number;
    avgOrderValue: number;
    newCustomers: number;
    returningCustomers: number;
    pendingOrders: number;
    unpaidRevenue: number;
  };
  weekly: Array<{ date: string; label: string; orders: number; revenue: number }>;
  bestSellers: Array<{ name: string; quantity: number; revenue: number }>;
  extras: Array<{ name: string; item: string; count: number }>;
  byWindow: Array<{ label: string; orders: number }>;
  upcoming: { date: string; label: string; orders: number; revenue: number } | null;
}
