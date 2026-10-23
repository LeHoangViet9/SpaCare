# SpaCare — Business Rules

Cập nhật: 21/10/2026.

- CONFIRMED: có xác nhận nghiệp vụ hoặc yêu cầu rõ từ người dùng; ghi nguồn tại từng rule.
- PROPOSED: thiết kế đề xuất, có thể đã được triển khai nhưng chưa được spa duyệt.
- OPEN: chưa chốt; không tự đưa thành hành vi mới.

## Quy tắc đã xác nhận

### BR-DEP-001 — Không tự hoàn cọc thông thường
Trạng thái: CONFIRMED. Nguồn: DESIGN C02.
Không hoàn cọc thông thường; có thể chuyển dịch vụ khi hợp lý. Tiêu chí hợp lý và ngoại lệ còn mở.
Ví dụ kiểm tra: hủy lịch không tự sinh giao dịch hoàn tiền.

### BR-DEP-003 — Giữ lại cọc dư
Trạng thái: CONFIRMED. Nguồn: câu trả lời bổ sung của spa; DESIGN C03.
Chỉ trừ tiền thực tế phân bổ; dư giữ lần sau. Phân bổ không phải khoản thu mới.
Ví dụ kiểm tra: cọc 500.000đ áp 350.000đ còn 150.000đ; thực thu vẫn 500.000đ.

### BR-DEBT-001 — Theo dõi nợ và trả sau
Trạng thái: CONFIRMED. Nguồn: DESIGN C06.
Khách có thể nợ và trả sau; công nợ bằng tổng hóa đơn trừ số đã thanh toán, gồm cọc đã phân bổ.
Ví dụ kiểm tra: hóa đơn 2.000.000đ, áp cọc 500.000đ, trả thêm 1.000.000đ còn nợ 500.000đ.

### BR-TRT-001 — Ghi xác nhận từng buổi
Trạng thái: CONFIRMED. Nguồn: DESIGN C04/C08 và spa xác nhận bổ sung; spa xác nhận 21/10/2026.
Mỗi buổi có xác nhận: nhân viên cho khách xác nhận buổi liệu trình trên app. Khi không thể xác nhận trên app, phương án thay thế còn mở (BR-OPEN-003); chưa được tự kết luận ảnh chụp gửi nhóm chat là đủ. Khi áp dụng hình thức thay thế được cho phép, phải lưu rõ lý do.
Ví dụ kiểm tra: xác nhận thay thế thiếu lý do bị từ chối; không trừ buổi.

### BR-TRT-002 — Dừng liệu trình không hoàn tiền; có thể đổi dịch vụ
Trạng thái: CONFIRMED. Nguồn: spa xác nhận bổ sung; DESIGN C05; spa xác nhận 21/10/2026.
Khách dừng gói không được hoàn tiền theo chính sách thông thường. Có thể chuyển giá trị phần chưa dùng sang dịch vụ có giá trị tương đương khi spa chấp nhận. Cách tính giá trị phần còn lại, tiêu chí chấp nhận và quyền duyệt đổi dịch vụ còn mở (BR-OPEN-008).
Ví dụ kiểm tra: gói 10 buổi đã dùng 3 không tự sinh hoàn tiền hoặc tự xóa 7 buổi còn lại.

### BR-CASH-001 — Chỉ chủ spa sửa khoản đã ghi
Trạng thái: CONFIRMED. Nguồn: spa xác nhận bổ sung; DESIGN C07; spa xác nhận 21/10/2026.
Chỉ chủ spa có quyền chỉnh sửa khoản thu chi đã ghi. Quy trình mở lại hoặc xử lý khoản ghi nhầm đã chốt sổ còn mở (BR-OPEN-005). Cơ chế đảo sai sót là đề xuất kỹ thuật riêng.
Ví dụ kiểm tra: STAFF có quyền thu ngân vẫn không được gọi reverseCash/reverseAllocation.

### BR-IDENT-001 — Kiểm tra trùng email và số điện thoại
Trạng thái: CONFIRMED. Nguồn: yêu cầu người dùng 20/10/2026.
Thêm/sửa phải kiểm tra trùng tại backend, loại bản ghi đang sửa khỏi phép kiểm tra. Phạm vi chuẩn hóa là thiết kế bên dưới.
Ví dụ kiểm tra: sửa khách nhưng giữ số của chính khách được phép; dùng số của khách khác bị từ chối.

### BR-CATALOG-001 — Có thao tác sửa/xóa danh mục và nhân viên
Trạng thái: CONFIRMED. Nguồn: yêu cầu người dùng 20/10/2026.
Cần quản lý sửa/xóa nhân viên, dịch vụ. Cơ chế ngừng hoạt động thay xóa cứng là đề xuất MVP, không coi là chính sách spa đã xác nhận.
Ví dụ kiểm tra: chủ spa mở được form sửa dịch vụ; lưu thay đổi và tải lại thấy giá mới.

### BR-ACCESS-001 — Phân quyền truy cập giao diện & menu phân cấp
Trạng thái: CONFIRMED. Nguồn: spa xác nhận 21/10/2026.
Giao diện tổ chức theo menu phân cấp gọn gàng, có thể thu gọn/mở rộng; mỗi mục con mở trang riêng:
- **Tổng quan**: Tất cả nhân sự.
- **Vận hành**: Lịch hẹn, Khách hàng (Tất cả nhân sự).
- **Dịch vụ & liệu trình**: Danh mục dịch vụ (OWNER), Gói liệu trình (Tất cả nhân sự), Buổi đã sử dụng (Tất cả nhân sự).
- **Tài chính**: Hóa đơn & công nợ, Tiền cọc, Sổ thu chi (Tất cả nhân sự); Chốt sổ ngày, Thống kê dòng tiền (OWNER / Thu ngân).
- **Quản trị**:
  - Nhân viên:
    - Danh sách nhân viên: OWNER.
    - Lương: Nhân viên chỉ xem thông tin của mình; chủ spa xem toàn bộ; quyền của quản lý xem nhân viên khác còn mở (BR-OPEN-012).
    - Hoa hồng: Nhân viên chỉ xem sản lượng/ca của mình; chủ spa xem toàn bộ; công thức tính hoa hồng còn mở (BR-OPEN-011).
  - Nhật ký thao tác: OWNER.

Chỉ chủ spa sửa giao dịch đã ghi (BR-CASH-001 giữ nguyên). Phạm vi quyền ghi cụ thể bên trong từng tab dành cho STAFF là thiết kế đề xuất chờ triển khai.
Ví dụ kiểm tra: STAFF đăng nhập thấy menu phân cấp; vào Lương/Hoa hồng chỉ thấy dữ liệu cá nhân; không xem được Danh sách nhân viên hay Nhật ký thao tác.

### BR-ACCESS-002 — Nhân viên phục vụ xác nhận tiền và phân bổ cọc
Trạng thái: CONFIRMED về chính sách, nguồn: người dùng 21/10/2026. Đã triển khai payment/allocate.
Nhân viên phục vụ được xác nhận khoản tiền thực nhận và phân bổ cọc cho hóa đơn lịch mình được giao. Tiền mặt phải đếm và xác nhận; chuyển khoản phải lưu ghi chú/tham chiếu ảnh đã gửi nhóm. Chỉ OWNER sửa/đảo khoản đã ghi. Cọc dư giữ lại; phân bổ không tạo dòng tiền mới.
Thiết kế kỹ thuật PROPOSED đang áp dụng: STAFF thông thường chỉ thao tác hóa đơn có appointmentId trỏ tới lịch CONFIRMED/COMPLETED được giao hoặc hóa đơn gói có lịch CONFIRMED/COMPLETED được giao qua treatmentId. OWNER thu/phân bổ toàn spa; thu ngân giữ quyền thu tiền hiện có nhưng không tự có quyền phân bổ ngoài lịch mình. Quyền STAFF lập hóa đơn độc lập vẫn OPEN (BR-OPEN-001).
Ví dụ: người phụ trách thu 100.000đ/áp cọc được; nhân viên khác bị 403. Cọc 800.000đ áp 700.000đ còn 100.000đ, không tạo khoản thu thứ hai.

### BR-PKG-001 — Bán gói một thao tác
Trạng thái: CONFIRMED. Nguồn: người dùng 21/10/2026. Đã triển khai sellPackage.
OWNER/thu ngân chọn khách, dịch vụ đang hoạt động, tên gói, số buổi, giá bán toàn gói và hạn thanh toán đã thống nhất. Một transaction tạo Invoice và Treatment liên kết; không yêu cầu hóa đơn có sẵn, không ghi tiền tự động. Giá gói do người bán nhập, không tự nhân giá lẻ với số buổi. API treatment cũ giữ tương thích dữ liệu cũ; giao diện bán mới dùng sellPackage.
Ví dụ: retry cùng key chỉ có một hóa đơn và một gói; lỗi không để lại hóa đơn đơn lẻ.

### BR-PKG-002 — Dùng gói khi còn nợ
Trạng thái: CONFIRMED. Nguồn: spa và yêu cầu người dùng 21/10/2026.
Khách được dùng gói khi còn nợ trong hạn thanh toán được chọn lúc bán. Invoice.dueDate là nguồn hạn thanh toán; không tự gán 7/14 ngày hay mốc bắt đầu tính. Gói cũ thiếu hạn không tự backfill. Quy định khoảng 1–2 tuần là thông tin đã khảo sát; số ngày/mốc tính chuẩn vẫn BR-OPEN-010.
Quá hạn chỉ cảnh báo và cần đối soát; chưa tự khóa gói, thu phí, đổi trạng thái hay trừ thêm buổi vì chế tài quá hạn chưa chốt. Đặt lịch/ghi buổi vẫn kiểm tra gói còn buổi, cùng spa/khách/dịch vụ và xác nhận; không bắt paid=total.

### BR-PKG-003 — Thời hạn sử dụng gói
Trạng thái: CONFIRMED về phạm vi tham khảo; thời hạn cụ thể từng gói (BR-OPEN-002) và mốc bắt đầu tính (BR-OPEN-009) còn mở. Nguồn: spa xác nhận 21/10/2026.
Gói có thời hạn sử dụng tùy loại dịch vụ: chăm sóc mặt khoảng 1–2 năm, triệt lông khoảng 2–5 năm. Thời hạn cụ thể của từng gói (BR-OPEN-002), mốc bắt đầu tính từ ngày mua hay ngày dùng đầu tiên (BR-OPEN-009), lưu trữ và kiểm tra tự động chưa chốt.
Ví dụ kiểm tra: gói triệt lông hiển thị ngày hết hạn; hệ thống cảnh báo khi gần hết hạn.

