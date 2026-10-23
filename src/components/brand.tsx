import Link from 'next/link';

export default function Brand({ href = '/', onClick }: { href?: string; onClick?: () => void }) {
  return <Link href={href} className="shared-brand" onClick={onClick} aria-label="SpaCare">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21C4 17 3 10 4 5c5 0 8 3 8 7C12 8 15 5 20 5c1 5 0 12-8 16Z" />
      <path d="M12 21V11" />
    </svg>
    <span>SpaCare</span>
  </Link>;
}
