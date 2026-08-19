interface SnakeAPIErrorContext {
  method: string;
  url: string;
  status: number;
  responseBody: unknown;
}

export class SnakeAPIError extends Error {
  public readonly context: SnakeAPIErrorContext;

  constructor(message: string, context: SnakeAPIErrorContext) {
    super(message);
    this.name = 'SnakeAPIError';
    this.context = context;
  }
}

/** Duck-typed guard — works even when module identity is stale (e.g. Vite HMR). */
export function isSnakeAPIError(error: unknown): error is SnakeAPIError {
  return (
    error !== null &&
    typeof error === 'object' &&
    (error as SnakeAPIError).name === 'SnakeAPIError' &&
    typeof (error as SnakeAPIError).context === 'object' &&
    typeof (error as SnakeAPIError).context?.status === 'number'
  );
}

/**
 * Returns true when the relay responds with Front's "No credentials exist for server" error,
 * which happens when the user has logged out and a request is made before auth state propagates.
 */
export function isFrontNoCredentialsError(error: unknown): boolean {
  if (isFrontNoCredentialsErrorBody(error)) return true;
  if (!isSnakeAPIError(error) || error.context.status !== 404) return false;
  return isFrontNoCredentialsErrorBody(error.context.responseBody);
}

function isFrontNoCredentialsErrorBody(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const body = error as Record<string, unknown>;
  return (
    body.name === 'FrontError' &&
    body.status === 'not_found' &&
    body.reason === 'No credentials exist for server'
  );
}

/** Best-effort message for SDK / relay / unknown failures shown in the UI. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (typeof error === 'string' && error.trim() !== '') {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim() !== '') {
    // SDK often wraps as "Error: <message>" — unwrap for display.
    return error.message.replace(/^(Error:\s*)+/i, '').trim();
  }

  if (error !== null && typeof error === 'object') {
    const body = error as Record<string, unknown>;
    for (const key of ['reason', 'message', 'error'] as const) {
      const value = body[key];
      if (typeof value === 'string' && value.trim() !== '') {
        return value.trim();
      }
    }
  }

  return fallback;
}
