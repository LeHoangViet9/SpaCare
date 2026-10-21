# SpaCare — Business Requirements

Cập nhật: 20/10/2026. Phạm vi: MVP nội bộ Next.js + MongoDB.

## Nhu cầu

Spa hiện ghi thu chi bằng sổ. SpaCare tập trung lịch hẹn, khách hàng, dịch vụ, cọc, công nợ, liệu trình và đối chiếu tiền cuối ngày để giảm ghi chép rời rạc.

## Nguồn và thẩm quyền

- Tài liệu chuyển đổi hiện có: `DESIGN.md`, mục C01–C09, dẫn nguồn BRD SpaCare v1.1 ngày 19/10/2026. Bản BRD gốc không nằm trong repository; tài liệu này là bản tổng hợp, không giả nhận đã đọc lại bản gốc.
- Các câu trả lời spa đã cung cấp: cọc dư giữ lần sau; dừng liệu trình không hoàn tiền; chỉ chủ spa sửa khoản thu chi; có thể xác nhận buổi bằng hình thức khác và phải lưu lý do.
- Yêu cầu người dùng ngày 20/10/2026: kiểm tra trùng email/SĐT, thêm sửa/xóa nhân viên và dịch vụ. Thiết kế xóa mềm vChủ spa (OWNER), nhân viên (STAFF). Phân quyền truy cập xác nhận 21/10/2026: Giao diện điều hướng theo menu phân cấp; STAFF truy cập Tổng quan, Vận hành (Lịch hẹn, Khách hàng), Dịch vụ & liệu trình (Gói liệu trình, Buổi đã sử dụng), Tài chính (Hóa đơn & công nợ, Tiền cọc, Sổ thu chi), và Quản trị (Lương và Hoa hồng của chính mình). Nhân viên trực tiếp phục vụ được xác nhận tiền thực nhận và phân bổ cọc cho khách mình phụ trách. OWNER truy cập toàn bộ hệ thống (thêm Danh mục dịch vụ, Chốt sổ ngày, Thống kê dòng tiền, Danh sách nhân sự, Nhật ký thao tác, và xem Lương/Hoa hồng toàn bộ nhân sự). Quyền thu ngân riêng (cashier flag) vẫn giữ cho các hành động tài chính khác; việc nhân viên có được lập hóa đơn dịch vụ không gắn với lịch hẹn hay không vẫn chưa chốt (BR-OPEN-001).

## Phạm vi MVP

- Đăng nhập, quản lý khách, dịch vụ, nhân viên, sửa thông tin và thay đổi trạng thái.
- Đặt lịch theo nhân viên/dịch vụ, hoàn thành/hủy, kiểm tra giao nhau.
- Hóa đơn một dịch vụ, thu từng phần, công nợ, nhận và phân bổ cọc.
- Gói nhiều buổi, nhật ký từng buổi đã dùng với tham chiếu xác nhận.
- Thu/chi, đảo sai sót, mở/chốt/mở lại sổ, báo cáo dòng tiền và audit.
- Giao diện menu phân cấp, thu gọn/mở rộng nhóm, mỗi mục con mở trang riêng biệt.
- Theo dõi sản lượng phục vụ nhân sự (ca làm hoàn thành, buổi liệu trình đã ghi). Trang Lương và Hoa hồng hiển thị phân quyền (nhân viên xem của mình, chủ spa xem toàn bộ) kèm trạng thái OPEN cho các quy chế/công thức tài chính chưa chốt.

## Chưa triển khai / cần quyết định

Chưa có thanh toán tự động, xác minh chuyển khoản, chữ ký điện tử, tải tệp bằng chứng, xuất Excel, reset mật khẩu, đặt lịch công khai, ca làm/phòng/giường, workflow hoàn tiền. Chưa có: action bán gói một luồng (BR-PKG-001), kiểm tra và nhắc hạn sử dụng gói (BR-PKG-003), bảo lưu gói (BR-PKG-004), mở rộng quyền payment/allocate cho nhân viên phục vụ (BR-ACCESS-002). Các câu hỏi chưa chốt (BR-OPEN): nhân viên lập hóa đơn không gắn lịch (BR-OPEN-001), thời hạn cụ thể từng gói và tiêu chí/người duyệt bảo lưu (BR-OPEN-002), phương án thay thế khi app không khả dụng để xác nhận buổi (BR-OPEN-003), ngoại lệ hoàn tiền khi spa hủy (BR-OPEN-004), quy trình mở lại hoặc xử lý khoản ghi nhầm đã chốt sổ (BR-OPEN-005), cách ghi nhận doanh thu gói/dịch vụ (BR-OPEN-006), triệt lông tính theo buổi hay cả liệu trình (BR-OPEN-007), cách tính giá trị phần gói chưa dùng khi đổi dịch vụ (BR-OPEN-008), mốc bắt đầu tính thời hạn gói từ ngày mua hay ngày dùng đầu (BR-OPEN-009), số ngày chính xác và mốc tính thời hạn trả nợ gói (BR-OPEN-010), công thức tính hoa hồng (BR-OPEN-011), quyền quản lý xem lương/hoa hồng nhân viên khác (BR-OPEN-012), quy chế tiền lương và chu kỳ chốt lương (BR-OPEN-013). Không tự suy ra chính sách cho các mục này.

