/** Small fetch wrapper for the JSON API. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fieldErrors?: Record<string, string[] | undefined>,
    public data?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: {
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(
      0,
      'Can’t reach the server. Check your connection and try again.',
      'NETWORK',
    );
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? `Request failed (${res.status})`,
      body?.code,
      body?.fieldErrors,
      body,
    );
  }
  return body as T;
}
