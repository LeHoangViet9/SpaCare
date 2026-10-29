import { cookies } from 'next/headers';
import { checkOrigin, hash } from '@/lib/auth';
import { assertWritesAllowed } from '@/lib/write-freeze';
import { connect } from '@/lib/db';
import { Session } from '@/lib/models';
import { failure } from '@/lib/http';
export async function POST(request: Request) {
  assertWritesAllowed();
  try {
    checkOrigin(request); await connect();
    const jar = await cookies(); const token = jar.get('spacare_session')?.value;
    if (token) await Session.deleteOne({ tokenHash: hash(token) });
    jar.delete('spacare_session'); return Response.json({ ok: true });
  } catch (e) { return failure(e); }
}