### BR-PKG-004 — Bảo lưu gói
Trạng thái: CONFIRMED về quyền bảo lưu; tiêu chí lý do hợp lý và người duyệt còn mở (BR-OPEN-002). Nguồn: spa xác nhận 21/10/2026.
Spa có thể chấp nhận bảo lưu gói khi khách có lý do hợp lý. Tiêu chí lý do hợp lý, thời gian bảo lưu tối đa, người có quyền duyệt (BR-OPEN-002) và quy trình kỹ thuật chưa chốt.
Ví dụ kiểm tra: chủ spa ghi bảo lưu có lý do và ngày tiếp tục; gói không hết hạn trong thời gian bảo lưu.

## Thiết kế MVP chờ duyệt

### BR-TECH-001 — Tiền và số dư hợp lệ
Trạng thái: PROPOSED; đang áp dụng.
Tiền integer VNĐ, mỗi khoản tối đa 1.000 tỷ; số thu/phân bổ dương. Không thu vượt nợ, không phân bổ vượt cọc/nợ; cọc và paid không âm. Dòng tiền khác doanh thu kế toán.
Ví dụ kiểm tra: cọc 150.000đ không phân bổ được 200.000đ; từ chối NaN và tiền lẻ.

### BR-TECH-002 — Quyền, transaction và retry
Trạng thái: PROPOSED; đang áp dụng.
Cách ly spa, nạp lại quyền trong transaction; Control tuần tự hóa ghi theo spa. OWNER duyệt phân bổ; OWNER/thu ngân ghi tiền; STAFF ghi buổi và cập nhật lịch của mình. Ghi dữ liệu, audit, idempotency cùng transaction.
Ví dụ kiểm tra: retry cùng key/payload chỉ ghi một lần; khác payload trả 409; ID spa khác bị từ chối.

### BR-TECH-003 — Xác nhận và số buổi
Trạng thái: PROPOSED; đang áp dụng.
MVP lưu tham chiếu phiếu/bằng chứng, snapshot và digest, không tải ảnh/chữ ký. Ghi use và giảm remaining cùng transaction; không có API sửa/xóa xác nhận. Một invoice tối đa một gói.
Ví dụ kiểm tra: hai yêu cầu đồng thời dùng buổi cuối chỉ một thành công.

### BR-TECH-004 — Sổ tiền và sửa sai
Trạng thái: PROPOSED; đang áp dụng.
Ngày Việt Nam UTC+7; mở sổ hôm nay với tiền đầu ngày nhập tay. Ghi tiền chỉ khi ngày hiện tại mở. Chốt: expected = opening + thu tiền mặt - chi tiền mặt; difference = counted - expected. Chuyển khoản tính riêng. Chủ spa mở lại có lý do. Đảo sai sót ghi bút toán đối ứng hôm nay, không sửa tiền gốc và không thay hoàn tiền.
Ví dụ kiểm tra: expected 2.500.000đ, counted 2.450.000đ cho difference -50.000đ; không tự cân sổ. Đảo lần hai bị từ chối.

### BR-TECH-005 — Lịch và snapshot giá
Trạng thái: PROPOSED; đang áp dụng.
Không đặt quá khứ, chỉ chọn dịch vụ/nhân viên hoạt động. Lịch cùng nhân viên dùng khoảng [startAt,endAt), không giao nhau. Hóa đơn snapshot tên/giá dịch vụ lúc tạo; sửa giá không sửa hóa đơn cũ. Hoàn thành dịch vụ lẻ không tự thu tiền; lịch thuộc gói theo BR-APT-003.
Ví dụ kiểm tra: lịch 09:00–10:00 nối 10:00–11:00 được phép; lịch 09:30 bị từ chối. Sửa giá không đổi total hóa đơn cũ.

### BR-TECH-006 — Chuẩn hóa và phạm vi định danh
Trạng thái: PROPOSED; đang áp dụng.
Email trim/lowercase, unique toàn hệ thống. SĐT khách bỏ khoảng trắng, dấu chấm, ngoặc, gạch nối; +84 chuyển thành 0; nhận 10–11 chữ số bắt đầu 0; kiểm tra trùng trong cùng spa, kể cả dữ liệu cũ được chuẩn hóa khi so sánh. Chưa có unique index SĐT, ghi qua operations được Control bảo vệ.
Ví dụ kiểm tra: +84 900 000 000 và 0900000000 trùng nhau; email viết hoa không tạo tài khoản thứ hai.

### BR-TECH-007 — Ngừng hoạt động giữ lịch sử
Trạng thái: PROPOSED; đang áp dụng.
OWNER sửa khách/dịch vụ/STAFF; ngừng/mở lại dịch vụ và STAFF. Chặn ngừng khi còn lịch CONFIRMED; không khóa OWNER. Danh sách chọn chỉ có bản ghi hoạt động, lịch sử vẫn tra cứu được. Chưa có xóa khách.
Ví dụ kiểm tra: STAFF đã ngừng không thao tác được, dịch vụ ngừng không tạo hóa đơn mới, lịch sử cũ vẫn còn.

## Các câu hỏi chưa chốt

| Mã | Trạng thái | Đã xác nhận một phần | Còn mở (chưa chốt) | Ví dụ kiểm tra sau khi chốt |
|---|---|---|---|---|
| BR-OPEN-001 | OPEN | Chưa có | Chưa rõ nhân viên có được lập hóa đơn dịch vụ không gắn với lịch hẹn không | Nhân viên có được tự tạo hóa đơn dịch vụ lẻ khi khách không đặt lịch hẹn trước hay không? |
| BR-OPEN-002 | PARTIALLY ANSWERED | Thời hạn tùy từng gói (mặt khoảng 1–2 năm, triệt lông khoảng 2–5 năm theo BR-PKG-003); spa có thể bảo lưu nếu khách đưa ra lý do hợp lý (BR-PKG-004) | Thời hạn cụ thể của từng gói, tiêu chí “lý do hợp lý” và người có quyền duyệt bảo lưu | Gói chăm sóc da mặt cụ thể hạn bao nhiêu tháng? Tiêu chí nào được coi là lý do hợp lý và ai có quyền duyệt bảo lưu? |
| BR-OPEN-003 | PARTIALLY ANSWERED | Nhân viên cho khách xác nhận buổi liệu trình trên app (BR-TRT-001) | Phương án thay thế khi không thể xác nhận trên app; chưa được tự kết luận ảnh chụp gửi nhóm chat là đủ | Khách không dùng được app thì dùng phương thức nào thay thế? Ảnh chụp màn hình nhóm chat có đủ điều kiện làm bằng chứng hợp lệ không? |
| BR-OPEN-004 | OPEN | Chưa có (chính sách chung là không hoàn cọc/tiền theo BR-DEP-001, BR-TRT-002) | Chưa chốt ngoại lệ hoàn tiền khi spa hủy dịch vụ hoặc không thể tiếp tục cung cấp | Khi spa chủ động hủy dịch vụ thì ai duyệt hoàn tiền, tỷ lệ hoàn bao nhiêu và quy trình xử lý thế nào? |
| BR-OPEN-005 | PARTIALLY ANSWERED | Chỉ chủ spa được sửa khoản thu chi đã ghi (BR-CASH-001) | Quy trình mở lại hoặc xử lý khoản ghi nhầm đã chốt sổ | Khoản thu chi phát hiện ghi nhầm sau khi đã chốt sổ thì mở lại ngày hay dùng bút toán điều chỉnh ở ngày hiện tại? |
| BR-OPEN-006 | OPEN | Chưa có | Chưa chốt cách ghi nhận doanh thu gói và doanh thu dịch vụ | Tiền bán gói thu trước ghi nhận toàn bộ doanh thu lúc thu tiền hay phân bổ dần theo từng buổi hoàn thành? |
| BR-OPEN-007 | OPEN | Chưa có | Chưa rõ triệt lông tính theo buổi hay theo liệu trình (trọn gói bảo hành hay gói cố định số buổi) | Gói triệt lông trên hóa đơn và hồ sơ liệu trình ghi nhận số buổi cố định hay liệu trình trọn gói? |
| BR-OPEN-008 | PARTIALLY ANSWERED | Khách dừng gói thì không hoàn tiền hoặc đổi sang dịch vụ có giá trị tương đương (BR-TRT-002) | Cách tính giá trị phần gói chưa sử dụng (và người có quyền duyệt đổi) | Gói 10 buổi 5 triệu đã dùng 3 buổi: phần còn lại tính theo tỷ lệ gói (3.5 triệu) hay trừ theo giá lẻ từng buổi đã dùng? |
| BR-OPEN-009 | OPEN | Chưa có | Chưa rõ thời hạn gói bắt đầu từ ngày mua hay ngày sử dụng đầu tiên | Khách mua gói ngày 01/01 nhưng đến 01/03 mới đi buổi đầu tiên thì thời hạn hết hạn tính từ 01/01 hay từ 01/03? |
| BR-OPEN-010 | PARTIALLY ANSWERED | Khách có thể dùng gói trước và thanh toán trong khoảng 1–2 tuần (BR-PKG-002) | Số ngày chính xác và mốc bắt đầu tính thời hạn thanh toán | Thời hạn thanh toán là đúng 7 ngày hay 14 ngày; mốc bắt đầu tính từ ngày tạo hóa đơn/mua gói hay từ ngày dùng buổi đầu? |
| BR-OPEN-011 | OPEN | Ghi nhận sản lượng thực tế (số ca dịch vụ hoàn thành, số buổi liệu trình đã ghi) làm căn cứ đối soát | Công thức tính tiền hoa hồng (% theo dịch vụ, định mức cố định theo ca/buổi hay hoa hồng bán gói) và thời điểm ghi nhận | Hoa hồng tính theo % giá dịch vụ hay số tiền cố định mỗi ca? Tính ngay khi làm xong hay sau khi hóa đơn được thanh toán đủ? |
| BR-OPEN-012 | OPEN | Nhân viên chỉ xem thông tin của chính mình; chủ spa xem toàn bộ | Thẩm quyền của cấp quản lý (hoặc quản lý ca) trong việc xem lương/hoa hồng của nhân viên khác | Quản lý spa có được xem bảng lương và hoa hồng của nhân viên cấp dưới không hay chỉ chủ spa được xem? |
| BR-OPEN-013 | OPEN | Đã có tài khoản nhân sự và phân định vai trò OWNER / STAFF / thu ngân | Cơ cấu tính lương (lương cứng, theo ca, theo giờ, phụ cấp) và chu kỳ chốt/chi trả bảng lương | Mức lương cơ bản là bao nhiêu? Chu kỳ chốt lương theo tháng hay theo tuần? Quy trình phê duyệt bảng lương ra sao? |

