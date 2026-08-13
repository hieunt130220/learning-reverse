export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

/** Đường dẫn được phép trả 401 mà không đá về /login (chính là lúc dò xem đã đăng nhập chưa). */
const SILENT_401 = new Set(['/api/auth/me']);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    // Cookie phiên là HttpOnly; không gửi kèm thì mọi request đều 401.
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (res.status === 401 && !SILENT_401.has(path)) {
    // Phiên hết hạn khi tab đang mở: đá về đăng nhập thay vì để UI trống trơn.
    if (location.pathname !== '/login') location.assign('/login');
  }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `lỗi ${res.status}`, data);
  return data as T;
}

export const apiGet = <T,>(path: string) => request<T>('GET', path);
export const apiPost = <T,>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
export const apiPut = <T,>(path: string, body: unknown) => request<T>('PUT', path, body);
export const apiPatch = <T,>(path: string, body: unknown) => request<T>('PATCH', path, body);
export const apiDelete = <T,>(path: string) => request<T>('DELETE', path);