## Tiêu chí nghiệm thu

Đối chiếu ví dụ trong BUSINESS_RULES; kiểm thử quyền và transaction trên database riêng; kiểm tra giao diện tiếng Việt và mobile. Đối chiếu sổ thực tế trước khi đưa vào vận hành. Test thuần đạt không thay thế kiểm thử tích hợp hoặc nghiệm thu của chủ spa.

Tham chiếu: `API.md`, `DATA_MODEL.md`, `DESIGN.md`, `VALIDATION.md`.

Cập nhật 20/10/2026: bổ sung hoãn/dời/hủy có lý do cho tình huống khách đến sớm/muộn. Chi tiết trạng thái là thiết kế MVP trong BR-TECH-008; chưa có check-in, thời gian trễ cho phép hay phí đổi lịch.

Cập nhật 20/10/2026: ưu tiên liên kết lịch dịch vụ lẻ với hóa đơn. OWNER/thu ngân xác nhận hoàn thành và tạo/liên kết hóa đơn cùng giao dịch; thu tiền, áp cọc vẫn riêng. STAFF thường chỉ hoàn thành lịch, chờ người có quyền xử lý hóa đơn. Liên kết lịch với gói được bổ sung ở cập nhật tiếp theo bên dưới.

Cập nhật lịch gói/thanh toán: đặt lịch có thể chọn gói đúng khách/dịch vụ còn buổi; hoàn thành gói ghi xác nhận và trừ một buổi, dịch vụ lẻ tạo invoice. Hóa đơn theo dõi chưa trả/trả một phần/đã trả, nhận CASH/BANK_TRANSFER có xác nhận thực nhận. QR tài khoản là ảnh cấu hình thủ công, chưa có QR động/webhook.

Cập nhật 21/10/2026: xác nhận phân quyền giao diện STAFF (BR-ACCESS-001); nhân viên phục vụ được xác nhận tiền và phân bổ cọc (BR-ACCESS-002, chưa có code). Bán gói một luồng là nhu cầu CONFIRMED chưa có code (BR-PKG-001). Thêm chính sách: khách dùng gói trước, thanh toán 1–2 tuần (BR-PKG-002); thời hạn gói theo loại dịch vụ (BR-PKG-003); bảo lưu tùy trường hợp (BR-PKG-004); dừng gói không hoàn tiền nhưng có thể đổi sang dịch vụ tương đương (BR-TRT-002 bổ sung). Khi xếp lại lịch hoãn, xác nhận tạo lịch mới thay vì cập nhật bản ghi cũ; code hiện tại cần xét lại (BR-TECH-008). Rà soát và cập nhật trạng thái các câu hỏi mở BR-OPEN-001 đến BR-OPEN-010 theo phản hồi mới nhất của chủ spa. Triển khai menu phân cấp có thể thu gọn/mở rộng, mỗi mục con mở trang riêng biệt; trang Lương và Hoa hồng hiển thị sản lượng phục vụ thực tế và phân quyền xem dữ liệu (nhân viên xem của mình, chủ spa xem toàn bộ) kèm trạng thái OPEN cho các chính sách tài chính chưa chốt (BR-OPEN-011, BR-OPEN-012, BR-OPEN-013).� một phần/đã trả, nhận CASH/BANK_TRANSFER có xác nhận thực nhận. QR tài khoản là ảnh cấu hình thủ công, chưa có QR động/webhook.

Cập nhật 21/10/2026: xác nhận phân quyền giao diện STAFF (BR-ACCESS-001); nhân viên phục vụ được xác nhận tiền và phân bổ cọc (BR-ACCESS-002, chưa có code). Bán gói một luồng là nhu cầu CONFIRMED chưa có code (BR-PKG-001). Thêm chính sách: khách dùng gói trước, thanh toán 1–2 tuần (BR-PKG-002); thời hạn gói theo loại dịch vụ (BR-PKG-003); bảo lưu tùy trường hợp (BR-PKG-004); dừng gói không hoàn tiền nhưng có thể đổi sang dịch vụ tương đương (BR-TRT-002 bổ sung). Khi xếp lại lịch hoãn, xác nhận tạo lịch mới thay vì cập nhật bản ghi cũ; code hiện tại cần xét lại (BR-TECH-008). Rà soát và cập nhật trạng thái các câu hỏi mở BR-OPEN-001 đến BR-OPEN-010 theo phản hồi mới nhất của chủ spa: phân biệt rõ nội dung đã biết và nội dung còn mở; xác nhận buổi thực hiện trên app và không tự kết luận ảnh chụp nhóm chat là đủ (BR-OPEN-003); giữ nguyên trạng thái mở cho các nội dung chưa được chốt.