### Chi tiết nội dung các mã BR-OPEN

- **BR-OPEN-001 (OPEN)**: Chưa rõ nhân viên (STAFF) có được lập hóa đơn dịch vụ không gắn với lịch hẹn không. Hiện tại completeAppointment gắn liền với lịch; việc tạo hóa đơn độc lập chưa chốt quyền cho STAFF.
- **BR-OPEN-002 (PARTIALLY ANSWERED)**:
  - *Phần đã xác nhận*: Thời hạn tùy từng gói dịch vụ (gói chăm sóc da mặt khoảng 1–2 năm, triệt lông khoảng 2–5 năm theo BR-PKG-003); spa có thể chấp nhận bảo lưu nếu khách đưa ra lý do hợp lý (BR-PKG-004).
  - *Phần còn mở*: Thời hạn cụ thể của từng gói danh mục, tiêu chí cụ thể để xác định “lý do hợp lý”, thời gian bảo lưu tối đa và người có thẩm quyền duyệt bảo lưu.
- **BR-OPEN-003 (PARTIALLY ANSWERED)**:
  - *Phần đã xác nhận*: Nhân viên cho khách xác nhận buổi liệu trình trên app (BR-TRT-001).
  - *Phần còn mở*: Phương án thay thế khi không thể xác nhận trên app (khách không có smartphone, app lỗi, mất mạng); chưa được tự kết luận ảnh chụp gửi nhóm chat là đủ điều kiện làm bằng chứng xác nhận buổi.
- **BR-OPEN-004 (OPEN)**: Chưa chốt ngoại lệ hoàn tiền khi spa hủy dịch vụ hoặc không thể tiếp tục phục vụ (chính sách chung hiện tại là không hoàn tiền theo BR-DEP-001, BR-TRT-002; ngoại lệ do lỗi từ phía spa chưa có quy trình và người duyệt).
- **BR-OPEN-005 (PARTIALLY ANSWERED)**:
  - *Phần đã xác nhận*: Chỉ chủ spa (OWNER) được sửa khoản thu chi đã ghi (BR-CASH-001).
  - *Phần còn mở*: Quy trình mở lại sổ ngày hoặc xử lý khoản ghi nhầm đã chốt sổ (mở lại sổ ngày cũ hay lập bút toán đối ứng/điều chỉnh ở ngày hiện tại).
- **BR-OPEN-006 (OPEN)**: Chưa chốt cách ghi nhận doanh thu gói và doanh thu dịch vụ (dòng tiền thực thu đối chiếu với doanh thu kế toán: ghi nhận một lần lúc bán hay phân bổ theo từng buổi dịch vụ hoàn thành).
- **BR-OPEN-007 (OPEN)**: Chưa rõ dịch vụ triệt lông tính theo buổi hay theo liệu trình (gói cố định số buổi hay trọn gói bảo hành định kỳ).
- **BR-OPEN-008 (PARTIALLY ANSWERED)**:
  - *Phần đã xác nhận*: Khách dừng gói thì không hoàn tiền hoặc đổi sang dịch vụ có giá trị tương đương khi spa chấp thuận (BR-TRT-002).
  - *Phần còn mở*: Cách tính giá trị phần gói chưa sử dụng (tính theo tỷ lệ số buổi còn lại hay lấy tổng tiền gói trừ đi giá đơn lẻ của các buổi đã dùng) và thẩm quyền duyệt đổi.
- **BR-OPEN-009 (OPEN)**: Chưa rõ thời hạn sử dụng gói bắt đầu tính từ ngày mua gói (ngày tạo hóa đơn) hay từ ngày sử dụng buổi đầu tiên.
- **BR-OPEN-010 (PARTIALLY ANSWERED)**:
  - *Phần đã xác nhận*: Khách có thể dùng gói trước và thanh toán trong khoảng 1–2 tuần (BR-PKG-002).
  - *Phần còn mở*: Số ngày chính xác (ví dụ đúng 7 ngày, 10 ngày hay 14 ngày) và mốc bắt đầu tính thời hạn thanh toán (tính từ ngày mua/tạo hóa đơn hay ngày làm buổi đầu tiên).
- **BR-OPEN-011 (OPEN)**: Công thức tính tiền hoa hồng và thời điểm ghi nhận hoa hồng.
  - *Phần đã xác nhận*: Hệ thống ghi nhận sản lượng thực tế (số ca dịch vụ hoàn thành, số buổi liệu trình đã ghi) làm căn cứ đối soát minh bạch; nhân viên xem ca của mình, chủ spa xem toàn bộ.
  - *Phần còn mở*: Công thức tính cụ thể (% giá dịch vụ, định mức cố định theo ca/buổi hay hoa hồng bán gói) và thời điểm ghi nhận (khi hoàn thành ca làm việc hay sau khi hóa đơn được thanh toán đủ). Không tự đặt công thức hoặc số tiền giả định.
- **BR-OPEN-012 (OPEN)**: Quyền của cấp quản lý trong việc xem lương và hoa hồng của nhân viên khác.
  - *Phần đã xác nhận*: Chủ spa (OWNER) có quyền xem toàn bộ; nhân viên (STAFF) chỉ có quyền xem thông tin của chính mình.
  - *Phần còn mở*: Quyền hạn của cấp quản lý trung gian (nếu có tài khoản Quản lý / Manager trong tương lai) có được xem thông tin lương và hoa hồng của nhân viên cấp dưới hay không.
- **BR-OPEN-013 (OPEN)**: Quy chế tiền lương nhân sự và chu kỳ chốt bảng lương.
  - *Phần đã xác nhận*: Có danh sách nhân sự với vai trò và cờ thu ngân; chưa kích hoạt bảng tính tiền lương tự động.
  - *Phần còn mở*: Mức lương cơ bản, tính lương theo ca/giờ làm, các khoản phụ cấp/giảm trừ, chu kỳ chốt bảng lương và quy trình phê duyệt chi trả lương.

## Đối chiếu kiểm thử

`tests/rules.test.mjs`: tiền, cọc, nợ, lịch, ngày, xác nhận. `tests/integration.test.ts`: transaction, idempotency, quyền, phân bổ, lượt dùng, trùng định danh, sửa và trạng thái. Đọc `VALIDATION.md` để biết trạng thái thực chạy; có ca test không có nghĩa đã kiểm chứng trên database.

## Bổ sung lịch hẹn — 20/10/2026

### BR-APT-001 — Hoãn, dời, hủy lịch
Trạng thái: CONFIRMED về nhu cầu. Nguồn: người dùng yêu cầu xử lý khách đến sớm/muộn ngày 20/10/2026.
Cần hỗ trợ dời lịch, hoãn lịch, hủy lịch. Không tự thu phí, hoàn cọc hay trừ buổi khi đổi lịch.
Ví dụ kiểm tra: đổi từ 14h sang 16h không phát sinh giao dịch tiền.

### BR-TECH-008 — Trạng thái và quy trình đổi lịch
Trạng thái: PROPOSED; đang áp dụng trong MVP. Ghi chú xung đột: xem bên dưới.
- Dời lịch: đã có giờ mới, kiểm tra tương lai/nhân viên hoạt động/trùng lịch và chuyển CONFIRMED. Giữ thời lượng đã đặt, không lấy thời lượng danh mục mới.
- Hoãn: chưa chốt giờ mới, chuyển POSTPONED; giữ giờ cũ để tham khảo, không giữ khung giờ, không tính vào lịch hôm nay. Cần lý do.
- Xếp lại lịch hoãn: ⚠️ Yêu cầu xác nhận 21/10/2026 — giữ bản ghi POSTPONED để tra cứu lịch sử và tạo lịch hẹn MỚI cho giờ đã chốt; không cập nhật giờ trên cùng bản ghi cũ. Cách triển khai hiện tại (reschedule cập nhật bản ghi POSTPONED cùng chỗ) là PROPOSED và xung đột với yêu cầu này; cần xét lại khi sửa code.
- Hủy: chuyển CANCELLED, kết thúc cuộc hẹn; không mở lại. POSTPONED cũng có thể hủy.
- Chỉ CONFIRMED được hoàn thành; không hoàn thành trước giờ bắt đầu. Lịch hoãn cần có lịch CONFIRMED mới trước khi hoàn thành.
- OWNER/thu ngân điều chỉnh lịch của spa. STAFF thường chỉ điều chỉnh lịch của mình, không tự chuyển cho người khác.
- Dời/hoãn/hủy lưu audit trước/sau và lý do; idempotency cùng transaction. Hủy qua UI yêu cầu lý do; API giữ tương thích cho client cũ không gửi reason.
Ví dụ kiểm tra: sau hoãn 14h–15h, nhân viên nhận được lịch khác 14h; đặt lịch mới cho lịch hoãn vào 14h bị 409. Hai request cùng dời vào một chỗ trống không được cùng chiếm khung giờ.

Còn mở: thời gian cho phép trễ, phí dời/hủy, giới hạn số lần đổi, ghi giờ khách đến/check-in. Chưa tự áp dụng chế tài hoặc quy trình check-in.

## Liên kết lịch với hóa đơn — 20/10/2026

### BR-APT-002 — Hoàn thành dịch vụ lẻ và hóa đơn
Trạng thái: CONFIRMED về phạm vi. Nguồn: người dùng chọn “liên kết với hóa đơn trước” sau khi thống nhất luồng xác nhận.
- Nhân viên được phân công hoặc OWNER/thu ngân bấm Hoàn thành & lập hóa đơn, kiểm tra thông tin và xác nhận. Hủy form không đổi lịch.
- Khi xác nhận, lịch COMPLETED và hóa đơn mới OPEN, paid=0 được lưu cùng transaction; không tự thu tiền, áp cọc hoặc trừ buổi.
- Lịch đã có hóa đơn thì dùng lại, không tạo thêm khi retry/click lại. Có thể chọn hóa đơn đã lập đúng khách và dịch vụ để liên kết, không tự đoán hóa đơn cũ.
- Lịch đã hoàn thành từ trước nhưng chưa liên kết có thể lập/liên kết hóa đơn sau. Lịch hủy/hoãn hoặc chưa đến giờ không được hoàn thành và lập hóa đơn.
Ví dụ: lịch dịch vụ 350.000đ hoàn thành → một hóa đơn nợ 350.000đ; thu tiền ở thao tác Payment riêng sau khi thực nhận.

