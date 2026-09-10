import { API_BASE_URL } from './config.js';

export class ApiError extends Error {
  constructor(message, status = 0, code = '', field = null) {
    super(message);
    Object.assign(this, { status, code, field });
  }
}

export function backendUrl(path) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('잘못된 요청 경로입니다.');
  return API_BASE_URL + path;
}

// Public endpoints stay usable even when member authentication is not configured.
export async function request(path, { method = 'GET', body, signal, member = false } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), 65000);
  try {
    const headers = { Accept: 'application/json' };
    if (member && method !== 'GET') {
      // Auth actions invalidate the HTTP session; obtain a fresh token for every mutation.
      const { data: csrf } = await request('/api/v1/auth/csrf', { member: true, signal: controller.signal });
      if (!csrf?.headerName || !csrf?.token) throw new ApiError('보안 토큰을 받지 못했어요. 다시 시도해 주세요.');
      headers[csrf.headerName] = csrf.token;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(backendUrl(path), {
      method, headers, signal: controller.signal, credentials: member ? 'include' : 'omit',
      cache: 'no-store', ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    let result;
    try { result = await response.json(); }
    catch { throw new ApiError('서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.', response.status); }
    if (!response.ok) {
      const error = result.error || {};
      throw new ApiError(error.message || '요청을 처리하지 못했어요.', response.status, error.code, error.field);
    }
    if (!result || !Object.hasOwn(result, 'data') || !Array.isArray(result.warnings))
      throw new ApiError('서버 응답 형식이 올바르지 않아요.', response.status);
    return result;
  } catch (error) {
    if (signal?.aborted) throw signal.reason || error;
    if (controller.signal.aborted) throw new ApiError('응답이 오래 걸리고 있어요. 다시 시도해 주세요.');
    if (error instanceof ApiError) throw error;
    throw new ApiError('서버에 연결하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
