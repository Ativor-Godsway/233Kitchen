import { Router } from 'express';
import { z } from 'zod';
import { ah, HttpError, parse } from '../../middleware/errors.js';
import type { AdminRequest } from '../../middleware/auth.js';
import { settingsSchema } from '../../../shared/schemas.js';
import { getSettings, saveSettings } from '../../services/settingsService.js';
import { providerStatus, sendEmail } from '../../services/emailService.js';
import { esc, heading, infoBox, layout } from '../../emails/layout.js';
import type { Settings } from '../../../shared/types.js';

export const settingsRouter = Router();

/** Provider info for the admin (never includes passwords or API keys). */
function emailInfo() {
  const s = providerStatus();
  return { emailProvider: s.provider, emailStatus: s };
}

settingsRouter.get(
  '/',
  ah(async (_req, res) => {
    res.json({ settings: await getSettings(), ...emailInfo() });
  }),
);

settingsRouter.put(
  '/',
  ah(async (req, res) => {
    const next = parse(settingsSchema, req.body) as Settings;
    next.closedDates = [...new Set(next.closedDates)].sort();
    next.pickupDays = [...new Set(next.pickupDays)].sort();
    res.json({ settings: await saveSettings(next), ...emailInfo() });
  }),
);

/**
 * Sends a test email through the REAL provider and reports the exact outcome per recipient:
 * to the logged-in admin (default, for checking email works after a deploy) or to every
 * new-order notification address. Logged in EmailLog like any other email.
 */
settingsRouter.post(
  '/test-email',
  ah(async (req: AdminRequest, res) => {
    const { target } = parse(
      z.object({ target: z.enum(['me', 'notifications']).default('me') }).strict(),
      req.body ?? {},
    );
    const s = await getSettings();
    const recipients = target === 'me' ? [req.admin!.email] : s.notificationEmails;
    if (!recipients.length)
      throw new HttpError(400, 'Add a notification email first', 'VALIDATION');
    const status = providerStatus();
    const sentAt = new Date().toLocaleString('en-US', { timeZone: s.timezone });
    const body = `${heading('Test email ✅')}
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">If you can read this, email from +233 Kitchen is working and reaches this inbox.</p>
${infoBox(`<strong>Provider:</strong> ${esc(status.label)}<br><strong>From:</strong> ${esc(status.from)}<br><strong>Sent:</strong> ${esc(sentAt)}`)}`;
    const results = await Promise.all(
      recipients.map(async (to) => {
        const r = await sendEmail({
          type: 'test',
          to,
          subject: '✅ +233 Kitchen test email',
          html: layout({ preheader: 'Email from +233 Kitchen is working.', body }),
          text: `Test email ✅\n\nIf you can read this, email from +233 Kitchen is working and reaches this inbox.\n\nProvider: ${status.label}\nFrom: ${status.from}\nSent: ${sentAt}`,
        });
        return { to, ok: r.ok, status: r.status, error: r.error ?? null };
      }),
    );
    res.json({ ...emailInfo(), results });
  }),
);