### BR-TECH-009 — Phân quyền và liên kết 1–1
Trạng thái: PROPOSED; đang áp dụng.
- Cập nhật theo BR-APT-003: STAFF hoàn thành lịch của mình cũng tự sinh hóa đơn qua hệ thống; không được tự chọn hóa đơn cũ/hạn trả, xem tài chính hoặc thu tiền. OWNER/thu ngân xử lý thanh toán.
- Invoice.appointmentId tùy chọn, unique theo spa khi tồn tại. Hóa đơn độc lập không bắt buộc có lịch. Luồng gắn lịch vào gói bổ sung theo BR-APT-003.
- Khi tạo mới, snapshot tên/giá danh mục tại lúc xác nhận; không sửa paid/total của hóa đơn có sẵn khi liên kết. Hạn trả trong form chỉ áp dụng cho hóa đơn mới.
- Hóa đơn đã gắn lịch khác, sai khách/dịch vụ/spa hoặc hóa đơn đã dùng tạo gói đều bị từ chối. Dữ liệu lỗi không được tự ghép.
- Lịch cũ giữ nguyên, không tự truy ngược để đoán hóa đơn; người có quyền chọn đúng hóa đơn nếu đã tạo trước đó. Bản MVP chỉ hiển thị 500 bản ghi gần nhất; tìm/liên kết dữ liệu ngoài cửa sổ cần mở rộng truy vấn khi có nhu cầu.

## Gói khi đặt lịch và thanh toán — 20/10/2026

### BR-APT-003 — Lịch trong gói và lịch dịch vụ lẻ
Trạng thái: CONFIRMED về luồng. Nguồn: người dùng yêu cầu lịch trong gói trừ buổi khi hoàn thành; không có gói thì tạo hóa đơn và nhận tiền mặt/chuyển khoản, theo dõi trạng thái hóa đơn.
- Lịch đã liên kết gói: hoàn thành kèm xác nhận buổi, giảm đúng 1 remaining và tạo TreatmentUse cùng transaction; không tạo hóa đơn mới. Vẫn giữ BR-TRT-001: xác nhận thay thế phải có lý do.
- Lịch dịch vụ lẻ: hoàn thành tạo/liên kết invoice như BR-APT-002; nhận tiền bằng CASH hoặc BANK_TRANSFER, cho phép nợ/trả một phần.
- Trạng thái hóa đơn: OPEN (chưa trả), PARTIALLY_PAID (0 < paid < total), PAID (paid=total). Đảo thu/phân bổ phải cập nhật lại trạng thái theo paid; không sửa nhãn trạng thái độc lập với tiền.
- Không coi mở/quét QR là đã trả. Chỉ ghi Payment khi người có quyền xác nhận thực nhận tiền; backend yêu cầu receivedConfirmation=true.
Ví dụ: gói còn 7 buổi → hoàn thành còn 6, không sinh invoice; hóa đơn 350k trả 100k → PARTIALLY_PAID, nợ 250k; trả nốt → PAID.

### BR-TECH-010 — Gợi ý gói và QR tài khoản
Trạng thái: PROPOSED; đang áp dụng.
- Khi đặt lịch, lọc gói ACTIVE còn buổi theo khách và dịch vụ. Một gói phù hợp thì gợi ý chọn; nhiều gói thì chọn đúng gói. Người dùng có thể để trống để mua dịch vụ lẻ, backend không tự đoán gói.
- Appointment.treatmentId là liên kết rõ ràng, không tự suy luận vào lúc hoàn thành. Gói cũ xác định dịch vụ qua Invoice.serviceId. Không trừ khi đặt/hoãn/dời/hủy; chưa giữ chỗ số buổi.
- Khi hoàn thành, kiểm tra lại gói còn buổi. Hết buổi thì báo lỗi, giữ trạng thái lịch; không âm, không tự chuyển sang dịch vụ lẻ. Retry cùng hoặc khác key không giảm hai lần cho một lịch nhờ unique TreatmentUse.appointmentId.
- STAFF chỉ hoàn thành lịch gói mình phụ trách; OWNER/thu ngân theo quyền hiện có. appointmentStatus COMPLETED không cho bỏ qua xác nhận của lịch gói; completeAppointment không cho tạo invoice dịch vụ lẻ cho lịch gói.
- Ngân hàng, STK, tên chủ tài khoản cấu hình qua biến môi trường của instance. Chỉ hiển thị cho người có quyền tài chính. Có thể dùng ảnh QR tài khoản tại đường dẫn cùng website; chưa tự sinh QR động theo số tiền, chưa có webhook/kiểm tra sao kê tự động.
- Nếu chưa cấu hình ngân hàng/QR, hiển thị rõ chưa cấu hình; không tạo mã giả hoặc tự điền tài khoản.

Cập nhật này thay thế các mô tả cũ rằng hoàn thành mọi lịch đều không trừ buổi và chưa có liên kết lịch–gói. Hoàn thành lịch dịch vụ lẻ vẫn không trừ buổi.

Cập nhật quyền theo yêu cầu tự tạo hóa đơn: completeAppointment cho OWNER/thu ngân hoặc STAFF trên lịch của mình. Với STAFF, hệ thống tạo invoice tự động, không cho chọn existingInvoiceId/dueDate và không mở trang tài chính. appointmentStatus COMPLETED cho dịch vụ lẻ cũng tạo invoice để client cũ không bỏ sót hóa đơn; lịch gói bắt buộc completeTreatmentAppointment. Quyền tạo invoice độc lập, thu tiền và xem hóa đơn vẫn chỉ OWNER/thu ngân.


## Cập nhật ưu tiên theo yêu cầu mới nhất — 21/10/2026

Menu phân cấp có thể thu gọn/mở rộng, dùng chung cấu hình cây trên desktop và mobile. Tổng quan tại `/`; mỗi mục hoạt động mở trang riêng `/workspace/{section}`, hỗ trợ tải lại và Back/Forward. Server kiểm tra phiên và quyền: services/staff/audit chỉ OWNER, days/reports OWNER hoặc thu ngân. Không thay đổi quyền ghi tài chính hay phạm vi dữ liệu API workspace.

Yêu cầu này thay thế mô tả trước về trang Lương/Hoa hồng hiển thị sản lượng: chỉ tạo trang hoạt động khi nghiệp vụ được xác định. Hiện hai mục chỉ ghi “Chưa triển khai”, không liên kết, không có trang hoạt động, schema hoặc API lương/hoa hồng. Không tạo kỳ lương giả hay suy ra hoa hồng từ người ghi buổi. Khi triển khai: backend lấy spaId/actorId từ phiên, STAFF chỉ xem của mình, OWNER xem toàn spa. BR-OPEN-011 (công thức/thời điểm hoa hồng), BR-OPEN-012 (quyền quản lý xem nhân viên khác), BR-OPEN-013 (quy chế và kỳ lương) giữ OPEN. Cấu hình route là thiết kế kỹ thuật; không chốt thêm chính sách tài chính.


## Quy tắc ưu tiên mới: ký buổi và bảo lưu — 21/10/2026
Nguồn: người dùng xác nhận trong hội thoại và yêu cầu sửa code. Ghi đè mô tả cũ của BR-TRT-001, BR-TECH-003 và phần bảo lưu BR-PKG-004/BR-OPEN-002.
### BR-TRT-001 cập nhật — CONFIRMED
Mọi buổi mới cần khách ký trực tiếp trên màn hình. Có lịch: hoàn thành ca kèm chữ ký, trừ 1 buổi và hoàn thành lịch atomically. Không có lịch: ghi buổi trực tiếp trên gói kèm chữ ký. Không bắt chọn hình thức hoặc nhập mã phiếu; API mới từ chối payload chỉ có SIGNATURE_REFERENCE/ALTERNATIVE. Chưa ký/hủy không ghi buổi. Gói bảo lưu/hết buổi không dùng được. Không thu tiền hoặc tạo hóa đơn khi dùng buổi gói. Phiếu cũ giữ nguyên; xác nhận ngoại tuyến vẫn BR-OPEN-003.
### BR-PKG-004 cập nhật — CONFIRMED
Chỉ OWNER duyệt bảo lưu, gia hạn bảo lưu và mở lại. Xét lý do từng trường hợp; nhập ngày kết thúc cho từng gói, không có thời hạn chung. PAUSED giữ remaining; không tự ACTIVE dù holdUntil đã qua. Mở lại thủ công mới sử dụng tiếp. OWNER có thể nhập hạn sử dụng mới khi mở lại nếu duyệt riêng, bỏ trống giữ hạn cũ; không tự cộng thời gian bảo lưu. Không chốt danh sách lý do hợp lý hay công thức đổi gói. Phần người duyệt/quy trình bảo lưu của BR-OPEN-002 đã được trả lời; hạn gốc theo loại gói/mốc tính vẫn mở.
### BR-TECH-011 — PROPOSED kỹ thuật đang áp dụng
Nét ký là vector có giới hạn, lưu cùng snapshot ngữ cảnh, SHA-256, actor và staff thực hiện. Chữ ký không nằm trong danh sách workspace/audit, chỉ endpoint đọc có phiên/cùng spa và OWNER hoặc người ghi/thực hiện buổi. Buổi không lịch giữ quyền STAFF hiện hành, staffId=actor; buổi theo lịch giữ phân công và quyền hoàn thành cũ. remainingBefore ràng buộc số buổi đã hiển thị lúc ký; dữ liệu đổi trả409 yêu cầu ký lại. Retry cùng key trả bản ghi cũ; khác key với ảnh chụp số buổi cũ không được trừ thêm. Chữ ký vector không phải xác thực danh tính bằng chứng thư số.
Không tự khóa/hủy gói theo expiresOn hoặc tự đặt hạn ban đầu khi chưa có chính sách đầy đủ; ngày chủ spa duyệt được lưu để tra cứu.


## Khách hàng vượt 500 bản ghi - 22/10/2026

Nguồn: người dùng yêu cầu khắc phục giới hạn danh sách khi số khách lớn. CONFIRMED về nhu cầu tra cứu/chọn toàn bộ khách trong spa, không áp trần 500 khách. PROPOSED kỹ thuật: GET /api/customers phân trang, tìm theo tên/điện thoại/ghi chú hoặc ID; giới hạn tối đa 100 mỗi request là giới hạn tải, không phải giới hạn số khách được lưu. OWNER/STAFF đã xác thực xem khách cùng spa; quyền sửa vẫn chỉ OWNER. Không thay quyền ghi tài chính. Các danh sách giao dịch/báo cáo cũ vẫn còn giới hạn riêng, không coi đã xử lý toàn bộ.


