import type { RequestHandler } from 'express';

/**
 * Removes keys starting with "$" or containing "." from request input, so
 * user data can never be interpreted as a MongoDB operator. (express-mongo-sanitize
 * is not compatible with current Express; this is the same idea.) Zod
 * validation on every route is the second line of defence.
 */
function clean(value: unknown, depth = 0): unknown {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor') continue;
    out[k] = clean(v, depth + 1);
  }
  return out;
}

export const sanitizeInput: RequestHandler = (req, _res, next) => {
  if (req.body) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params) as typeof req.params;
  // req.query is a getter in some setups; mutate in place.
  const q = req.query as Record<string, unknown>;
  for (const k of Object.keys(q)) {
    if (k.startsWith('$') || k.includes('.')) delete q[k];
    else if (typeof q[k] === 'object') q[k] = clean(q[k]);
  }
  next();
};
