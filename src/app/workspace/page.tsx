import Workspace from '@/components/workspace';
import { actor } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function WorkspaceRootPage() {
  let user;
  try {
    user = await actor();
  } catch {
    redirect('/login?returnTo=/workspace');
  }

  if (user.role === 'CUSTOMER') {
    redirect('/customer');
  }

  return (
    <Suspense fallback={<div className="loading">Đang tải không gian làm việc…</div>}>
      <Workspace />
    </Suspense>
  );
}