## Tra cứu lịch sử không giới hạn 500 - 22/10/2026

CONFIRMED về yêu cầu: bỏ trần 500 ở toàn bộ danh sách và thông báo trên giao diện. PROPOSED kỹ thuật: tải 1..100 dòng mỗi request, count trên toàn bộ dữ liệu được quyền xem, thứ tự ổn định theo thời điểm và _id, tìm/lọc trước khi phân trang. Quyền đọc và ghi tài chính giữ nguyên: STAFF xem lịch được giao, hóa đơn trực tiếp/gói được giao, cọc và phân bổ trong phạm vi hóa đơn được phép, sổ thu chi của mình; OWNER/thu ngân giữ phạm vi tài chính hiện có. Backend kiểm tra quyền section theo menu. OWNER mới xem audit, danh sách nhân viên, danh mục dịch vụ; ngày/báo cáo chỉ OWNER/thu ngân. Không đổi transaction, idempotency hoặc audit của thao tác ghi. Tổng ngày, số gói/buổi và báo cáo dùng truy vấn tổng hợp toàn bộ dữ liệu đúng scope.


## Xác nhận mới — 22/10/2026: danh mục gói, khuyến mãi, tư vấn và hóa đơn
Nguồn: yêu cầu người dùng và lựa chọn trong phiên. Các rule sau là CONFIRMED, ưu tiên hơn mô tả cũ mâu thuẫn.
- BR-PKG-005: tạo sẵn danh mục gói; lúc bán chỉ chọn/gán khách. Snapshot dịch vụ/tên/số buổi/giá, không đổi gói đã bán khi sửa danh mục. Quản lý danh mục OWNER, bán gói giữ quyền OWNER/thu ngân hiện hành (quyền kỹ thuật PROPOSED).
- BR-GIFT-001: một lần bán có thể tặng nhiều gói; nhập tên đợt khuyến mãi cho lần bán có quà. Giá quà luôn 0, mỗi gói có số buổi riêng. Backend bỏ quyền nhập giá quà. Tất cả hóa đơn/gói tặng cùng giao dịch bán; lỗi một quà phải rollback toàn bộ, retry không nhân đôi quà.
- BR-INV-002: tạo hóa đơn chọn dịch vụ rồi sửa nội dung/giá. Giá mua lẻ nguyên VNĐ dương. Ghi nhận một buổi gói đúng khách/dịch vụ, ACTIVE/còn buổi và có chữ ký hợp lệ tạo một hóa đơn SESSION tổng=paid=0, trạng thái PAID cùng transaction ghi Use/trừ buổi/hoàn thành lịch nếu có. Không Payment/CashEntry cho 0đ. Nợ hóa đơn mua gói không thay đổi. Retry hoàn thành cùng lịch/key không nhân đôi hóa đơn hay trừ thêm buổi.
- BR-CONSULT-001: khách có tư vấn mặc định; bán gói/hóa đơn cho chọn tư vấn riêng, để trống dùng mặc định. Tư vấn cùng spa và active; tên tư vấn và người tạo snapshot vào hóa đơn, người tạo lấy phiên. Xóa tư vấn mặc định không xóa lịch sử hóa đơn.
- BR-COMMISSION-001: cấu hình mức tiền cố định riêng từng dịch vụ (nguyên VNĐ không âm). Mức được snapshot cho hóa đơn mới, không tự tính trả/ghi thu chi. BR-OPEN-011 chỉ đóng phần hình thức mức cố định; thời điểm/đối tượng hưởng, cách chia và trường hợp quà tặng vẫn OPEN. Lương/kỳ chốt lương không thay đổi.
- BR-HISTORY-001: bỏ mục nhật ký riêng trên menu, tích hợp tra cứu vào hóa đơn/lịch sử khách; không xóa audit. Chữ ký chỉ OWNER hoặc actor/staff của buổi theo quyền đã có; thu ngân không tự được thêm quyền xem chữ ký. Lịch sử khách chỉ chứa hóa đơn trong phạm vi tài chính người xem.
Ví dụ: bán gói A 10 buổi 2tr, tặng B 3 buổi tạo hóa đơn mua 2tr và hóa đơn quà 0đ. Khách ký dùng B một buổi: B còn2, có hóa đơn buổi 0đ và chữ ký; nợ A giữ nguyên, không phát sinh khoản thu.


## Giao diện Thu ngân — 22/10/2026
CONFIRMED về nhu cầu: người dùng yêu cầu tham khảo luồng EasySalon để làm SpaCare. PROPOSED kỹ thuật: route cashier chỉ OWNER/thu ngân, khớp quyền lập invoice/sellPackage hiện hành; STAFF thường giữ quyền xem/thu các hóa đơn được giao qua mục Hóa đơn. Nháp trước khi bấm Lưu chỉ ở state trình duyệt, tìm/chọn/chỉnh không tạo dữ liệu DB. Lưu dùng invoice/sellPackage hiện có cùng Idempotency-Key/transaction; nhận tiền vẫn riêng bằng payment có xác nhận thực nhận. Không tự mở sổ, ghi thu hay áp cọc khi lưu hóa đơn. Không đổi chính sách hoa hồng, lương, giảm giá hoặc quyền tài chính vì tham khảo ứng dụng khác.


## Tham khảo phân hệ và đọc dữ liệu — 22/10/2026
CONFIRMED về yêu cầu tham khảo EasySalon cho các màn liên quan; các lựa chọn đọc/giao diện dưới đây là PROPOSED kỹ thuật, không chốt thêm quy chế tài chính:
- Bộ lọc kết hợp tenant/quyền bằng AND, thực hiện trước count/skip/limit. Chọn nhân viên khác không làm vượt phạm vi lịch hoặc sổ tiền của STAFF. Ngày lọc lịch là startAt UTC+7; sổ tiền dùng day đã ghi, không suy lại ngày từ createdAt.
- Hóa đơn lọc thanh toán theo total/paid (gồm dữ liệu status cũ), quá hạn chỉ là dueDate trước hôm nay và còn nợ; không khóa gói hay tự áp phí. Hóa đơn0 thuộc nhóm đã thanh toán, không tạo dòng tiền.
- Hồ sơ khách hiển thị nợ/cọc/hóa đơn trong quyền đọc. STAFF không có hóa đơn thuộc phạm vi ở khách đó không được xem số dư cọc. Lịch/đến gần nhất chỉ trong lịch nhân viên được phép xem; số liệu hồ sơ không được gọi là tổng toàn spa nếu đang giới hạn quyền.
- Nhóm dịch vụ là nhãn quản lý tùy chọn, không đổi giá/lịch sử/số buổi. Chỉ OWNER tạo/sửa như quyền danh mục đang có. Gói mẫu lấy nhóm từ dịch vụ liên kết.
- Hồ sơ nhân viên chỉ OWNER, đếm lịch được giao/hoàn thành, buổi thực hiện và khách tư vấn. Sản lượng không phải tiền lương hay hoa hồng đã hưởng; không suy công thức trả tiền.


## BR-PAY-001 — Lương tháng cộng hoa hồng
CONFIRMED. Nguồn: người dùng chọn trong phiên22/10/2026. Lương cơ bản riêng từng người, cộng hoa hồng cố định cho người trực tiếp thực hiện khi hoàn thành dịch vụ; khách còn nợ không chặn ghi nhận. Buổi gói tặng0đ vẫn hưởng. Không ghi hoa hồng thực hiện chỉ vì bán gói/tạo hóa đơn.
BR-OPEN-011 đóng phần hình thức/mốc/người hưởng/quà tặng trong phạm vi trên. Không có hoa hồng tư vấn/bán hàng mới. BR-OPEN-013 đóng phần lương cơ bản tháng cộng hoa hồng; công, thuế, BHXH, quy chế điều chỉnh và lịch chi cụ thể chưa được xác nhận. BR-OPEN-012 vẫn không bổ sung MANAGER.
PROPOSED kỹ thuật đang triển khai:
- Snapshot mức hoa hồng từ invoice khi có (đã snapshot lúc tạo), nếu chưa có dùng Service hiện tại tại lần ghi nhận. Use mới lấy mức Service tại lúc ghi buổi. Không thay mức đã ghi, không backfill công việc hoàn thành cũ.
- Mỗi source ca/buổi và mỗi invoice thực hiện tối đa một Commission. Hoàn thành lịch gói chỉ ghi theo Use, không ghi thêm theo Appointment; retry không nhân đôi. Hóa đơn dịch vụ lẻ không lịch: OWNER/thu ngân xác nhận hoàn thành và chọn người làm; STAFF không tự nhận hóa đơn độc lập cho mình. Không gắn hóa đơn đã thực hiện vào lịch mới để tránh ghi trùng.
- Buổi không lịch mặc định nhân viên phiên; OWNER/thu ngân có thể chỉ định người trực tiếp làm. STAFF không chọn người khác. Đổi người trước ký phải xóa chữ ký cũ; snapshot ký/Commission dùng cùng người thực hiện.
- OWNER nhập thưởng/phụ cấp và khấu trừ với lý do, không tự suy từ chấm công. Tiền nguyên VNĐ, thực nhận không âm; một bảng/người/tháng. Tháng tương lai chưa lập bảng.
- Nháp lưu snapshot; cập nhật nháp phải đúng id, không vô tình ghi đè bảng đã có. Duyệt kiểm tra expectedTotal và tập hoa hồng chưa chốt, thay đổi trả409 yêu cầu cập nhật nháp. Duyệt gắn các khoản vào đúng bảng trong transaction.
- Mỗi bảng gom hoa hồng chưa chốt trước đầu tháng sau (gồm tồn trước tháng); không lấy từ bảng đã duyệt khác. Sau duyệt khoản đến muộn giữ chưa chốt để kỳ sau. Lương cơ bản không tự chia theo công hoặc ngày vào/nghỉ.
- Chỉ OWNER chi bảng APPROVED, phải xác nhận thực chi. Tiền dương cần sổ hôm nay OPEN, BANK_TRANSFER cần ghi chú/tham chiếu. Tiền0 chuyển PAID không tạo CashEntry0. Một bảng chỉ có một CashEntry PAYROLL; retry không chi hai lần.
- Không sửa bảng APPROVED/PAID, không hard delete khoản hoa hồng/bảng lương. Chưa có mở lại hoặc đảo chi lương; reverseCash thông thường từ chối PAYROLL để tránh lệch bảng và sổ. Quy trình xử lý trả lương nhầm cần thiết kế riêng.


