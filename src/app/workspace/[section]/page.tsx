import Workspace from '@/components/workspace';
import { pageKeys, canViewPage } from '@/lib/navigation';
import { actor } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!pageKeys().includes(section)) notFound();
  let user;
  try {
    user = await actor();
  } catch {
    redirect(`/login?returnTo=/workspace/${section}`);
  }
  if (user.role === 'CUSTOMER') {
    redirect('/customer');
  }
  if (!canViewPage(section, user)) notFound();
  return <Workspace />;
}
