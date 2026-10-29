export const dynamic = 'force-dynamic';

export default function MaintenancePage() {
  return <main className="pub-page-wrapper"><section className="ui-card pub-container" role="status" aria-live="polite">
    <h1>SpaCare đang bảo trì</h1>
    <p>Hệ thống tạm thời không nhận thao tác ghi dữ liệu để bảo đảm an toàn dữ liệu. Vui lòng thử lại sau khi bảo trì hoàn tất.</p>
  </section></main>;
}
