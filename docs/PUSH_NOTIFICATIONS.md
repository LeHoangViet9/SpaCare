# Thông báo đặt lịch — 23/10/2026

## Phạm vi

CONFIRMED theo yêu cầu người dùng: chủ spa nhận thông báo trên web và điện thoại khi khách đặt lịch online. Hotline công khai đổi thành **0329357116**. Chưa gửi SMS/email hoặc thông báo cho khách/nhân viên; chưa nhắc lịch tự động.

PROPOSED kỹ thuật: mỗi OWNER đang hoạt động trong spa nhận một Notification cho một lịch tạo mới. Ghi trong transaction đặt lịch trước khi lưu kết quả idempotency; không gửi ra mạng trong transaction. Retry cùng khóa trả kết quả cũ, không ghi thông báo lần hai. Không backfill lịch cũ. Chuông hiển thị 30 bản ghi gần nhất, tổng chưa đọc tính toàn bộ, có đánh dấu tất cả đã đọc.

Push gửi sau commit bằng Next.js `after`. Nội dung ngoài màn hình chỉ là “SpaCare có lịch hẹn mới”, không chứa tên/số điện thoại khách. Mở liên kết vào danh sách lịch lọc theo ID, kiểm tra phiên/quyền hiện hành. Nội dung chi tiết trong chuông chỉ OWNER cùng spa và chính người nhận được đọc. Không cache trang hoặc API trong service worker.

## Cấu hình

1. Chạy `npm run push:setup` để thêm khóa vào `.env.local` đã được gitignore. Script giữ nguyên cặp khóa hiện có và không in bí mật. Đã chạy thành công trong phiên triển khai này.
2. Trên Vercel, thêm các biến từ cấu hình local vào Environment Variables: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`. Không commit/chia sẻ nội dung khóa. VAPID_SUBJECT nên là URL HTTPS công khai của spa hoặc địa chỉ `mailto:` liên hệ hợp lệ. APP_ORIGIN phải khớp tên miền đang sử dụng.
3. Chạy `npm run push:db` với kết nối database muốn triển khai trong `.env.local`: script chỉ tạo hai collections/indexes thông báo, không seed/reset hoặc sửa dữ liệu cũ. Script chưa được chạy trong phiên này để tránh tự ghi database vận hành. Hai model cũng nằm trong `allModels` của quy trình cập nhật schema hiện tại.
4. Redeploy sau khi cấu hình. Khóa VAPID phải ổn định giữa các lần deploy; thay khóa yêu cầu thiết bị đăng ký lại.
5. Đăng nhập OWNER → chuông Thông báo → Bật thông báo trên điện thoại → Cho phép. iPhone: thêm website vào màn hình chính rồi mở từ biểu tượng đó. Website triển khai cần HTTPS; localhost dùng kiểm thử phát triển.

Tắt nhận trên thiết bị bằng nút trong chuông. Đăng xuất từ workspace hủy đăng ký thiết bị hiện tại trước khi xóa phiên; các thiết bị khác giữ nguyên. Nếu hủy đăng ký thất bại, giao diện báo lỗi để thử lại, chưa đăng xuất. Tài khoản bị khóa/đổi vai trò sẽ bị chặn gửi bởi kiểm tra OWNER/active lúc xử lý hàng đợi.

## Hàng đợi và giới hạn

PROPOSED: lease 2 phút mỗi bản ghi, tối đa 8 lần thử. Lỗi HTTP 404/410 xóa thiết bị hết hạn. Lỗi tạm thời giữ PENDING. Mỗi lượt xử lý tối đa 20 thông báo, tối đa 20 thiết bị/người, ngân sách gửi khoảng 20 giây cộng tối đa một request đang chạy 8 giây. Một request kết thúc không đảm bảo người dùng đã đọc/điện thoại đã hiện thông báo.

Gửi ngay sau đặt lịch; chuông đang mở web kiểm tra mới mỗi 30 giây và hỗ trợ đẩy lại hàng đợi. Để retry khi không ai mở web và không có lịch mới, cấu hình scheduler gọi `GET /api/notifications/dispatch` với `Authorization: Bearer <CRON_SECRET>` khoảng 2–5 phút/lần theo khả năng hosting. Chưa tự tạo scheduler trên tài khoản Vercel. Nếu không có scheduler, lần gửi lỗi chỉ được thử lại khi có yêu cầu xử lý tiếp theo. Sau 8 lần, giữ lịch sử trong chuông, cần kiểm tra cấu hình/thiết bị trước khi quyết định gửi lại.

Push có thể lặp khi máy chủ dừng giữa gửi thành công và đánh dấu SENT, hoặc một trong nhiều thiết bị bị lỗi. Service worker dùng tag ổn định theo lịch để thay thế thông báo cùng lịch. Không hứa giao hàng exactly-once. Thông báo có TTL một giờ; điện thoại tắt nguồn/mất mạng lâu có thể không nhận. Im lặng/Không làm phiền/quyền trình duyệt có thể chặn tiếng/hiển thị.

## Kiểm thử

- Model doubles: thông báo đúng OWNER/spa, nằm trong transaction, retry đặt lịch không ghi trùng.
- Giao thức: mã hóa Unicode, giải mã phía nhận, xác minh chữ ký VAPID, chặn endpoint tùy ý/redirect, loại thiết bị hết hạn, giữ retry khi lỗi 503.
- API: chưa đăng nhập trả 401, origin khác trả 403 trước ghi dữ liệu.
- Integration bổ sung kiểm tra một Notification sau retry cùng lịch; chỉ chạy với `spacare_test`.
- Cần nghiệm thu thiết bị thật sau deploy: Android/iPhone, cho phép/từ chối quyền, tắt nhận/đăng xuất, màn hình khóa, bấm mở đúng lịch, tài khoản khác spa không đọc được dữ liệu. Chưa có xác nhận giao nhận thật trong phiên này.
