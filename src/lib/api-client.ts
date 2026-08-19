import { config } from './config';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor({ status, detail }: { status: number; detail: string }) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

const readDetail = (body: unknown, fallback: string) => {
  if (!body || typeof body !== 'object') return fallback;
  const { detail } = body as { detail?: unknown };
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
};

type ApiClientHooks = {
  getAccessToken: ({ forceRefresh }?: { forceRefresh?: boolean }) => Promise<string | null>;
  onUnauthorized: () => void;
};

let hooks: ApiClientHooks = {
  getAccessToken: async () => null,
  onUnauthorized: () => {},
};

export const configureApiClient = (next: ApiClientHooks) => {
  hooks = next;
};

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

const parseBody = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const requestOnce = async ({
  path,
  method = 'GET',
  body,
  token,
}: {
  path: string;
  method?: ApiRequestOptions['method'];
  body?: unknown;
  token?: string | null;
}) => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

export const apiRequest = async <T>({
  path,
  method = 'GET',
  body,
  auth = true,
}: { path: string } & ApiRequestOptions): Promise<T> => {
  const token = auth ? await hooks.getAccessToken() : null;
  let response = await requestOnce({ path, method, body, token });

  if (auth && response.status === 401) {
    const refreshed = await hooks.getAccessToken({ forceRefresh: true });
    if (refreshed && refreshed !== token) {
      response = await requestOnce({ path, method, body, token: refreshed });
    }
  }

  if (response.status === 401 && auth) {
    hooks.onUnauthorized();
    throw new ApiError({ status: 401, detail: 'Session expired' });
  }

  const payload = await parseBody(response);
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      detail: readDetail(payload, response.statusText || 'Request failed'),
    });
  }

  return payload as T;
};
