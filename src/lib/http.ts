import { log, requestId, type LogContext } from './logger';
import { DomainError } from './rules';
import { ZodError } from 'zod';
import { DatabaseUnavailableError } from './db';

export function failure(error: unknown, context: LogContext = {}) {
  const id = context.requestId || requestId();
  const status = error instanceof DatabaseUnavailableError ? 503 : error instanceof DomainError ? error.status : error instanceof ZodError ? 400 : (error as { code?: number })?.code === 11000 ? 409 : 500;
  const code = error instanceof DatabaseUnavailableError ? error.code : error instanceof DomainError ? 'DOMAIN_REJECTED' : error instanceof ZodError ? 'VALIDATION_FAILED' : status === 409 ? 'DUPLICATE_KEY' : 'UNEXPECTED_ERROR';
  log(status >= 500 ? 'error' : 'warn', 'request.failed', { ...context, requestId: id, status, code });
  const response = failureResponse(error);
  response.headers.set('X-Request-Id', id);
  return response;
}

function failureResponse(error: unknown) {
  if (error instanceof DatabaseUnavailableError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof DomainError)
    return Response.json({ error: error.message }, { status: error.status });

  if (error instanceof ZodError)
    return Response.json(
      { error: 'Vui lòng kiểm tra các trường đã nhập.', fields: Object.fromEntries(error.issues.map(i => [i.path.join('.'), /[à-ỹÀ-Ỹ]/.test(i.message) ? i.message : 'Giá trị không hợp lệ hoặc chưa nhập đủ.'])) },
      { status: 400 },
    );

  if ((error as { code?: number })?.code === 11000)
    return Response.json(
      { error: 'Dữ liệu hoặc mã yêu cầu đã tồn tại. Tải lại và thử lại.' },
      { status: 409 },
    );


  return Response.json(
    { error: 'Không thể xử lý yêu cầu. Kiểm tra kết nối MongoDB và nhật ký máy chủ.' },
    { status: 500 },
  );
}
