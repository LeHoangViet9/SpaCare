import Workspace from '@/components/workspace';
import { Suspense } from 'react';
export default function Home() { return <Suspense fallback={<div className="loading">Đang tải không gian làm việc.</div>}><Workspace /></Suspense>; }
