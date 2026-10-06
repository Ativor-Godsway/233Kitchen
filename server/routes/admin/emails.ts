import { Router } from 'express';
import { z } from 'zod';
import { ah, HttpError, parse } from '../../middleware/errors.js';
import { EmailLogModel, toEmailLogDTO } from '../../models/EmailLog.js';
import { resendLoggedEmail } from '../../services/emailService.js';

export const emailsRouter = Router();

emailsRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(
      z.object({
        status: z.enum(['all', 'failed', 'sent', 'sent_dev']).default('all'),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(30),
      }),
      req.query,
    );
    const filter = q.status === 'all' ? {} : { status: q.status };
    const [rows, total, failed] = await Promise.all([
      EmailLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.pageSize)
        .limit(q.pageSize)
        .lean(),
      EmailLogModel.countDocuments(filter),
      EmailLogModel.countDocuments({ status: 'failed' }),
    ]);
    res.json({
      items: rows.map(toEmailLogDTO),
      total,
      page: q.page,
      pageSize: q.pageSize,
      failedCount: failed,
    });
  }),
);

emailsRouter.get(
  '/:id/preview',
  ah(async (req, res) => {
    const { id } = parse(z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }), req.params);
    const row = await EmailLogModel.findById(id).lean();
    if (!row) throw new HttpError(404, 'Email not found', 'NOT_FOUND');
    res.json({ html: row.html, text: row.text, subject: row.subject, to: row.to });
  }),
);

emailsRouter.post(
  '/:id/resend',
  ah(async (req, res) => {
    const { id } = parse(z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }), req.params);
    const result = await resendLoggedEmail(id);
    if (!result) throw new HttpError(404, 'Email not found', 'NOT_FOUND');
    const row = await EmailLogModel.findById(id).lean();
    res
      .status(result.ok ? 200 : 502)
      .json({ ok: result.ok, error: result.error, email: row ? toEmailLogDTO(row) : null });
  }),
);
