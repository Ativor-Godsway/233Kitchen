import { C, button, esc, heading, infoBox, layout, textToHtml } from './layout.js';
import { describeSelections, formatMoney } from '../../shared/pricing.js';
import { FULFILMENT_LABELS, STATUS_LABELS } from '../../shared/constants.js';
import type { OrderDTO, OrderStatus, Settings } from '../../shared/types.js';
import { env } from '../env.js';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function itemsTable(order: OrderDTO): string {
  const rows = order.items
    .map(
      (l) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:15px;vertical-align:top;">
<strong>${l.quantity}× ${esc(l.name)}</strong>
${l.selections.length ? `<br><span style="font-size:13px;color:${C.muted};">${esc(describeSelections(l.selections))}</span>` : ''}
${l.notes ? `<br><span style="font-size:13px;color:${C.muted};font-style:italic;">“${esc(l.notes)}”</span>` : ''}
</td>
<td align="right" style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:15px;vertical-align:top;white-space:nowrap;">${formatMoney(l.lineTotal)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">${rows}
<tr><td style="padding:14px 0 0;font-size:16px;"><strong>Total</strong> <span style="color:${C.muted};font-size:13px;">(pay later)</span></td>
<td align="right" style="padding:14px 0 0;font-size:20px;"><strong>${formatMoney(order.total)}</strong></td></tr></table>`;
}

function itemsText(order: OrderDTO): string {
  return order.items
    .map((l) => {
      const extra = l.selections.length ? `\n     ${describeSelections(l.selections)}` : '';
      const note = l.notes ? `\n     Note: ${l.notes}` : '';
      return `  ${l.quantity}x ${l.name} — ${formatMoney(l.lineTotal)}${extra}${note}`;
    })
    .join('\n');
}

const pickupLine = (o: OrderDTO) => `${o.pickupDateLabel}, ${o.pickupWindowLabel}`;
const tel = (phone: string) => `tel:+1${phone.replace(/\D/g, '').slice(-10)}`;

export function orderPageUrl(order: Pick<OrderDTO, 'number'>, token: string) {
  return `${env.siteUrl}/order/${encodeURIComponent(order.number)}?t=${encodeURIComponent(token)}`;
}

// ------------------------------------------------------------ owner

export function ownerNewOrderEmail(order: OrderDTO): EmailContent {
  const adminUrl = `${env.siteUrl}/admin/orders?order=${order.id}`;
  const subject = `🧾 New order ${order.number} — ${formatMoney(order.total)} — ${pickupLine(order)}`;
  const c = order.customer;
  const body = `${heading(`New order ${order.number}`)}
<p style="margin:0 0 20px;font-size:16px;color:${C.muted};">${esc(pickupLine(order))} · ${esc(FULFILMENT_LABELS[order.fulfilment])}</p>
${infoBox(
  `<strong style="font-size:17px;">${esc(c.name)}</strong><br>
<a href="${tel(c.phone)}" style="color:${C.red};font-weight:bold;text-decoration:none;">📞 ${esc(c.phone)}</a><br>
<a href="mailto:${esc(c.email)}" style="color:${C.ink};">${esc(c.email)}</a>`,
  '#FBF6EC',
  C.gold,
)}
${itemsTable(order)}
${order.notes ? infoBox(`<strong>Order notes:</strong><br>${esc(order.notes).replace(/\n/g, '<br>')}`, '#FDF0F0', C.red) : ''}
${button(adminUrl, 'Open in admin', C.ink)}`;
  const text = `New order ${order.number}
${pickupLine(order)} · ${FULFILMENT_LABELS[order.fulfilment]}

Customer: ${c.name}
Phone: ${c.phone}
Email: ${c.email}

Items:
${itemsText(order)}

Total: ${formatMoney(order.total)} (unpaid)
${order.notes ? `\nNotes: ${order.notes}\n` : ''}
Open in admin: ${adminUrl}`;
  return {
    subject,
    html: layout({
      preheader: `${c.name} · ${formatMoney(order.total)} · ${pickupLine(order)}`,
      body,
    }),
    text,
  };
}

// ------------------------------------------------------------ customer

function contactFooter(s: Settings) {
  return `Questions? Call or text <a href="${tel(s.businessPhone)}" style="color:${C.muted};">${esc(s.businessPhone)}</a>.<br>+233 Kitchen · Worcester, MA`;
}

export function customerOrderReceivedEmail(
  order: OrderDTO,
  s: Settings,
  token: string,
): EmailContent {
  const first = order.customer.name.split(' ')[0];
  const subject = `We got your order ${order.number} — pickup ${pickupLine(order)}`;
  const body = `${heading(`Thank you, ${first}!`)}
<p style="margin:0 0 20px;font-size:16px;line-height:1.6;">We’ve received your pre-order <strong>${esc(order.number)}</strong>. We’ll confirm it shortly. Here are the details:</p>
${infoBox(
  `<strong>Pickup:</strong> ${esc(pickupLine(order))}<br>
<strong>Where:</strong> ${esc(s.pickupAddressFull)}<br>
<strong>How:</strong> ${esc(FULFILMENT_LABELS[order.fulfilment])}`,
  '#FBF6EC',
  C.gold,
)}
${itemsTable(order)}
${infoBox(`<strong>Payment</strong><br>${esc(s.paymentInstructions)}`)}
${button(orderPageUrl(order, token), 'View your order')}`;
  const text = `Thank you, ${first}!

We've received your pre-order ${order.number}. We'll confirm it shortly.

Pickup: ${pickupLine(order)}
Where: ${s.pickupAddressFull}
How: ${FULFILMENT_LABELS[order.fulfilment]}

Your order:
${itemsText(order)}

Total: ${formatMoney(order.total)} (pay later)

Payment: ${s.paymentInstructions}

View your order: ${orderPageUrl(order, token)}

Questions? Call or text ${s.businessPhone}.`;
  return {
    subject,
    html: layout({
      preheader: `Pickup ${pickupLine(order)} · ${formatMoney(order.total)}`,
      body,
      footer: contactFooter(s),
    }),
    text,
  };
}

const STATUS_COPY: Partial<Record<OrderStatus, { subject: string; title: string; line: string }>> =
  {
    confirmed: {
      subject: 'Your order is confirmed',
      title: 'Your order is confirmed ✅',
      line: 'great news! We’ve confirmed your order and it’s on our cooking list.',
    },
    preparing: {
      subject: 'We’re cooking your order',
      title: 'We’re cooking your order 🔥',
      line: 'your food is being prepared fresh right now.',
    },
    ready: {
      subject: 'Your order is ready for pickup',
      title: 'Your order is ready for pickup 🎉',
      line: 'your box is packed and ready. See you soon!',
    },
    completed: {
      subject: 'Thank you for ordering',
      title: 'Thank you for ordering!',
      line: 'we hope you enjoyed it. We’d love to cook for you again.',
    },
    cancelled: {
      subject: 'Your order has been cancelled',
      title: 'Your order has been cancelled',
      line: 'your order has been cancelled. If this is unexpected, please give us a call.',
    },
  };

export function customerStatusEmail(
  order: OrderDTO,
  s: Settings,
  token: string,
  note?: string,
): EmailContent {
  const label = STATUS_LABELS[order.status];
  const copy = STATUS_COPY[order.status] ?? {
    subject: `Order update: ${label}`,
    title: `Order update: ${label}`,
    line: '',
  };
  const subject = `${copy.subject} — ${order.number}`;
  const showPickup = ['new', 'confirmed', 'preparing', 'ready'].includes(order.status);
  const showPayment = showPickup && order.paymentStatus === 'unpaid';
  const body = `${heading(copy.title)}
<p style="margin:0 0 20px;font-size:16px;line-height:1.6;">Hi ${esc(order.customer.name.split(' ')[0])}, ${esc(copy.line)}</p>
${note ? infoBox(esc(note).replace(/\n/g, '<br>'), '#FBF6EC', C.gold) : ''}
${showPickup ? infoBox(`<strong>Order ${esc(order.number)}</strong><br><strong>Pickup:</strong> ${esc(pickupLine(order))}<br><strong>Where:</strong> ${esc(s.pickupAddressFull)}`, '#FBF6EC', C.gold) : ''}
${showPayment ? infoBox(`<strong>Payment</strong><br>${esc(s.paymentInstructions)}`) : ''}
${button(orderPageUrl(order, token), 'View your order')}`;
  const text = `${copy.title}

Hi ${order.customer.name.split(' ')[0]}, ${copy.line}
${note ? `\n${note}\n` : ''}
Order ${order.number}${showPickup ? `\nPickup: ${pickupLine(order)}\nWhere: ${s.pickupAddressFull}` : ''}
${showPayment ? `\nPayment: ${s.paymentInstructions}\n` : ''}
View your order: ${orderPageUrl(order, token)}

Questions? Call or text ${s.businessPhone}.`;
  return { subject, html: layout({ preheader: copy.line, body, footer: contactFooter(s) }), text };
}

// ------------------------------------------------------------ marketing & direct

export interface MessageInput {
  subject: string;
  heading: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
}

export function unsubscribeUrl(token: string) {
  return `${env.siteUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Marketing (bulk) or direct (one-to-one) message. Marketing always includes
 * the unsubscribe link and postal address line (CAN-SPAM).
 */
export function messageEmail(
  m: MessageInput,
  s: Settings,
  opts: { firstName?: string; unsubscribeToken?: string; marketing: boolean },
): EmailContent {
  const greeting = opts.firstName
    ? `<p style="margin:0 0 16px;font-size:16px;">Hi ${esc(opts.firstName)},</p>`
    : '';
  const img = m.imageUrl
    ? `<img src="${esc(m.imageUrl)}" width="544" alt="" style="display:block;width:100%;max-width:544px;height:auto;border-radius:12px;margin:0 0 20px;">`
    : '';
  const cta = m.ctaLabel && m.ctaUrl ? button(m.ctaUrl, m.ctaLabel) : '';
  const body = `${m.heading ? heading(m.heading) : ''}${img}${greeting}${textToHtml(m.body)}${cta}`;
  const unsub = opts.unsubscribeToken
    ? unsubscribeUrl(opts.unsubscribeToken)
    : `${env.siteUrl}/unsubscribe`;
  const footer = opts.marketing
    ? `You’re receiving this because you opted in to +233 Kitchen emails when ordering.<br>
<a href="${esc(unsub)}" style="color:${C.muted};">Unsubscribe</a> · ${esc(s.businessAddressLine)}`
    : contactFooter(s);
  const text = `${m.heading ? `${m.heading}\n\n` : ''}${opts.firstName ? `Hi ${opts.firstName},\n\n` : ''}${m.body}
${m.ctaLabel && m.ctaUrl ? `\n${m.ctaLabel}: ${m.ctaUrl}\n` : ''}
—
${opts.marketing ? `Unsubscribe: ${unsub}\n${s.businessAddressLine}` : `+233 Kitchen · ${s.businessPhone}`}`;
  return {
    subject: m.subject,
    html: layout({ preheader: m.heading || m.subject, body, footer }),
    text,
  };
}
