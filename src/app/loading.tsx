export default function Loading() {
  return <main className="route-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="route-loading-card">
      <strong>Đang mở trang…</strong>
      <p>Vui lòng chờ trong giây lát.</p>
      <div className="route-loading-placeholder" aria-hidden="true" />
      <div className="route-loading-placeholder short" aria-hidden="true" />
    </div>
  </main>;
}
