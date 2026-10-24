import { actor } from '@/lib/auth';
import { ensure } from '@/lib/rules';
import { failure } from '@/lib/http';
import { cashCardQuery, readCashCards, cashCardListQuery, readCashCardList } from '@/lib/cash-card-read';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await actor();
    ensure(['OWNER', 'STAFF'].includes(user.role), 'Không có quyền xem thẻ tiền.', 403);
    const params = new URL(request.url).searchParams;
    if(params.get('view') === 'list') return Response.json(await readCashCardList(user,cashCardListQuery.parse(Object.fromEntries(params))), {headers:{'Cache-Control':'no-store, private'}});
    const query = cashCardQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json(await readCashCards(user, query), { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { return failure(error); }
}
