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

## Khắc phục lỗi và khôi phục thông báo đẩy điện thoại — 01/11/2026

### 1. Nguyên nhân đã xác minh
1. **Lỗi giải mã Base64URL VAPID Public Key trên trình duyệt (`atob`)**:
   - Khóa công khai VAPID chuẩn P-256 (uncompressed point, 65 bytes) khi mã hóa Base64URL không có padding có độ dài 87 ký tự.
   - Vì `87 % 4 = 3`, hàm `window.atob(base64)` chuẩn của trình duyệt ném ngoại lệ `DOMException: The string to be decoded is not correctly encoded`, khiến luồng `pushManager.subscribe()` bị gián đoạn hoàn toàn trên máy khách trước khi kịp lưu `PushDevice`.
   - Đã khắc phục: Thêm padding bằng ký tự `=` (`key.padEnd(key.length + (4 - key.length % 4) % 4, '=')`) trước khi chuyển đổi sang `Uint8Array`.
2. **Whitelist Gateway Push quá hẹp (`allowedPushEndpoint`)**:
   - Danh sách kiểm tra ban đầu chỉ cho phép `fcm.googleapis.com` và `updates.push.services.mozilla.com`.
   - Các thiết bị iOS (Apple Web Push qua Safari/PWA) sử dụng endpoint dạng `https://*.push.apple.com/...` (ví dụ `web.push.apple.com`, `api.push.apple.com`), và một số thiết bị Android/Chrome sử dụng gateway `https://android.googleapis.com/gcm/send/...` bị chặn bởi bộ lọc bảo mật, khiến push không thể gửi đến thiết bị di động của Apple và Android.
   - Đã khắc phục: Bổ sung `android.googleapis.com` và các subdomain của `push.apple.com` vào danh sách gateway được phép.
3. **Subscription hỏng không được giải phóng khi nhận mã lỗi 400**:
   - Khi token của thiết bị hết hạn hoặc không hợp lệ (ví dụ đổi ứng dụng hoặc thiết bị hủy đăng ký), Apple APNs và Google FCM có thể phản hồi mã `400 Bad Request` (chẳng hạn `DeviceTokenNotForTopic` hoặc `BadDeviceToken`) thay vì chỉ `410 Gone`.
   - Cơ chế cũ chỉ xóa thiết bị khi nhận 404/410, dẫn đến việc thiết bị lỗi bị giữ lại trong DB, liên tục thử lại 8 lần làm nghẽn hàng đợi push.
   - Đã khắc phục: Dọn dẹp bản ghi `PushDevice` khi gateway phản hồi mã lỗi 400.
4. **Xử lý payload trong Service Worker (`public/sw.js`)**:
   - Bổ sung fallback hiển thị text khi payload không phải định dạng JSON và cấu hình icon/badge rõ ràng để thông báo hiển thị tốt trên thanh trạng thái Android và trung tâm thông báo iOS.

### 2. Hướng dẫn kiểm tra thực tế trên điện thoại (Manual Verification)
> [!IMPORTANT]
> Do Web Push Notification phụ thuộc vào kết nối mạng bên ngoài và máy chủ Apple Push Notification Service (APNs) / Google Firebase Cloud Messaging (FCM), việc kiểm thử thực tế trên điện thoại thật bắt buộc phải có domain HTTPS công khai và cấu hình biến môi trường VAPID. Không tuyên bố thông báo đã đến điện thoại thật nếu chưa thực hiện các bước sau.

1. **Chuẩn bị cấu hình máy chủ**:
   - Khởi tạo bộ khóa VAPID qua `npm run push:setup` và cấu hình đầy đủ `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (ví dụ `mailto:admin@spacare.vn`).
   - Đảm bảo website chạy trên giao thức `https://` (trình duyệt chặn Service Worker Push trên `http://`).
2. **Đối với thiết bị iOS (iPhone / iPad - từ iOS 16.4 trở lên)**:
   - Web Push trên iOS bắt buộc ứng dụng phải được cài dưới dạng PWA (Web App).
   - Dùng trình duyệt **Safari** truy cập vào trang web spa.
   - Bấm nút **Chia sẻ** (biểu tượng mũi tên hướng lên) → Chọn **Thêm vào màn hình chính** (Add to Home Screen) → Đặt tên và xác nhận.
   - Đóng Safari, tìm biểu tượng SpaCare trên màn hình chính và mở ứng dụng.
   - Đăng nhập tài khoản OWNER → Bấm biểu tượng Chuông thông báo → Chọn **Bật thông báo trên điện thoại này**.
   - Hộp thoại hệ thống iOS xuất hiện: Chọn **Cho phép** (Allow).
3. **Đối với thiết bị Android (Google Chrome / Samsung Internet)**:
   - Mở Chrome truy cập vào trang web spa (HTTPS).
   - Đăng nhập tài khoản OWNER → Bấm biểu tượng Chuông thông báo → Chọn **Bật thông báo trên điện thoại này**.
   - Trình duyệt hiển thị popup xin quyền thông báo: Chọn **Cho phép** (Allow).
4. **Kiểm tra luồng gửi nhận**:
   - Đưa màn hình điện thoại về chế độ khóa hoặc chuyển sang ứng dụng khác.
   - Từ một thiết bị khác (hoặc tab ẩn danh), thực hiện đặt một lịch hẹn trực tuyến mới (`/booking`).
   - Quan sát màn hình khóa / Notification Center của điện thoại: Banner thông báo "SpaCare có lịch hẹn mới" phải xuất hiện kèm âm thanh/rung theo cấu hình máy.
   - Bấm vào thông báo: Ứng dụng mở đúng màn hình chi tiết lịch hẹn tại `/workspace/appointments`.
