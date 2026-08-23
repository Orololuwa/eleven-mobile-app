import { config } from './config';

export class ApiError extends Error {
  status: number;
  detail: string;
  fieldErrors: Record<string, string>;

  constructor({
    status,
    detail,
    fieldErrors = {},
  }: {
    status: number;
    detail: string;
    fieldErrors?: Record<string, string>;
  }) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
  }
}

type FastApiIssue = {
  loc?: Array<string | number>;
  msg?: string;
};

const isIssue = (value: unknown): value is FastApiIssue =>
  Boolean(value && typeof value === 'object' && 'msg' in value);

const locToField = (loc: Array<string | number> = []) => {
  const parts = loc.filter((part) => part !== 'body' && part !== 'query' && part !== 'path');
  const field = [...parts].reverse().find((part) => typeof part === 'string');
  return typeof field === 'string' ? field : undefined;
};

const fieldLabel = (field: string) =>
  field.replaceAll('_', ' ').replace(/^\w/, (char) => char.toUpperCase());

const humanizeMsg = (msg: string) => {
  const stripped = msg
    .replace(/^Value error,?\s*/i, '')
    .replace(/^Input should be a valid date or datetime,\s*/i, '')
    .replace(/^Input should be\s*/i, '');
  if (!stripped) return msg;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
};

const parseErrorBody = (body: unknown, fallback: string) => {
  if (!body || typeof body !== 'object') {
    return { detail: fallback, fieldErrors: {} as Record<string, string> };
  }

  const { detail } = body as { detail?: unknown };
  if (typeof detail === 'string' && detail.trim()) {
    return { detail: detail.trim(), fieldErrors: {} as Record<string, string> };
  }

  if (!Array.isArray(detail)) {
    return { detail: fallback, fieldErrors: {} as Record<string, string> };
  }

  const issues = detail.filter(isIssue).flatMap((issue) => {
    if (!issue.msg) return [];
    const field = locToField(issue.loc);
    const message = humanizeMsg(issue.msg);
    return [{ field, message, summary: field ? `${fieldLabel(field)}: ${message}` : message }];
  });

  if (issues.length === 0) {
    return { detail: fallback, fieldErrors: {} as Record<string, string> };
  }

  const fieldErrors = Object.fromEntries(
    issues.flatMap(({ field, message }) => (field ? [[field, message]] : [])),
  );

  return {
    detail: issues.map((issue) => issue.summary).join(' · '),
    fieldErrors,
  };
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
      ...parseErrorBody(payload, response.statusText || 'Request failed'),
    });
  }

  return payload as T;
};
