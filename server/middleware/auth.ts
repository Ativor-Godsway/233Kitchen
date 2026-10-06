import type { CookieOptions, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { AdminUserModel } from '../models/AdminUser.js';
import { HttpError } from './errors.js';

export const AUTH_COOKIE = 'k233_admin';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface TokenPayload {
  sub: string;
  email: string;
  v: number;
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
    maxAge: MAX_AGE_MS,
  };
}

export function issueSession(
  res: Response,
  admin: { _id: unknown; email: string; tokenVersion?: number },
) {
  const token = jwt.sign(
    {
      sub: String(admin._id),
      email: admin.email,
      v: admin.tokenVersion ?? 0,
    } satisfies TokenPayload,
    env.jwtSecret,
    { expiresIn: '7d' },
  );
  res.cookie(AUTH_COOKIE, token, cookieOptions());
}

export function clearSession(res: Response) {
  const { maxAge: _maxAge, ...opts } = cookieOptions();
  res.clearCookie(AUTH_COOKIE, opts);
}

/** Verifies the JWT cookie and that the session has not been revoked by a password change. */
export async function requireAdmin(req: AdminRequest, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new HttpError(401, 'Please log in', 'UNAUTHENTICATED');
    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
    } catch {
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
    next();
  } catch (err) {
    next(err);
  }
}
