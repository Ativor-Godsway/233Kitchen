/**
 * Inline-HTML email building blocks. Table-based, inline styles, 600px max —
 * renders well in Gmail, Apple Mail and Outlook.
 */
import { env } from '../env.js';
import { assetUrl } from '../../shared/assets.js';

export const C = {
  ink: '#0B0B0B',
  cream: '#FCF7F1',
  red: '#C81010',
  gold: '#E1A10C',
  green: '#1E6131',
  muted: '#6B6B6B',
  line: '#ECE6DD',
};

export function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escaped plain text → paragraphs with line breaks and auto-linked URLs. */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => {
      const html = esc(para)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${C.red};">$1</a>`)
        .replace(/\n/g, '<br>');
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.ink};">${html}</p>`;
    })
    .join('');
}

const kente = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
${[C.red, C.gold, C.green, C.ink, C.gold, C.green, C.red, C.gold].map((c) => `<td height="6" style="height:6px;background:${c};font-size:0;line-height:0;">&nbsp;</td>`).join('')}
</tr></table>`;

export function button(href: string, label: string, color = C.red): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:999px;background:${color};">
<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(label)}</a>
</td></tr></table>`;
}

export function infoBox(html: string, bg = '#F3F8F4', border = C.green): string {
  return `<div style="margin:0 0 20px;padding:16px 18px;border-radius:12px;background:${bg};border-left:4px solid ${border};font-size:15px;line-height:1.55;color:${C.ink};">${html}</div>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.2;color:${C.ink};">${esc(text)}</h1>`;
}

interface LayoutOpts {
  preheader: string;
  body: string;
  /** Footer extra (e.g. unsubscribe + postal address for marketing). */
  footer?: string;
}

export function layout({ preheader, body, footer = '' }: LayoutOpts): string {
  const logo = `${env.siteUrl}${assetUrl('/images/logo-email.png')}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>+233 Kitchen</title></head>
<body style="margin:0;padding:0;background:#F4EFE8;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE8;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td align="center" style="background:${C.ink};padding:24px;"><img src="${logo}" width="88" height="88" alt="+233 Kitchen" style="display:block;border:0;border-radius:50%;"></td></tr>
<tr><td>${kente}</td></tr>
<tr><td style="padding:32px 28px 12px;font-family:Arial,Helvetica,sans-serif;color:${C.ink};">${body}</td></tr>
<tr><td style="padding:0 28px 28px;font-size:12px;line-height:1.6;color:${C.muted};font-family:Arial,Helvetica,sans-serif;">${footer}</td></tr>
</table>
</td></tr></table></body></html>`;
}
