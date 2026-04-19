/**
 * Metis.AI API Client
 * Wraps fetch with auth headers, error handling, and base URL.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

interface ApiError {
  statusCode: number;
  message: string;
  correlationId?: string;
}

class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function isBrowser(): boolean {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis;
}

function getToken(): string | null {
  if (!isBrowser()) return null;
  return globalThis.localStorage.getItem('metis_access_token');
}

/** Read CSRF token from cookie (set by backend) */
function getCsrfToken(): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie.match(/(?:^|;\s*)metis_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setToken(token: string): void {
  if (isBrowser()) {
    globalThis.localStorage.setItem('metis_access_token', token);
  }
}

export function clearToken(): void {
  if (isBrowser()) {
    globalThis.localStorage.removeItem('metis_access_token');
    globalThis.localStorage.removeItem('metis_refresh_token');
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Attach CSRF token for state-changing requests
  if (csrfToken && options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (networkError) {
    // Network error — backend is not reachable
    // Throw a typed error so callers can distinguish this from HTTP errors
    throw new ApiClientError(
      0,
      `API 서버에 연결할 수 없습니다 (${API_BASE}). 백엔드 서버가 실행 중인지 확인하세요.`,
    );
  }

  if (!response.ok) {
    let error: ApiError;
    try {
      error = (await response.json()) as ApiError;
    } catch {
      error = {
        statusCode: response.status,
        message: response.statusText,
      };
    }

    // Auto-redirect on 401
    if (response.status === 401 && isBrowser()) {
      clearToken();
      (globalThis as any).location.href = '/login';
    }

    throw new ApiClientError(
      error.statusCode,
      error.message,
      error.correlationId,
    );
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
