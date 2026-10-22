import { actor } from '@/lib/auth';
import { failure } from '@/lib/http';
import { workspaceQuery } from '@/lib/workspace-query';
import { readWorkspace } from '@/lib/workspace-read';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await actor();
    const query = workspaceQuery(new URL(request.url).searchParams);
    return Response.json(await readWorkspace(user, query), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
