# Maintenance and write-freeze runbook

Nhánh này bổ sung chốt ứng dụng theo nguyên tắc từ chối khi cấu hình không hợp lệ. Chốt này tự nó không chứng minh Atlas không còn tiến trình ghi dữ liệu; trước khi sao lưu Production vẫn cần bằng chứng xác nhận cơ sở dữ liệu và hoạt động ghi đã yên.

## Modes

`SPACARE_WRITE_FREEZE=OFF` cho phép ghi dữ liệu một cách tường minh. `SPACARE_WRITE_FREEZE=ON` khiến các phương thức ghi trả HTTP 503 cùng `code=WRITE_FREEZE` và `Retry-After: 120`. Trong Production, cấu hình bị thiếu hoặc sai định dạng được xem là `ON`. Trong test/development, hệ thống mặc định cho phép ghi khi biến này không được đặt.

Middleware áp dụng cho các yêu cầu API `POST`, `PUT`, `PATCH` và `DELETE`. Chốt ở backend cũng bao phủ các thao tác nghiệp vụ, đặt lịch công khai, ghi phiên đăng nhập, thông báo, chạy cron, ghi ảnh sản phẩm, nhập danh mục và gửi thông báo. Trang bảo trì nằm tại `/maintenance`; khi đang đóng băng, điều hướng vận hành nên đưa người dùng tới trang này.

## Enable and drain

1. Mở phiếu thay đổi, ghi rõ người phụ trách sao lưu, người phụ trách đóng băng, khung giờ UTC, phiên bản phát hành và người phụ trách hoàn tác.
2. Đặt `SPACARE_WRITE_FREEZE=ON` nhất quán ở mọi môi trường triển khai/runtime Production, sau đó xác minh bản triển khai mới đang sử dụng giá trị đó. Không dựa vào một tiến trình serverless đang chạy sẵn.
3. Tạm dừng cron của Vercel, các tác vụ bên ngoài, nhập dữ liệu và script thủ công. Không chạy script `db:*` trên `spacare_live`.
4. Gửi yêu cầu vô hại tới từng tuyến ghi và xác minh chúng trả HTTP 503/`WRITE_FREEZE`; đồng thời xác minh endpoint đặt lịch công khai và cả hai endpoint cron cũng từ chối ghi.
5. Chờ hết thời lượng yêu cầu/giao dịch tối đa đã cấu hình, rồi dùng tài khoản chỉ đọc được phê duyệt để xác minh trạng thái yên qua chỉ số vận hành/tác vụ hiện tại của Atlas. Xác nhận không còn giao dịch hoặc thao tác ghi đang chạy và ghi lại thời điểm kiểm tra. Chỉ chặn tuyến yêu cầu là chưa đủ bằng chứng.
6. Nếu vẫn còn tiến trình ghi, tiếp tục giữ trạng thái đóng băng và đánh dấu sao lưu **BỊ CHẶN**. Không thu hồi quyền cơ sở dữ liệu của ứng dụng để thay cho việc chờ các tác vụ kết thúc có kiểm soát.

## Backup and reopen

Sau khi bằng chứng trạng thái yên được chấp nhận, thực hiện quy trình `mongodump` chỉ đọc đã được phê duyệt riêng. Atlas M0 không cung cấp bản dump oplog, vì vậy phải giữ đóng băng ghi trong suốt quá trình dump. Xác minh tính toàn vẹn của tệp lưu trữ và SHA-256 trước khi mở ghi lại.

Đặt `SPACARE_WRITE_FREEZE=OFF` qua một lần triển khai mới, xác minh cấu hình đang được phục vụ, kiểm tra một tuyến ghi thử tổng hợp được phép, rồi chỉ bật lại cron/tác vụ sau khi đã lưu trữ bằng chứng sao lưu. Nếu chưa chắc cấu hình đã được áp dụng, tiếp tục giữ đóng băng.

## Rollback and incidents

Nếu bản triển khai chốt gặp lỗi, chỉ chuyển toàn bộ lưu lượng về phiên bản tốt gần nhất sau khi xác nhận chế độ ghi và cơ sở dữ liệu đích của phiên bản đó. Nếu xác minh trạng thái yên, tệp lưu trữ hoặc mã băm thất bại, tiếp tục khóa ghi, giữ log và bằng chứng, không thử lại trên đích chưa được phê duyệt. Hoàn tác ứng dụng không chứng minh cơ sở dữ liệu đã yên; cần kiểm tra vận hành lại.

Tính năng này không cung cấp endpoint quản trị để bật/tắt, vì endpoint như vậy tự nó cũng là một bề mặt điều khiển ghi dữ liệu. Thay đổi môi trường và điều hướng lưu lượng phải theo quy trình triển khai được phê duyệt và có dấu vết kiểm toán.