## Cài hoa hồng theo dịch vụ — 22/10/2026
CONFIRMED: mỗi dịch vụ có một mức hoa hồng cố định dùng chung cho người trực tiếp thực hiện. OWNER tạo/cập nhật mức qua nút Tạo hoa hồng hoặc Sửa hoa hồng. Không thay đổi ledger đã ghi, bảng lương đã duyệt hay snapshot hóa đơn đã tạo. Quyền OWNER và snapshot vẫn theo triển khai hiện hành.

## BR-PRODUCT-001 - Dung tích sản phẩm tính bằng ml
CONFIRMED. Nguồn: yêu cầu người dùng ngày 22/10/2026. Khi thêm hoặc sửa danh mục sản phẩm, nhập dung tích theo số ml thay cho trường đơn vị dạng chai/lọ. Dung tích là số nguyên dương; tồn kho vẫn đếm số sản phẩm. Dữ liệu cũ chưa có dung tích giữ nguyên và không tự suy đoán.

## BR-PUBLIC-001 - Trang chủ và dịch vụ công khai
Trạng thái: CONFIRMED. Nguồn: yêu cầu người dùng ngày 22/10/2026.
- Đường dẫn `/` là trang chủ công khai của SpaCare, luôn hiển thị mà không tự động chuyển hướng đến `/login`.
- Khách chưa đăng nhập được xem toàn bộ trang chủ, danh sách dịch vụ `/services`, chi tiết dịch vụ `/services/[id]` và thực hiện đặt lịch `/booking`.
- Tuyệt đối không để lộ dữ liệu nội bộ như hoa hồng nhân viên, giá vốn hoặc cấu hình quản trị ra ngoài trang công khai.
- Khi người dùng đã đăng nhập truy cập `/`, vẫn hiển thị trang chủ công khai cùng thông tin tài khoản và nút điều hướng tương ứng với vai trò.

## BR-CUSTOMER-001 - Phân quyền và cổng khách hàng
Trạng thái: CONFIRMED. Nguồn: yêu cầu người dùng ngày 22/10/2026.
- Tài khoản vai trò CUSTOMER được truy cập dashboard khách hàng `/customer` để theo dõi lịch hẹn, số buổi liệu trình còn lại và hóa đơn thanh toán của chính mình.
- CUSTOMER bị chặn tuyệt đối (HTTP 403) khi truy cập không gian quản lý `/workspace` hoặc bất kỳ API quản trị nội bộ nào (`/api/workspace`, `/api/operations`, `/api/customers`, `/api/payroll`, `/api/products`, `/api/staff`, v.v.).
- Không cho phép bất kỳ khách hàng nào xem hoặc truy cập dữ liệu của khách hàng khác.
- Đăng nhập: OWNER và STAFF được điều hướng đến `/workspace`; CUSTOMER được điều hướng đến `/customer`.

## BR-APT-002 - Giờ hoạt động và giờ hẹn
Trạng thái: CONFIRMED. Nguồn: yêu cầu người dùng ngày 23/10/2026.
- Spa nhận lịch trong khung 09:00–22:00 theo giờ Việt Nam (Asia/Ho_Chi_Minh).
- Toàn bộ thời lượng dịch vụ phải kết thúc muộn nhất lúc 22:00 và nằm trong cùng ngày hoạt động. Lịch đặt mới và lịch dời đều được backend kiểm tra.
- Giao diện đặt lịch hiển thị các giờ bắt đầu cách nhau 30 phút; chỉ hiển thị giờ đủ thời lượng để kết thúc trước giờ đóng cửa.
- Mục Lịch theo ngày hiển thị dạng trục thời gian ngang từ 09:00 đến 22:00, chia theo nhân viên. Lịch cũ ngoài khung vẫn được hiển thị và đánh dấu để không làm mất dữ liệu.
Ví dụ kiểm tra: dịch vụ 60 phút nhận 21:00, từ chối 21:30; mọi dịch vụ từ chối giờ bắt đầu trước 09:00.

## BR-APT-003 - Báo kín lịch khi đặt trên web
CONFIRMED theo yêu cầu người dùng 23/10/2026: nếu không còn nhân viên rảnh trong toàn bộ thời lượng dịch vụ, trả 409 và báo “Khung giờ này đã có lịch, vui lòng chọn giờ khác”. Giữ quy tắc trùng theo nhân viên; còn nhân viên khác rảnh vẫn được đặt. Lịch CONFIRMED giữ chỗ; POSTPONED/CANCELLED không giữ chỗ. Hai lịch tiếp nối được phép.
PROPOSED kỹ thuật: dùng Control guard chung với thao tác nội bộ, transaction snapshot/majority và retry của MongoDB; yêu cầu UUID Idempotency-Key để gửi lại không sinh lịch thứ hai; ghi audit cùng transaction. Không tạo hồ sơ khách khi đặt thất bại.

## Đơn giản phiếu kho - 23/10/2026
CONFIRMED, yêu cầu người dùng 23/10/2026: phiếu nhập/xuất kho thủ công không bắt buộc lý do, form không hiển thị ô lý do. Thay yêu cầu nhập lý do trước đây. Khi thao tác từ sản phẩm cụ thể, giữ sản phẩm đó và không chọn lại. Backend vẫn kiểm tra OWNER, cùng spa, số lượng, tồn kho và giữ transaction/idempotency/audit.

## Ảnh và danh mục sản phẩm công khai - 23/10/2026
BR-PRODUCT-IMAGE-001 CONFIRMED: OWNER tải ảnh qua thư viện/camera; khách được xem danh mục sản phẩm đang bán. Backend kiểm tra phiên active, quyền và spa khi gắn ảnh. PROPOSED kỹ thuật: nhận JPG/PNG/WebP tối đa 5 MB, kiểm tra chữ ký định dạng, lưu GridFS; ảnh sản phẩm là ảnh công khai. Chưa hỗ trợ HEIC. Danh mục công khai chỉ có thông tin sản phẩm, không có SKU/tồn chính xác/cảnh báo kho/lịch sử. Instance MVP dùng spa đầu tiên theo _id cho danh mục công khai, không suy ra tenant từ đầu vào khách.


## Báo cáo và nhân viên — 23/10/2026
PROPOSED kỹ thuật theo yêu cầu tiếp tục: báo cáo tách giá trị hóa đơn (ngày tạo, thanh toán hiện tại), thu chi (ngày ghi sổ), kết quả nhân viên (ngày phát sinh). Không chốt doanh thu kế toán BR-OPEN-006. OWNER xem nhân viên; OWNER/thu ngân xem báo cáo tài chính. Tổng hợp toàn bộ bộ lọc cùng spa trước phân trang; CSV chỉ xuất tổng hợp.
GET /api/payroll view=salary thêm salarySummary: [{_id: DRAFT|APPROVED|PAID, count, total}] theo tháng/nhân viên trên toàn bộ dữ liệu. STAFF chỉ xem mình; danh sách nhân sự không gồm CUSTOMER. Không thay schema hoặc action chi lương. Buổi thiếu staffId không suy người thực hiện từ actorId. UI chung thẻ tổng hợp và liên kết Nhân viên/Bảng lương/Hoa hồng, thẻ mobile hai cột. Hai URL EasySalon chưa truy cập được trong phiên này.


## BR-LEAVE-001 — Thống kê nghỉ — 23/10/2026
CONFIRMED: nghỉ có phép/không phép chỉ để thống kê, chủ spa quyết định khi chốt lương; không tự động khấu trừ, thay lương hoặc hủy lịch. PROPOSED kỹ thuật: OWNER ghi/sửa ngày nghỉ; STAFF xem chính mình. Một ngày nguyên/người, chưa suy chính sách nửa ngày hay quy trình xin phép.
StaffLeave: spaId, staffId, staffName snapshot, day YYYY-MM-DD, type PERMITTED|UNPERMITTED, note, actorId, timestamps. Unique (spaId,staffId,day), index (spaId,day desc). Không xóa lịch sử audit.
POST /api/operations action recordStaffLeave {staffId,day,type,note?}: OWNER, cùng spa, nhân sự OWNER/STAFF; upsert theo người/ngày trong transaction guard có idempotency và audit before/after. Không ghi tài chính. GET /api/payroll view=salary thêm leaves (10/trang), leavePage, leaveTotal, leaveSummary [{_id:{staffId,type},count}], lọc tháng/nhân viên và phạm vi phiên trước tổng hợp/phân trang. UI trong Lương thống kê toàn tháng, danh sách ngày và nút ghi/sửa dành OWNER.


