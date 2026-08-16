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

/**
 * Parse JSON từ body. Proxy/reverse proxy lỗi (502, 404…) trả HTML, và `/api`
 * rơi vào fallback SPA cũng trả `index.html` — đừng để `JSON.parse` ném ra
 * SyntaxError "Unexpected token '<'" mù mịt trong UI.
 */
function parseBody(res: Response, text: string): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    const message = isJson
      ? `server trả về JSON hỏng (${res.status})`
      : res.ok
        ? 'server trả về HTML thay vì JSON — kiểm tra cấu hình proxy /api'
        : `server trả về ${res.status} — backend đang tắt hoặc proxy lỗi`;
    throw new ApiError(res.status, message, text);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    // Cookie phiên là HttpOnly; không gửi kèm thì mọi request đều 401.
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const data = parseBody(res, text);

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
