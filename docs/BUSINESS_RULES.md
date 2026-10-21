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
