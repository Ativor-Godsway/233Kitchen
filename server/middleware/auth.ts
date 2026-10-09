import type { CookieOptions, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { AdminUserModel } from '../models/AdminUser.js';
import { HttpError } from './errors.js';

export const AUTH_COOKIE = 'k233_admin';
/** Idle timeout: a session not used for this long expires. */
const SESSION_TTL_S = 12 * 60 * 60;
/** Active sessions get a fresh token at most this often (sliding expiry). */
const REFRESH_AFTER_S = 15 * 60;
/** Hard cap since the password was typed, however active the session is. */
const ABSOLUTE_MAX_S = 7 * 24 * 60 * 60;

interface TokenPayload {
  sub: string;
  email: string;
  /** AdminUser.tokenVersion at login; a password change bumps it and revokes the session. */
  v: number;
  /** When the admin actually logged in (seconds), kept across refreshes. */
  at: number;
  iat?: number;
}

export interface AdminRequest extends Request {
  admin?: { id: string; email: string };
}

export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_S * 1000,
  };
}

const nowS = () => Math.floor(Date.now() / 1000);

export function issueSession(
  res: Response,
  admin: { _id: unknown; email: string; tokenVersion?: number },
  authTime = nowS(),
) {
  const token = jwt.sign(
    {
      sub: String(admin._id),
      email: admin.email,
      v: admin.tokenVersion ?? 0,
      at: authTime,
    } satisfies TokenPayload,
    env.jwtSecret,
    { expiresIn: SESSION_TTL_S, algorithm: 'HS256' },
  );
  res.cookie(AUTH_COOKIE, token, cookieOptions());
}

export function clearSession(res: Response) {
  const { maxAge: _maxAge, ...opts } = cookieOptions();
  res.clearCookie(AUTH_COOKIE, opts);
}

/**
 * Verifies the JWT cookie and that the session has not been revoked by a password change, and
 * slides the expiry forward for active sessions (up to ABSOLUTE_MAX_S after login).
 */
export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (typeof token !== 'string' || !token)
      throw new HttpError(401, 'Please log in', 'UNAUTHENTICATED');
    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
    } catch {
      throw new HttpError(401, 'Session expired. Please log in again.', 'UNAUTHENTICATED');
    }
    const now = nowS();
    if (typeof payload.at !== 'number' || now - payload.at > ABSOLUTE_MAX_S) {
      throw new HttpError(401, 'Session expired. Please log in again.', 'UNAUTHENTICATED');
    }
    const admin = await AdminUserModel.findById(payload.sub).lean<{
      _id: unknown;
      email: string;
      tokenVersion?: number;
    }>();
    if (!admin || (admin.tokenVersion ?? 0) !== payload.v) {
      throw new HttpError(401, 'Session expired. Please log in again.', 'UNAUTHENTICATED');
    }
    req.admin = { id: String(admin._id), email: admin.email };
    if (now - (payload.iat ?? 0) > REFRESH_AFTER_S) issueSession(res, admin, payload.at);
    next();
  } catch (err) {
    next(err);
  }
}