## Cập nhật ưu tiên mới nhất — 23/10/2026: nhập liệu, nghỉ và hoa hồng bán gói
Nguồn CONFIRMED: PROMPT CẬP NHẬT SPACARE trong phiên hiện tại. Thay thế BR-LEAVE-001 trước đó về chỉ thống kê: nay có duyệt, nửa ngày và cấu hình tính lương. Thay thế phạm vi cũ không có hoa hồng bán hàng bằng hoa hồng bán gói 5% trên thực thu đủ điều kiện; giữ nguyên hoa hồng thực hiện dịch vụ cố định.
CONFIRMED: OWNER duyệt và sửa bản nghỉ đã duyệt; có phép không đồng nghĩa hưởng lương; không suy ngày công từ lịch hẹn. OWNER cấu hình và chốt lương. Tiền lưu nguyên VNĐ, giao diện vi-VN. Không bắt mã sản phẩm, lý do/nội dung nhập kho; giữ dữ liệu lịch sử.
PROPOSED kỹ thuật đang áp dụng (không phải quy chế spa đã xác nhận):
- Bản nghỉ có startDay/endDay (gồm ngày cuối), period FULL/AM/PM cho mỗi ngày trong khoảng, type PERMITTED/UNPERMITTED, status PENDING/APPROVED/REJECTED, paid độc lập; reviewedBy/reviewedAt lưu lúc OWNER duyệt. STAFF gửi/sửa PENDING của mình; OWNER ghi/sửa mọi bản. Legacy thiếu status tiếp tục được xem là ngày đã ghi, paid=false, không bịa người duyệt. Không tính bản từ chối/chờ duyệt vào lương.
- Kiểm tra overlap theo ngày + sáng/chiều trong transaction Control chung. Nghỉ trùng công đã ghi bị từ chối; công không trùng nghỉ đang giữ chỗ; hai nửa khác buổi có thể cùng ngày. Công thực tế nhập bởi OWNER, không nhận ngày tương lai.
- Chính sách riêng từng người: standardDays, paidLeaveDays theo THÁNG, mode NONE hoặc DAILY. NONE/không cấu hình giữ lương tháng. DAILY yêu cầu OWNER xác nhận đủ dữ liệu công; earnedBase=round(baseSalary*min(standardDays,workdays+min(paidLeaveDays,nghỉ đã duyệt paid))/standardDays). Không tự coi thiếu lịch là nghỉ. Không tự tính OT, thuế, BHXH, phép tích lũy/năm. Giá trị 26 trong form chỉ gợi ý chưa lưu, không phải chính sách mặc định.
- Một Payroll hiện có: tổng = earnedBase + serviceCommissionTotal + saleCommissionTotal + bonus - deductions - advance; leaveDeduction chỉ là phần đã giảm trong earnedBase, không trừ lần hai. advance là khoản đã nhận do OWNER nhập, không ghi thêm dòng tiền; chưa có sổ tạm ứng riêng. Thiếu công khi DAILY trả lỗi. Lương âm bị từ chối, cần quy trình bù trừ riêng. Chốt kiểm tra fingerprint ngày nghỉ/công/chính sách và tập hoa hồng trước khi khóa. Sửa nguồn sau khi chốt không sửa bảng đã duyệt.
- Hóa đơn PACKAGE mới snapshot sellerId/sellerName tách consultant và performer. Không backfill người bán cho hóa đơn cũ. Giá đủ điều kiện là tổng giá bán sau giảm, phần đã thanh toán; cọc thực nhận sau khi phân bổ vào gói được tính một lần, không tính khi mới nhận cọc. Công thức cộng dồn floor((paid-refunded)/20), phát sinh delta nên chia đợt không sai làm tròn. Quà 0 và công nợ chưa thu không tạo hoa hồng bán.
- SaleCommission là ledger bổ sung để giữ nguyên unique index Commission dịch vụ cũ, không phải bảng lương thứ hai. Unique (spaId,sourceType,sourceId). Cùng payment/allocation/refund/reversal và idempotency/audit trong transaction. Điều chỉnh âm vào kỳ chưa chốt kế tiếp, không sửa khoản/bảng đã chi.
- refundPackage chỉ ghi hoàn ĐÃ THỰC HIỆN, OWNER xác nhận ngoại lệ và lý do. Không tự cho quyền hoàn khi khách dừng gói (BR-TRT-002 giữ), không dùng reverseCash làm hoàn tiền, không tự chuyển tiền. Cộng refunded riêng; paid giữ tổng đã thanh toán, không tái tạo công nợ từ tiền hoàn. Không tự đổi buổi/quyền lợi khi hoàn; điều kiện được hoàn và cách xử lý quyền lợi còn OPEN. REFUND không cho đảo bằng reverseCash thông thường.
- SKU cũ giữ nguyên khi sửa nếu không gửi; tạo mới sinh nội bộ SP-ObjectId, không phải trường nhân viên nhập. Phiếu kho vẫn chỉ số lượng như module đang có, chi mua hàng vẫn ghi riêng trong sổ thu chi; không thêm hoặc đổi chính sách giá nhập.
Cần xác nhận trước dùng tính lương thực tế: công chuẩn, hạn mức phép theo tháng hay năm/cộng dồn, cách làm tròn, OT/ngày lễ, quản lý sổ tạm ứng và bù trừ hoa hồng âm vượt lương; điều kiện ngoại lệ hoàn tiền/quyền lợi sau hoàn.


## Sửa lỗi đọc hóa đơn 0đ - 23/10/2026
Hóa đơn quà tặng/buổi liệu trình 0đ theo nghiệp vụ đã xác nhận: total=paid=0 có trạng thái PAID. Vẫn từ chối số âm, không nguyên và thanh toán vượt tổng. Không thay đổi dữ liệu hay tạo giao dịch thu tiền. Lỗi tải workspace phải hiển thị màn hình thử lại; chỉ phản hồi 401 mới hiển thị đăng nhập.


## BR-NOTIFY-001 — 23/10/2026
CONFIRMED: chủ spa nhận thông báo web/push khi khách đặt lịch online. PROPOSED: mỗi OWNER active cùng spa nhận một bản ghi/lịch trong transaction; retry cùng idempotency không ghi trùng. Backend xác thực active/role và scope người nhận/spa; chỉ đăng ký thiết bị khi người dùng chủ động cấp quyền. Push ngoài màn hình không chứa thông tin khách. Không suy thêm SMS/email/nhắc lịch. Chi tiết và giới hạn giao nhận: PUSH_NOTIFICATIONS.md.


## BR-STAFF-PHONE-001 — 23/10/2026
CONFIRMED: OWNER tạo nhân viên bằng họ tên, số điện thoại và mật khẩu; không yêu cầu email. Nhân viên dùng số điện thoại để đăng nhập. Quy tắc này thay yêu cầu email bắt buộc khi tạo nhân viên trước đây. Giữ kiểm tra OWNER/active/cùng spa, transaction/idempotency/audit và không ghi mật khẩu vào audit.
PROPOSED kỹ thuật: chuẩn hóa +84 về 0, bỏ khoảng trắng/dấu chấm/gạch/ngoặc; nhận 10–11 chữ số bắt đầu bằng 0. Phone unique toàn hệ thống tài khoản để đăng nhập không mơ hồ; không so với điện thoại hồ sơ Customer. Mật khẩu nhân viên giữ giới hạn hiện có 12–128 ký tự. Email tài khoản cũ vẫn đăng nhập được, không tự suy số điện thoại từ hồ sơ khách. Người dùng cũ chưa có số phải được OWNER nhập khi sửa.


## Bỏ ô tham chiếu ảnh chuyển khoản — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: bỏ trường nhập tham chiếu ảnh chuyển khoản trong form thu tiền hóa đơn; không bắt ghi chú thay thế. Quy tắc này thay yêu cầu ghi tham chiếu/ghi chú ảnh khi thu chuyển khoản trước đây. Vẫn bắt xác nhận đã kiểm tra tài khoản và thực nhận tiền, giữ quyền, trạng thái ngày, transaction, idempotency và audit. PROPOSED kỹ thuật: paymentEvidence dùng chung chỉ kiểm tra receivedConfirmation; transferReference vẫn là trường tùy chọn trong API/schema và giữ toàn bộ dữ liệu lịch sử. Không thay quy trình xác nhận buổi liệu trình/chữ ký; tham chiếu chi lương riêng không thuộc thay đổi này.


## Trạng thái sổ hôm nay và mở sổ lặp — 23/10/2026
PROPOSED kỹ thuật theo yêu cầu sửa lỗi danh sách trống nhưng mở sổ báo đã tồn tại: GET workspace thêm todayDay cho OWNER/thu ngân, query trực tiếp cùng spa/ngày Việt Nam và độc lập bộ lọc/phân trang. Trang days không áp dụng từ khóa search vì không có ô tìm kiếm; vẫn giữ lọc trạng thái/khoảng ngày. UI hiển thị rõ hôm nay chưa mở/đang mở/đã chốt; đã mở không hiện nút tạo thêm, đã chốt chỉ OWNER có Mở lại với lý do. openDay trên sổ OPEN trả sổ hiện có, không đổi tiền đầu ngày, không tạo sổ thứ hai; sổ CLOSED trả 409 và không tự mở lại. Giữ transaction, idempotency và audit snapshot thực tế. Không thay chính sách ai được mở/chốt/mở lại hoặc ghi đè dữ liệu lịch sử.


## Xuất PDF hóa đơn và hoa hồng - 23/10/2026
CONFIRMED: PDF để tải, in hoặc chia sẻ hóa đơn khách hàng và bảng kê hoa hồng theo nhân viên/tháng trên máy tính và điện thoại.
PROPOSED kỹ thuật: API chỉ đọc từ phiên active và cùng spa. OWNER xem phạm vi spa; STAFF giữ quyền đọc hóa đơn hiện có, chỉ xuất hoa hồng của mình. Không ghi tài chính hoặc xác nhận thu tiền/chi lương. Bảng kê lấy toàn bộ tháng theo giờ Việt Nam, tách dịch vụ/bán gói, giữ điều chỉnh âm.
## Sửa kiểm tra hoa hồng 0đ - 23/10/2026
PROPOSED kỹ thuật, giữ cấu hình dịch vụ hiện có: hoàn thành lịch chấp nhận hoa hồng nguyên VNĐ bằng 0; vẫn từ chối số âm/sai kiểu/vượt giới hạn. Giữ transaction, idempotency, audit và unique nguồn phát sinh; không đổi schema hoặc quyền API. Integration kiểm tra hoàn thành lặp chỉ có một hoa hồng 0đ, không sửa dữ liệu lịch sử.



## Liệu trình theo số buổi hoặc thời gian — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: danh mục có hai loại lựa chọn: SESSIONS nhập số buổi, TIME nhập thời hạn và không giới hạn số lần làm (ví dụ triệt 24/36 tháng). Thay thế phần chỉ hỗ trợ số buổi trước đây và chốt BR-OPEN-007 trong phạm vi này. Cả hai loại vẫn ký, ghi lịch sử từng lần, hóa đơn buổi 0đ và hoa hồng thực hiện theo quy tắc hiện có; tài chính mua gói vẫn riêng.
PROPOSED kỹ thuật: PackageTemplate/Treatment bổ sung packageType, durationMonths (1–120); TIME không lưu totalSessions/remaining, Treatment snapshot startsOn/expiresOn YYYY-MM-DD và usedSessions. Mặc định dữ liệu cũ thiếu packageType là SESSIONS, không backfill hay thay quyền lợi gói đã bán. Mốc từ ngày mua hay lần đầu vẫn OPEN: khi bán TIME (kể cả quà) phải chọn startsOn theo thỏa thuận, không tự mặc định. Hạn tính cộng tháng lịch, chặn ngày không tồn tại, kẹp cuối tháng; bao gồm ngày đầu/cuối theo giờ Việt Nam.
API packageTemplate/updatePackageTemplate nhận packageType + totalSessions hoặc durationMonths, không cả hai; sellPackage thêm startsOn bắt buộc nếu gói chính/quà thuộc TIME. Tạo/gửi lại vẫn transaction + idempotency + audit và cùng spa. use/invoice/completeTreatmentAppointment giữ remainingBefore: số buổi còn với SESSIONS, bộ đếm usedSessions với TIME để bắt xung đột chữ ký (0 ở lần đầu). Ghi TIME tăng usedSessions, không giảm quota hoặc tự COMPLETED. Backend chặn chưa bắt đầu/hết hạn/bảo lưu khi ghi lần làm và kiểm tra ngày dự định khi tạo/dời lịch. Bảo lưu không tự cộng hạn; OWNER gia hạn riêng như hiện có.
Giao diện danh mục chọn loại rồi hiện đúng ô; bán gói chọn ngày bắt đầu và xem hạn. Danh sách/thu ngân/lịch sử/khách hàng hiển thị hạn và không giới hạn thay số buổi. Không đổi indexes, không chạy migration dữ liệu vận hành.


