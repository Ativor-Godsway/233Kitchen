import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { PricingError } from '../../shared/pricing.js';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Wraps async route handlers so rejections reach the error handler. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const flat = err.flatten();
    return res.status(400).json({
      error: 'Please check the highlighted fields.',
      code: 'VALIDATION',
      fieldErrors: flat.fieldErrors,
      formErrors: flat.formErrors,
    });
  }
  if (err instanceof PricingError) {
    return res.status(422).json({ error: err.message, code: err.code, slug: err.slug });
  }
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ error: err.message, code: err.code, details: err.details });
  }
  if (
    err &&
    typeof err === 'object' &&
    'type' in err &&
    (err as { type: string }).type === 'entity.parse.failed'
  ) {
    return res.status(400).json({ error: 'Invalid JSON body', code: 'BAD_JSON' });
  }
  console.error('[api] unhandled error', err);
  return res
    .status(500)
    .json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' });
}
