import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { ah, HttpError, parse } from '../../middleware/errors.js';
import { loginAccountLimiter, loginLimiter } from '../../middleware/rateLimit.js';
import {
  clearSession,
  issueSession,
  requireAdmin,
  type AdminRequest,
} from '../../middleware/auth.js';
import { AdminUserModel } from '../../models/AdminUser.js';
import { changePasswordSchema, loginSchema } from '../../../shared/schemas.js';

export const authRouter = Router();

// Constant-time-ish failure path even when the user does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-the-password', 10);

authRouter.post(
  '/login',
  loginLimiter,
  loginAccountLimiter,
  ah(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const admin = await AdminUserModel.findOne({ email }).setOptions({ sanitizeFilter: true });
    const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !ok) throw new HttpError(401, 'Incorrect email or password', 'BAD_CREDENTIALS');
    admin.set({ lastLoginAt: new Date() });
    await admin.save();
    issueSession(res, admin);
    res.json({ admin: { email: admin.email } });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

/** Current session, or { admin: null } when signed out (not an error for the login screen). */
authRouter.get('/me', (req: AdminRequest, res, next) => {
  requireAdmin(req, res, (err?: unknown) => {
    if (err) {
      if (err instanceof HttpError && err.status === 401) return res.json({ admin: null });
      return next(err);
    }
    res.json({ admin: { email: req.admin!.email } });
  });
});

authRouter.post(
  '/password',
  requireAdmin,
  loginLimiter,
  ah(async (req: AdminRequest, res) => {
    const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
    const admin = await AdminUserModel.findById(req.admin!.id);
    if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      throw new HttpError(400, 'Current password is incorrect', 'BAD_CREDENTIALS');
    }
    admin.set({
      passwordHash: await bcrypt.hash(newPassword, 12),
      tokenVersion: (admin.tokenVersion ?? 0) + 1,
    });
    await admin.save();
    // Other sessions are revoked by the version bump; keep this one signed in.
    issueSession(res, admin);
    res.json({ ok: true });
  }),
);