## Cập nhật ưu tiên theo yêu cầu mới nhất — 21/10/2026

Menu phân cấp có thể thu gọn/mở rộng, dùng chung cấu hình cây trên desktop và mobile. Tổng quan tại `/`; mỗi mục hoạt động mở trang riêng `/workspace/{section}`, hỗ trợ tải lại và Back/Forward. Server kiểm tra phiên và quyền: services/staff/audit chỉ OWNER, days/reports OWNER hoặc thu ngân. Không thay đổi quyền ghi tài chính hay phạm vi dữ liệu API workspace.

Yêu cầu này thay thế mô tả trước về trang Lương/Hoa hồng hiển thị sản lượng: chỉ tạo trang hoạt động khi nghiệp vụ được xác định. Hiện hai mục chỉ ghi “Chưa triển khai”, không liên kết, không có trang hoạt động, schema hoặc API lương/hoa hồng. Không tạo kỳ lương giả hay suy ra hoa hồng từ người ghi buổi. Khi triển khai: backend lấy spaId/actorId từ phiên, STAFF chỉ xem của mình, OWNER xem toàn spa. BR-OPEN-011 (công thức/thời điểm hoa hồng), BR-OPEN-012 (quyền quản lý xem nhân viên khác), BR-OPEN-013 (quy chế và kỳ lương) giữ OPEN. Cấu hình route là thiết kế kỹ thuật; không chốt thêm chính sách tài chính.


## Luồng vận hành đã triển khai — 21/10/2026
Nguồn: yêu cầu mới nhất của người dùng. Mục này thay thế các mô tả “chưa có code” trước đó cho BR-PKG-001 và BR-ACCESS-002.
- Hoãn khi chưa biết ngày mới giữ POSTPONED; khi xếp lại tạo lịch CONFIRMED mới, lịch cũ nguyên thời gian và trạng thái. Không xóa cứng.
- Bán gói một form tạo hóa đơn và liệu trình liên kết trong transaction; chọn giá toàn gói, số buổi và hạn thanh toán đã thống nhất. Có thể dùng khi còn nợ, không mặc định số ngày trả nợ. Quá hạn cảnh báo, chế tài vẫn OPEN.
- Nhân viên phục vụ thu tiền hóa đơn lịch mình và hóa đơn gói được giao; đếm tiền mặt, xác nhận thực nhận, ghi chú/tham chiếu ảnh chuyển khoản đã gửi nhóm. Nhân viên phân bổ cọc cho cùng phạm vi hóa đơn; dư giữ lần sau.
- Không triển khai đổi gói/bảo lưu hay định giá số buổi còn lại khi chưa chốt; BR-OPEN-002/008/009/010 giữ phần chưa được xác nhận.


## Xác nhận mới nhất: ký trên màn hình và bảo lưu — 21/10/2026
Nguồn: yêu cầu người dùng trong phiên sửa code. Phần này thay thế các mô tả cũ 'chưa có chữ ký/bảo lưu', dùng mã phiếu cho buổi mới và phần chưa chốt về người duyệt bảo lưu.
- Có lịch gói: nhân viên hoàn thành ca, khách ký trên màn hình; lưu thành công mới hoàn thành lịch và trừ đúng một buổi. Không có lịch: mở gói và ghi buổi sau khi khách ký, không yêu cầu tạo lịch giả.
- Chữ ký trống/hủy không làm thay đổi dữ liệu. Chữ ký gắn khách, gói, buổi, người thực hiện và thời điểm; có thể tra cứu theo quyền. Phiếu lịch sử cũ giữ nguyên, không tạo chữ ký giả.
- OWNER duyệt bảo lưu theo lý do hợp lý từng trường hợp, nhập ngày kết thúc theo từng gói; giữ nguyên số buổi. Gói đang bảo lưu không được dùng, kể cả đã hết thời gian nhập. Chỉ OWNER mở lại. Gia hạn bảo lưu và gia hạn sử dụng là hai quyết định riêng, không tự cộng ngày.
- Chưa chốt giá trị phần gói khi đổi dịch vụ, hạn gốc/mốc tính hạn theo loại gói, phương án xác nhận khi app không dùng được và các OPEN khác vẫn giữ nguyên.
