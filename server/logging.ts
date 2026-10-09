/**
 * Log redaction. Server logs (Vercel → Logs) must never contain customer PII, passwords or
 * tokens, so anything logged from an error goes through redact() first.
 */
const EMAIL = /([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const URI_CREDENTIALS = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi;
const BEARER = /\b(Bearer|token=|t=)[A-Za-z0-9._~+/=-]{8,}/gi;
const PHONE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

export function redact(text: string): string {
  return text
    .replace(URI_CREDENTIALS, '$1***:***@')
    .replace(EMAIL, '$1***@$2')
    .replace(BEARER, '$1***')
    .replace(PHONE, '***-***-****');
}

/** A one-line, redacted description of an unknown error (name, message and first stack frame). */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    const frame =
      err.stack
        ?.split('\n')
        .find((l) => l.trim().startsWith('at '))
        ?.trim() ?? '';
    return redact(`${err.name}: ${err.message}${frame ? ` (${frame})` : ''}`);
  }
  return redact(String(err));
}
