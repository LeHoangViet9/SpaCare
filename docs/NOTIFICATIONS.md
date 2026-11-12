# SpaCare notifications

## Current events and recipients

| Event | Recipients | Preview |
|---|---|---|
| Online appointment | Active owner and staff in the same spa | Guest, phone, all services, Vietnam arrival date/time |
| Appointment due in ten minutes | Owners and staff for public visits; owners and assigned staff for internal visits | Customer, services and Vietnam arrival time |
| New operational invoice | Active owners | Customer, invoice contents, total, creator |
| Unclosed daily book | Active owners | Day needing review, link to daily closing |

Hộp thư hoạt động độc lập với quyền gửi thông báo đẩy của thiết bị. Cần bật thông báo đẩy riêng trên từng điện thoại/trình duyệt. Nội dung đẩy dùng văn bản sự kiện đã lưu; độ dài xem trước và cách hiển thị trên màn hình khóa còn tùy hệ điều hành. Nội dung đầy đủ vẫn nằm trong hộp thư yêu cầu đăng nhập.

## Deployment

1. Chạy `npm run push:db` trên cơ sở dữ liệu ứng dụng dự kiến (`.env.local` được script này sử dụng) để tạo collection ActivityNotification và các index. Thao tác chỉ bổ sung, không xóa lịch sử vận hành. `npm run db:setup` cũng tạo collection này.
2. Cấu hình `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` và `VAPID_SUBJECT` trong Vercel. Nếu đã có người đăng ký nhận tin, hãy giữ nguyên các khóa hiện tại.
3. Thêm `CRON_SECRET` vào môi trường production của Vercel (chuỗi bí mật ngẫu nhiên dài ít nhất 16 ký tự; script thiết lập push trên máy local sẽ tạo nếu thiếu). Không ghi giá trị này vào tài liệu, log hoặc mã nguồn.
4. Triển khai production. Lịch chạy hằng ngày trong `vercel.json` gọi `/api/notifications/daily-close` với xác thực Bearer của Vercel.
5. Bật thông báo riêng trên điện thoại của từng chủ spa/nhân viên. Trên iPhone, dùng ứng dụng web đã thêm vào Màn hình chính trên phiên bản iOS được hỗ trợ.

Lịch: `0 15 * * *` UTC tương ứng 22:00 giờ Việt Nam. Trên gói Vercel Hobby, yêu cầu có thể chạy vào bất kỳ thời điểm nào trong khoảng 22:00–22:59. Muốn chạy chính xác theo từng phút cần bộ lập lịch bên ngoài phù hợp hoặc gói trả phí. Endpoint này nhận cùng yêu cầu đã xác thực từ bộ lập lịch ngoài; tuyệt đối không đặt secret trong URL. Xem [giới hạn cron của Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Lời nhắc chỉ gửi thông báo, không tự chốt sổ ngày. Gọi lặp không tạo trùng sự kiện theo ngày/chủ spa. Ngày đã chốt sẽ được bỏ qua; lời nhắc đã xếp hàng trước khi chốt sẽ bị loại. Thông báo hóa đơn được ghi cùng giao dịch với hóa đơn và chỉ gửi sau khi giao dịch hoàn tất. Chỉ chủ spa đọc được thông báo hóa đơn và chốt sổ. Nhân viên đọc được lịch đặt công khai; các quyền ghi dữ liệu/tài chính hiện có vẫn được giữ nguyên.

## Validation boundaries

Kiểm thử tự động dùng mô hình giả lập để xác minh phạm vi người nhận, ranh giới giờ địa phương, chống trùng, hoàn tác giao dịch, mã hóa nội dung push, xác thực và loại lời nhắc đã cũ. Các kiểm thử này không chứng minh thông báo đã đến thiết bị hoặc cron production đã được cấu hình đúng. Chỉ chạy integration test trên `spacare_test`. Sau triển khai cần xác nhận thông báo thực tế trên điện thoại và bộ lập lịch đang dùng.


## Appointment reminder scheduling

Dùng bộ lập lịch bên ngoài gọi `GET /api/notifications/dispatch` mỗi phút với header `Authorization: Bearer <CRON_SECRET>`. Lưu secret trong cấu hình secret/header của bộ lập lịch, tuyệt đối không để trong URL. Thay đổi mã nguồn này không tạo tài khoản bên ngoài hay tự kích hoạt tác vụ. Vercel Hobby không hỗ trợ cron mỗi phút; `vercel.json` mặc định vẫn tương thích giới hạn chạy một lần mỗi ngày. Có thể thêm `{"path":"/api/notifications/dispatch","schedule":"* * * * *"}` vào danh sách crons nếu dùng gói Vercel phù hợp.

Khi chưa cấu hình bộ lập lịch mỗi phút, việc hộp thư trong workspace đang mở tự kiểm tra định kỳ cũng rà lời nhắc; không bảo đảm gửi nền đúng mốc trước 10 phút khi trình duyệt đã đóng. Nếu đặt lịch cách giờ đến dưới 10 phút, lời nhắc sẽ được gửi ở lần kiểm tra tiếp theo. Tin nhắn của lịch đã hủy, hoãn, hoàn thành, quá giờ hoặc đổi lịch bị loại trước khi gửi; thời hạn push kết thúc khi khách đến. Không bộ lập lịch hay mạng push nào bảo đảm độ trễ bằng 0 giây.

## Invoice codes before deployment

Chạy `npm run db:invoice-codes` trên cơ sở dữ liệu dự kiến (`.env.local` được lệnh này sử dụng). Lệnh gán mã dạng HD000001 cho hóa đơn còn thiếu mã trong giao dịch riêng theo từng spa, giữ mã đã có, khôi phục số thứ tự và tạo unique index cho mã. Lệnh không thay đổi ObjectId, tiền, thanh toán hoặc lịch sử hoa hồng. Hóa đơn mới cấp mã trong giao dịch riêng; yêu cầu thử lại dùng lại cùng hóa đơn/mã. Thay đổi mã nguồn không đồng nghĩa migration metadata này đã được áp dụng lên dữ liệu vận hành.