## Hoa hồng chủ spa và thông tin khách — 23/10/2026
CONFIRMED: chủ spa trực tiếp bán gói cũng được ghi nhận và hiển thị hoa hồng bán gói 5% như nhân viên theo tiền thực thu đủ điều kiện. Giữ quy tắc cũ về thời điểm hưởng, hoàn/đảo và chống trùng; không tự backfill người bán hoặc hoa hồng lịch sử. Trang Hoa hồng thêm bộ lọc nhanh Của tôi cho OWNER; danh sách người hưởng gồm OWNER/STAFF.
GET /api/payroll view=commission và PDF hoa hồng bổ sung customerName/customerPhone từ Customer cùng spa, chỉ truy vấn customerId có trong các khoản hoa hồng đã lọc theo quyền, tháng và trang (PDF toàn bộ phạm vi xuất). STAFF chỉ xem khoản của mình, không nhận danh sách khách toàn spa hay ghi chú khách. Dữ liệu thiếu khách hiển thị Chưa ghi nhận. Không thay schema/index, số tiền hoặc trạng thái bảng lương.


## Chủ spa không tham gia lương/chấm công — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: Lương, chính sách lương, ngày công và nghỉ phép chỉ áp dụng cho STAFF; loại OWNER khỏi lựa chọn, danh sách, tổng hợp và phân trang. Chủ spa vẫn quản lý/duyệt/ghi chi lương nhân viên. Hoa hồng giữ OWNER/STAFF, chủ spa bán gói vẫn hưởng và xem hoa hồng theo quy tắc thực thu hiện hành. Nội dung này thay phần trước cho phép OWNER là người nhận lương/chấm công.
PROPOSED kỹ thuật: GET /api/payroll view=salary giao scope được phép với IDs STAFF cùng spa trước mọi count/aggregate/page; view=commission giữ phạm vi cũ. Backend từ chối cấu hình/lập/duyệt/chi bảng lương, ghi công/nghỉ và duyệt nghỉ của OWNER; không chỉ ẩn trên UI. Không xóa hay sửa bảng lương/chấm công/hoa hồng lịch sử; bản OWNER cũ được giữ trong database nhưng không đưa vào danh sách/tổng lương hiện hành. Không thay schema/index hoặc tự chuyển khoản hoa hồng chủ spa thành chi lương.


## Chia hoa hồng bán gói cho nhiều người tư vấn — 23/10/2026
CONFIRMED: bán liệu trình có nút + Người cùng tư vấn; tổng quỹ hoa hồng vẫn 5% tiền thực thu đủ điều kiện, chia đều cho những người được chọn, không phải mỗi người 5%. OWNER vẫn được tham gia và hiện hoa hồng nhưng không thuộc lương/chấm công. Chỉ chia hoa hồng bán gói, không thay hoa hồng thực hiện dịch vụ.
PROPOSED kỹ thuật: sellPackage nhận participantIds? (1–20 IDs không trùng, gồm OWNER/STAFF active cùng spa); nếu thiếu giữ tương thích sellerId hoặc user phiên. sellerId truyền kèm phải khớp phần tử đầu. Snapshot Invoice.saleParticipants=[{staffId,staffName}], giữ sellerId/sellerName đầu danh sách cho tương thích; không có action sửa nhóm sau bán, không backfill nhóm hóa đơn cũ.
Gói một người giữ saleCommissionVersion=1/SaleCommission. Nhiều người dùng version=2 và SharedSaleCommission bổ sung: spaId,staffId,staffName,invoiceId,serviceId,serviceName,customerId,category=PACKAGE_SALE,sharedSale=true,sourceType/sourceId,shareCount,amount,earnedAt,payrollId. Unique (spaId,sourceType,sourceId,staffId), index (spaId,staffId,earnedAt desc). Không đổi/xóa unique index ledger cũ. Khởi tạo bổ sung bằng npm run db:commission-shares (hoặc db:setup với cấu hình seed cũ); không chạy vào DB vận hành trong phiên sửa code.
Quỹ cộng dồn = floor((paid-refunded)/20). Phân số nguyên đồng: chia thương và dư theo staffId chuẩn hóa tăng dần (không phụ thuộc thứ tự chọn); mỗi người ghi chênh lệch quyền hưởng cộng dồn trước/sau sự kiện. Vì vậy thu nhiều đợt/đảo/hoàn có tổng và phần từng người đúng như thu một lần, lệch tối đa 1đ ở quyền hưởng cộng dồn. Không đổi người hưởng khi họ đổi tên/ngừng hoạt động sau bán.
Payment/Allocation/refund/reversal giữ transaction tuần tự, Control guard, idempotency, audit; ledger share ghi cùng transaction và snapshot invoice tổng accrued. Không tăng 5% theo số người, quà 0đ/công nợ chưa thu không phát sinh. Khoản điều chỉnh âm vào phần chưa chốt, không sửa bảng đã duyệt/chi.
Đọc hoa hồng/PDF/báo cáo union cả hai ledger với cùng scope người dùng/spa/tháng; STAFF chỉ xem phần của mình. Payroll thêm sharedSaleCommissionIds; tổng bán gói gồm cũ và chia, duyệt khóa IDs cả hai ledger, không đưa khoản của OWNER vào lương STAFF. Giao diện hiển thị số người chia và phần tiền của từng người, giữ thông tin khách. Preview lúc bán chỉ là dự kiến khi thu đủ.


## Sửa rollback nhóm tư vấn — 23/10/2026
PROPOSED kỹ thuật: saleParticipants dùng child Schema tường minh với _id=false, versionKey=false, strict=throw như schema cha. Tránh Mongoose track __v mặc định trên subdocument khi khôi phục transaction, làm StrictModeError che lỗi gốc. Giữ nguyên test lỗi giả lập Treatment.create và kiểm tra rollback Invoice/Audit/Idempotency; không nới strict hay thay dữ liệu nghiệp vụ. Không đổi field/index hoặc cần migration dữ liệu.


## Một bảng tổng hợp lương và công/nghỉ — 23/10/2026
Theo yêu cầu mới nhất: trang Lương chỉ có một bảng chung theo nhân viên/tháng, đủ lương cơ bản, công/nghỉ, lương tính, hai loại hoa hồng, thưởng/phụ cấp, phạt/khấu trừ, tạm ứng, tổng thực nhận, trạng thái và thao tác. Bỏ các khối cài lương/công/nghỉ độc lập trên trang chính; Công/nghỉ mở hộp quản lý riêng cho người được chọn, Cài đặt và Tính lương nằm trên dòng. Phạt vẫn là khoản deductions nhập tay có lý do, không tự đặt mức phạt.
PROPOSED kỹ thuật: GET payroll view=salary phân trang theo STAFF trong phạm vi, trả một dòng mỗi nhân viên (kể cả chưa có Payroll); chưa lập dùng status=NOT_CREATED, _id uncreated-ID chỉ phục vụ hiển thị, không ghi Payroll giả. Tổng thực nhận/lương theo công/thưởng/phạt chưa tính hiển thị Chưa tính hoặc dấu gạch, không giả thành 0. Preview hoa hồng lấy toàn bộ khoản chưa chốt đến hết tháng giống savePayroll, gồm tồn kỳ trước. Các tổng salarySummary vẫn chỉ cộng bảng lương đã lưu. Mọi tham chiếu cùng spa/quyền như trước.
Rows thêm currentWorkdays/currentLeaveStats cho công/nghỉ thực tế, tách khỏi snapshot đã tính lương; không thay đổi snapshot APPROVED/PAID khi nguồn công/nghỉ/hoa hồng thay đổi. Bấm Tính lương vẫn dùng transaction/idempotency/audit savePayroll và kiểm tra dữ liệu công theo chính sách. Không tự duyệt/ghi chi. Không đổi schema/index.


## Hiển thị thưởng và phạt trong bảng lương - 23/10/2026
CONFIRMED theo yêu cầu mới nhất: bỏ ba ô Lương nháp/Chờ chi/Đã chi trên trang Lương. Cột Thưởng tự hiển thị tổng hoa hồng dịch vụ + hoa hồng bán gói + thưởng/phụ cấp thêm; hai cột hoa hồng chỉ giải thích thành phần đã nằm trong thưởng, không cộng hai lần vào thực nhận. Chưa lập lương vẫn hiện hoa hồng tạm tính. Phạt/khấu trừ tự hiển thị deductions đã lưu trong bảng lương; chủ spa nhập khoản và lý do khi tính/cập nhật nháp. Không tự suy mức phạt từ nghỉ hoặc đi muộn, không thay snapshot đã duyệt/chi, schema, API hay công thức tài chính.


## Sửa hóa đơn chưa giao dịch - 23/10/2026
CONFIRMED: chỉ OWNER sửa hóa đơn SERVICE/PACKAGE chưa thu tiền, chưa áp cọc, chưa dùng gói hoặc phát sinh hoa hồng. updateInvoice kiểm tra quyền active từ DB, cùng spa, mọi lịch sử thanh toán/phân bổ kể cả đã đảo; kiểm tra cả gói quà, lịch hẹn liên kết và ngày lập chưa chốt. Không hỗ trợ sửa PRODUCT/SESSION/GIFT hay hóa đơn đã thực hiện.
API POST operations action updateInvoice: id, expectedUpdatedAt (ISO), description, total (>0), dueDate?, reason bắt buộc; PACKAGE thêm packageName, packageType và totalSessions hoặc durationMonths+startsOn. Giao diện sửa thông số theo loại gói hiện tại. Giữ khách/dịch vụ/người hưởng và quà tặng; thay tên/quyền lợi gói chính cập nhật Treatment cùng transaction, bỏ templateId vì quyền lợi đã tùy chỉnh. Không thay danh mục. Không thay schema/index. Control guard, idempotency, audit trước/sau hóa đơn và liệu trình; dữ liệu cũ trả 409. Không ghi thu chi.
