import { DomainError } from './rules';
import { ZodError } from 'zod';

export function failure(error: unknown) {
  if (error instanceof DomainError)
    return Response.json({ error: error.message }, { status: error.status });

  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') },
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
