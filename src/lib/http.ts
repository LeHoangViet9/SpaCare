import { DomainError } from './rules';
import { ZodError } from 'zod';
import { DatabaseUnavailableError } from './db';

export function failure(error: unknown) {
  if (error instanceof DatabaseUnavailableError) {
    console.error('MongoDB connection failed', { code: error.code });
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

  console.error(error);
  return Response.json(
    { error: 'Không thể xử lý yêu cầu. Kiểm tra kết nối MongoDB và nhật ký máy chủ.' },
    { status: 500 },
  );
}
