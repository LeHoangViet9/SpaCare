import { connect } from '@/lib/db';
import { checkOrigin, maybeActor } from '@/lib/auth';
import { reservePublicBooking } from '@/lib/public-booking';
import { failure } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    await connect();
    const actor = await maybeActor();
    const result = await reservePublicBooking(body, actor, request.headers.get('Idempotency-Key') || '');
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}