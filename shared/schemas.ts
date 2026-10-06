import { z } from 'zod';
import { ORDER_STATUSES, PAYMENT_STATUSES } from './constants.js';
import { MAX_LINE_QUANTITY, MAX_NOTES_LENGTH } from './pricing.js';

/** Normalises a US phone number to "(508) 353-8191", or returns null. */
export function normalizeUsPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10 || /^[01]/.test(d)) return null;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
const key = z.string().trim().min(1).max(60);

export const selectionSchema = z.object({
  groupKey: key,
  optionKey: key,
  qty: z.number().int().min(0).max(20),
});

export const lineInputSchema = z.object({
  slug: key,
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  selections: z.array(selectionSchema).max(30).default([]),
  notes: z.string().max(MAX_NOTES_LENGTH).optional().default(''),
});

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => normalizeUsPhone(v) !== null, 'Enter a valid US phone number');

/** Customer-facing checkout form (shared by RHF on the client and the API). */
export const checkoutSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(80),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(120),
  pickupDate: dateStr,
  pickupWindowId: z.string().min(1, 'Choose a pickup time'),
  fulfilment: z.enum(['pickup', 'uber']),
  notes: z.string().trim().max(500).optional().default(''),
  marketingConsent: z.boolean().default(false),
  /** Honeypot — must stay empty. */
  website: z.string().max(0).optional().default(''),
});
export type CheckoutForm = z.input<typeof checkoutSchema>;

export const createOrderSchema = checkoutSchema.extend({
  items: z.array(lineInputSchema).min(1, 'Your bag is empty').max(30),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ---------------------------------------------------------------- admin

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, 'Use at least 10 characters').max(200),
});

export const orderUpdateSchema = z
  .object({
    status: z.enum(ORDER_STATUSES as [string, ...string[]]).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES as [string, ...string[]]).optional(),
    internalNotes: z.string().max(5000).optional(),
    notifyCustomer: z.boolean().optional(),
    statusNote: z.string().max(500).optional(),
  })
  .strict();

const optionSchema = z.object({
  key: key.regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes'),
  name: z.string().trim().min(1).max(80),
  price: z.number().int().min(0).max(100_000),
  isAvailable: z.boolean(),
});

const optionGroupSchema = z
  .object({
    key: key.regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(1).max(60),
    type: z.enum(['single', 'multi', 'quantity']),
    required: z.boolean(),
    min: z.number().int().min(0).max(20),
    max: z.number().int().min(1).max(20),
    options: z.array(optionSchema).min(1).max(30),
  })
  .refine((g) => g.min <= g.max || g.type === 'quantity', 'min must be ≤ max')
  .refine(
    (g) => new Set(g.options.map((o) => o.key)).size === g.options.length,
    'Option keys must be unique',
  );

export const menuItemSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: key.regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(600),
  category: z.enum(['mains', 'desserts-drinks']),
  basePrice: z.number().int().min(0).max(100_000),
  image: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === '' || v.startsWith('/') || /^https:\/\//.test(v),
      'Use an https:// URL or /images/… path',
    )
    .nullable(),
  isAvailable: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
  optionGroups: z
    .array(optionGroupSchema)
    .max(10)
    .refine((gs) => new Set(gs.map((g) => g.key)).size === gs.length, 'Group keys must be unique'),
});
export type MenuItemInput = z.infer<typeof menuItemSchema>;

export const menuAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
  groupKey: z.string().optional(),
  optionKey: z.string().optional(),
});

const windowSchema = z
  .object({
    id: z.string().trim().min(1).max(20),
    label: z.string().trim().min(1).max(40),
    start: hm,
    end: hm,
    capacity: z.number().int().min(1).max(1000).nullable(),
  })
  .refine((w) => w.start < w.end, 'Window must end after it starts');

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https:\/\//.test(v), 'Use an https:// link');

export const settingsSchema = z.object({
  timezone: z.string().min(1).max(60),
  pickupDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  cutoffDaysBefore: z.number().int().min(0).max(14),
  cutoffTime: hm,
  windows: z
    .array(windowSchema)
    .min(1)
    .max(12)
    .refine((ws) => new Set(ws.map((w) => w.id)).size === ws.length, 'Window ids must be unique'),
  bookingWeeksAhead: z.number().int().min(1).max(8),
  closedDates: z.array(dateStr).max(100),
  orderingPaused: z.boolean(),
  pausedMessage: z.string().trim().max(300),
  notificationEmails: z.array(z.string().trim().toLowerCase().email()).max(10),
  paymentInstructions: z.string().trim().min(1).max(600),
  pickupAddressPublic: z.string().trim().min(1).max(200),
  pickupAddressFull: z.string().trim().min(1).max(300),
  businessAddressLine: z.string().trim().min(1).max(200),
  businessPhone: z.string().trim().min(7).max(30),
  social: z.object({
    instagram: optionalUrl,
    whatsapp: optionalUrl,
    tiktok: optionalUrl,
    facebook: optionalUrl,
  }),
  notifyOnStatus: z.array(z.enum(ORDER_STATUSES as [string, ...string[]])),
});

export const customerUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().max(30).optional(),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20).optional(),
    notes: z.string().max(5000).optional(),
    marketingConsent: z.boolean().optional(),
  })
  .strict();

export const campaignSchema = z.object({
  subject: z.string().trim().min(1).max(150),
  heading: z.string().trim().max(150).default(''),
  body: z.string().trim().min(1).max(10_000),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https:\/\//.test(v), 'Use an https:// image URL')
    .default(''),
  ctaLabel: z.string().trim().max(40).default(''),
  ctaUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\//.test(v), 'Use a full URL')
    .default(''),
  segment: z.enum(['all_opted_in', 'ordered_last_30', 'lapsed_60', 'tag', 'selected', 'single']),
  tag: z.string().trim().max(30).default(''),
  customerIds: z
    .array(z.string().regex(/^[a-f0-9]{24}$/))
    .max(5000)
    .default([]),
});
export type CampaignInput = z.infer<typeof campaignSchema>;
