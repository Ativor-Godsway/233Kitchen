import { Router } from 'express';
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
 * Sends a test email to every notification address through the REAL provider and reports
 * the exact outcome per recipient. Logged in EmailLog like any other email.
 */
settingsRouter.post(
  '/test-email',
  ah(async (req: AdminRequest, res) => {
    const s = await getSettings();
    const recipients = s.notificationEmails.length ? s.notificationEmails : [req.admin!.email];
    if (!recipients.length)
      throw new HttpError(400, 'Add a notification email first', 'VALIDATION');
    const status = providerStatus();
    const sentAt = new Date().toLocaleString('en-US', { timeZone: s.timezone });
    const body = `${heading('Test email ✅')}
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">If you can read this, new-order emails from +233 Kitchen will reach this inbox.</p>
${infoBox(`<strong>Provider:</strong> ${esc(status.label)}<br><strong>From:</strong> ${esc(status.from)}<br><strong>Sent:</strong> ${esc(sentAt)}`)}`;
    const results = await Promise.all(
      recipients.map(async (to) => {
        const r = await sendEmail({
          type: 'test',
          to,
          subject: '✅ +233 Kitchen test email',
          html: layout({ preheader: 'Your order notifications are working.', body }),
          text: `Test email ✅\n\nIf you can read this, new-order emails from +233 Kitchen will reach this inbox.\n\nProvider: ${status.label}\nFrom: ${status.from}\nSent: ${sentAt}`,
        });
        return { to, ok: r.ok, status: r.status, error: r.error ?? null };
      }),
    );
    res.json({ ...emailInfo(), results });
  }),
);
