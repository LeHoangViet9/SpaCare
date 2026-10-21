import Workspace from '@/components/workspace';
import { pageKeys, canViewPage } from '@/lib/navigation';
import { actor } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { failure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export default async function WorkspacePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!pageKeys().includes(section)) notFound();
  let user;
  try { user = await actor(); } catch (error) {
    if (failure(error).status === 401) return <Workspace />;
    throw error;
  }
  if (!canViewPage(section, user)) notFound();
  return <Workspace />;
}
