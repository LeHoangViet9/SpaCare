import { actor } from '@/lib/auth';
import { failure } from '@/lib/http';
import { ensure } from '@/lib/rules';
import { workspaceQuery } from '@/lib/workspace-query';
import { readWorkspace } from '@/lib/workspace-read';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const started = performance.now();
  try {
    const user = await actor();
    const authenticated = performance.now();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Bạn không có quyền truy cập không gian làm việc.', 403);
    const query = workspaceQuery(new URL(request.url).searchParams);
    const payload = await readWorkspace(user, query);
    const finished = performance.now();
    return Response.json(payload, { headers: {
      'Cache-Control': 'no-store',
      'Server-Timing': `auth;dur=${(authenticated - started).toFixed(1)}, data;dur=${(finished - authenticated).toFixed(1)}`,
    } });
  } catch (error) { return failure(error); }
}
