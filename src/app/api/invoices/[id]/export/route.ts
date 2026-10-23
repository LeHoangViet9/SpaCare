import { actor } from '@/lib/auth';
import { invoiceExport } from '@/lib/export-read';
import { failure } from '@/lib/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await invoiceExport(await actor(), (await params).id), { headers: { 'Cache-Control': 'no-store, private' } }); }
  catch (error) { return failure(error); }
}
