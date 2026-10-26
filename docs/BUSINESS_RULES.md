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


## Khởi tạo chủ spa bằng số điện thoại — 23/10/2026
CONFIRMED theo yêu cầu người dùng: tài khoản chủ spa mới đăng nhập bằng số điện thoại và mật khẩu; cấu hình bằng SEED_OWNER_PHONE và SEED_OWNER_PASSWORD trong .env.local rồi chạy npm run db:setup.
PROPOSED kỹ thuật: dùng chuẩn hóa/validation số điện thoại hiện có, mật khẩu 12–128 ký tự và scrypt có salt. SEED_OWNER_EMAIL tùy chọn, giữ tương thích seed email cũ. Setup không cập nhật tài khoản có sẵn, không reset mật khẩu, không gắn thêm danh tính. Danh tính phải cùng khớp một OWNER active; trùng nhiều tài khoản/sai vai trò/ngừng hoạt động thì dừng. Không khớp danh tính nhưng database đã có User cũng dừng, tránh tạo thêm spa ngoài ý muốn. Tạo Spa/Control/User mới trong transaction tuần tự; chạy lại giữ nguyên tài khoản. Không thay schema/index, quyền API, session hoặc dữ liệu production. POST /api/auth/login đã nhận số điện thoại/email, không thay payload.


## Nhập danh mục thật và lịch chỉ ghi giờ đến — 24/10/2026
CONFIRMED: người dùng yêu cầu nhập danh mục Excel và chọn “Chỉ ghi giờ đến”. Không bắt thời lượng dịch vụ; lịch mới/dời lịch chỉ có startAt trong 09:00–22:00 giờ Việt Nam, không suy giờ kết thúc hay chặn nhân viên theo khoảng thời gian. Spa tự cân đối ca; cho phép nhiều lượt đến cùng giờ. Thay yêu cầu trước về chống chồng lịch/kín lịch bằng thời lượng. Giữ idempotency, quyền cùng spa, transaction, audit và lịch hoãn tạo bản mới. duration/endAt cũ giữ để tra lịch sử; dời lịch CONFIRMED bỏ endAt sau khi audit before, lịch POSTPONED cũ không đổi.
CONFIRMED: dịch vụ có hoa hồng cố định mỗi lần; triệt lông trong bảng có cả giá lẻ và gói TIME 36 tháng không giới hạn lượt, bắt đầu ngày mua (kể cả gói tặng cùng loại). Backend sellPackage dùng ngày Việt Nam tại giao dịch khi service.category=TRIỆT LÔNG và template TIME/36; không lấy startsOn do client gửi cho nhóm này. Gói khác giữ ngày thỏa thuận. Không backfill gói cũ.
PROPOSED kỹ thuật: đặt online tạm giao OWNER active đầu tiên, fallback nhân viên đầu tiên theo _id để spa sắp xếp lại; không coi đó là nhân viên đang rảnh. Timeline ô một mốc cho lịch mới, không biểu thị thời lượng; phản hồi đặt online không trả duration. Service create/update không bắt duration; trường legacy nếu gửi vẫn kiểm tra 5–480. Không đổi schema/index.
PROPOSED kỹ thuật: npm run db:import-catalog đọc XLSX trên Windows, tối đa 10 MB/1000 dòng, sheet đầu, không công thức; mặc định chỉ xem trước, không kết nối DB. --write yêu cầu --database khớp URI, chủ active xác thực lại bằng mật khẩu từ env (công cụ vận hành cục bộ, không phải endpoint công khai; không nhận spaId từ file). Không tạo session web mới; scope lấy từ User trong transaction. Một transaction cho toàn file, Control guard tuần tự, audit từng dòng và Idempotency catalog-v1 theo tên/nhóm chuẩn hóa. Chạy lại cùng nội dung bỏ qua; khác nội dung/trùng danh mục đang có thì dừng, không ghi đè. Không tạo hóa đơn/thu chi/công nợ hay khoản hoa hồng phát sinh.
Giá theo khoảng: thêm cột Giá mặc định (VNĐ), hoặc người chạy chủ động chọn --use-min-price. Đây là giá mặc định kỹ thuật, không chốt giá khách; khoảng gốc/ghi chú lưu trong Audit.details.source, chưa có field khoảng giá trong Service/UI. Triệt lông tạo Service giá lẻ từ cột Giá lẻ (VNĐ) hoặc ghi chú “Giá lẻ: ... đ/lần”, và PackageTemplate TIME/36 giá gói từ cột Giá từ/Giá đến. Hoa hồng 0 được giữ. Không nhập thời lượng giả. CLI không xóa/reset dữ liệu. Hướng dẫn: IMPORT_CATALOG.md.


## Chặn liên kết khách chưa xác minh — 24/10/2026
CONFIRMED: yêu cầu sửa lỗ hổng không cho nhận hồ sơ khách khác bằng tên/số điện thoại tự khai. PROPOSED kỹ thuật đang áp dụng: tạm đóng tự đăng ký (POST /api/auth/register trả 403 trước khi đọc body/kết nối DB/tạo session); /register hiển thị thông báo thay form. /customer chỉ hiển thị thông báo cho CUSTOMER, không truy vấn hoặc trả lịch sử kể cả có customerId cũ; OWNER/STAFF chuyển /workspace, chưa đăng nhập chuyển /login. Đây là biện pháp containment thay thế tạm thời dashboard CUSTOMER trong BR-CUSTOMER-001, không phải triển khai OTP. Không tự liên kết bằng tên/điện thoại, không tin các liên kết cũ là đã xác minh. Không xóa/sửa User, Customer, Session hoặc dữ liệu tài chính hiện tại; không đổi schema/index. Chủ spa vẫn nhập khách qua workspace. Muốn mở lại phải triển khai và kiểm thử quy trình xác minh/liên kết được duyệt, rà soát tài khoản cũ và các đường truy cập. Không rollback về bản có lỗ hổng; nếu rollback ứng dụng khác phải giữ bản vá này. Bản vá chỉ có hiệu lực trên web production sau khi được deploy.

Bản vá cũng từ chối đặt lịch bằng phiên CUSTOMER (403 trước khi mở transaction), tránh tiếp tục dùng customerId cũ chưa xác minh. Đặt lịch khách vãng lai và quản lý nội bộ giữ luồng hiện tại; không coi số điện thoại khách vãng lai là bằng chứng sở hữu hồ sơ.


## BR-CARD-001 — Thẻ tiền mặt khách hàng — 24/10/2026
CONFIRMED theo yêu cầu người dùng: khách mua riêng thẻ (ví dụ 800.000đ), phải thực trả đủ mới phát hành/dùng; dùng cho dịch vụ lẻ (ví dụ 400.000đ còn 400.000đ), không dùng mua gói hoặc sản phẩm. Thiếu số dư được thu thêm tiền mặt/chuyển khoản. Cả thẻ mua và thẻ tặng không hết hạn, không hoàn hoặc đổi tiền mặt. Khi bán gói có thể tặng thẻ với mệnh giá nhập riêng (ví dụ gói 3.000.000đ tặng thẻ 800.000đ); thẻ tặng không làm tăng tiền thực thu. Không đồng nhất thẻ với tiền cọc.
PROPOSED kỹ thuật: OWNER/STAFF có cashier được bán thẻ và phát hành quà cùng sellPackage; nhập đợt khuyến mãi khi tặng. Quà phát hành ngay trong transaction bán gói; chưa chốt quy chế riêng cho gói chưa thu đủ hoặc ngừng/hoàn gói có quà thẻ, nên không tự suy cách thu hồi/đổi giá trị. Bản đầu chặn refundPackage và updateInvoice khi đã phát hành thẻ tặng, để tránh mất đối chiếu; cần spa quyết định workflow xử lý ngoại lệ trước khi hỗ trợ. Bán thẻ chưa sinh hoa hồng bán gói 5%; hoa hồng dịch vụ giữ quy tắc thực hiện hiện hành. Không tự chốt doanh thu kế toán BR-OPEN-006.
PROPOSED kỹ thuật: dùng thẻ theo quyền thu tiền hóa đơn hiện có (OWNER/thu ngân hoặc STAFF phụ trách lịch); cùng spa và cùng khách, chỉ SERVICE hoặc hóa đơn legacy có serviceId và không có liên kết liệu trình. Nhân viên chọn thẻ, số tiền trừ và phần thu thêm, xác nhận trước lưu; không tự trừ chỉ vì mở hóa đơn. Mỗi lần dùng yêu cầu sổ hôm nay đang mở, transaction snapshot/majority với Control guard + Idempotency + Audit. Không âm số dư, không trả vượt công nợ, không dùng thẻ người khác, không ghi CashEntry cho phần trừ thẻ. Quy trình chuyển thẻ, nạp thêm, đảo sử dụng và sửa sai tiền mua thẻ còn OPEN; không triển khai hoàn bằng reverseCash.


## Trang thẻ tiền mặt tham khảo EasySalon — 24/10/2026
CONFIRMED: người dùng yêu cầu tham khảo https://my.easysalon.vn/cashcard để tổ chức giao diện thẻ. Đã quan sát trang danh sách rỗng, tìm theo tên/SĐT, cột mã/trạng thái/khách/số dư/hạn/thời gian và hộp Tạo mới. Chỉ mở/xem rồi hủy form, không tạo thẻ hay sửa dữ liệu ở hệ thống tham khảo. Yêu cầu mới thay thiết kế trước chỉ đặt thẻ trong hồ sơ khách bằng mục riêng Tài chính → Thẻ tiền mặt (/workspace/cash_cards). Giữ cả lối vào hồ sơ khách và thanh toán từ hóa đơn dịch vụ lẻ.
PROPOSED kỹ thuật: OWNER/thu ngân được mở danh sách toàn spa và tạo thẻ trả đủ qua action sellCashCard hiện có. STAFF thường không xem danh sách toàn spa, giữ quyền dùng thẻ theo hóa đơn được giao. Bảng gồm mã tự sinh từ ID (TM-ID), trạng thái theo số dư, tên/SĐT khách, mệnh giá, số tiền hiện tại, nguồn mua/tặng, Không thời hạn và ngày tạo theo giờ Việt Nam; tìm theo mã hoặc tên/SĐT, lọc nguồn/số dư, phân trang 10 dòng ở backend, chi tiết thẻ chỉ hiện lịch sử đúng cardId. Bộ lọc/trang lưu trên URL cardSearch/cardStatus/cardOrigin/cardPage. Mobile cuộn trong bảng, không tràn toàn trang.
Không suy chính sách mới từ EasySalon: không tự thêm hết hạn, bảo lưu, đồng sở hữu, nạp thêm, hoàn/đổi tiền; không tạo thẻ 0đ ngoài luồng quà bán gói. API GET /api/cash-cards thêm view=list&search=&status=AVAILABLE|EXHAUSTED&origin=PURCHASE|GIFT&page=1; bắt OWNER/STAFF cashier ở backend, spaId lấy từ phiên, lookup khách cùng spa chỉ trong trang kết quả, regex tìm kiếm được escape. GET hiện tại thêm cardId? để giới hạn thẻ và ledger cùng khách/spa; không thay quyền STAFF. Không thay schema/index/transaction hay dữ liệu đang dùng. Rollback UI/API list không xóa thẻ hoặc số dư và phải giữ các guard tài chính hiện có.


## Nhóm dịch vụ và chọn dịch vụ cho gói — 24/10/2026
CONFIRMED theo yêu cầu người dùng: form thêm/sửa dịch vụ chọn nhóm có sẵn, có tạo nhóm riêng; form tạo gói mẫu phải chọn dịch vụ đã khai báo. Form hóa đơn/bán gói có lọc nhóm, gói hiển thị tên dịch vụ đi kèm. PROPOSED kỹ thuật: ServiceGroup {spaId,name,nameKey,actorId,timestamps}, unique (spaId,nameKey); nameKey chuẩn hóa NFC/khoảng trắng/chữ thường, giữ dấu tiếng Việt. OWNER tạo nhóm qua operations action serviceGroup {name}, xác thực lại active/role DB, scope từ phiên, Control guard/transaction/idempotency/audit; kiểm tra trùng cả registry và category legacy. Không tự thêm quyền cho MANAGER/STAFF. Chưa có sửa/xóa nhóm.
Service.category vẫn là chuỗi, không đổi schema dịch vụ hoặc chuyển dữ liệu cũ. Danh sách chọn nhóm hợp nhất ServiceGroup.name và Service.category cũ cùng spa; nhóm chưa có dịch vụ vẫn được lưu. Nhập nhóm mới trong form dịch vụ lưu category khi lưu dịch vụ; lần sau có thể chọn lại từ category này. Không tự sao chép danh mục spacare_live sang spacare_dev. Form Thêm gói mẫu dùng select nhóm option theo dịch vụ active; nếu danh mục dev trống hiển thị hướng dẫn thêm dịch vụ trước và chặn lưu form rỗng. Sửa gói cũ vẫn hiển thị dịch vụ ngừng đã gắn, backend giữ kiểm tra active hiện có.
GET workspace thêm serviceGroups [{_id,name}] cho OWNER tại services/package_catalog; truy vấn cùng spa. Bổ sung script db:service-groups chỉ tạo collection/index mới trong spacare_dev/spacare_test, từ chối production/Vercel production; không chạy trong phiên sửa code. Production cần duyệt bước tạo index riêng, không chạy db:setup để cập nhật tính năng. Rollback không xóa category/nhóm/dịch vụ; không cần backfill.


## Áp thẻ ngay khi tạo hóa đơn — 24/10/2026
CONFIRMED theo yêu cầu người dùng: khi tạo hóa đơn dịch vụ lẻ có thể chọn thẻ tiền mặt hiện có của đúng khách và áp dụng ngay. Giữ giới hạn chỉ dịch vụ lẻ, không áp cho mua gói/sản phẩm/buổi liệu trình. Chọn thẻ là tùy chọn, không tự trừ chỉ vì khách có thẻ.
PROPOSED kỹ thuật: invoice nhận cashCard? {cardId,amount,additionalAmount?,method?,receivedConfirmation?}; tạo Invoice và gọi cùng logic redeemCashCard tuần tự trong một transaction với Control guard, idempotency và audit hiện có. Số dư/khách/spa/công nợ/quyền/sổ ngày được kiểm tra lại ở backend; lỗi bất kỳ rollback cả hóa đơn, số dư, ledger và phần thu thêm. Phần thẻ chỉ tăng paid/cardPaid, không tạo dòng tiền; chỉ phần thu thêm tạo Payment/CashEntry và phải xác nhận thực nhận. UI Thu ngân và form Tạo hóa đơn dùng danh sách thẻ phân trang của khách, không mặc định chọn, hiện số dư/công nợ sau thanh toán. Đổi khách/dịch vụ/giá hoặc dùng liệu trình bỏ lựa chọn cũ. Không đổi schema/index, không migration hay sửa dữ liệu cũ/production. Rollback giao diện không xóa ledger, phải giữ backend hiểu paid/cardPaid và guard CARD_SALE.


## Nhập số dư lịch sử — 24/10/2026
CONFIRMED: người dùng cung cấp bảng khách, xác nhận thêm 0 đầu SĐT, tiền ghi thiếu 000 được hiểu theo nghìn đồng, các dòng trống thuộc khách ngay phía trên; Gđ là Gội đầu, Cơ bản là Mặt cơ bản, dương sinh là dưỡng sinh. Số buổi là còn lại; các liệu trình đã trả đủ. 23 khách, 29 liệu trình/107 buổi, 4 thẻ còn 12.950.000đ, riêng nợ mỹ phẩm 7.000.000đ. Dữ liệu cá nhân nguồn chỉ lưu imports/ bị Git bỏ qua. Người dùng yêu cầu hoàn thiện công cụ rồi nhập live; chưa ghi production trong phiên.
PROPOSED kỹ thuật: CLI import-opening-balances mặc định preview ngoại tuyến. --check chỉ đọc DB với OWNER active xác thực lại; so sánh cùng spa, khớp tên dịch vụ NFC/khoảng trắng/chữ thường còn dấu hoặc mapping ID được duyệt. Không tự tạo dịch vụ thiếu, không gộp hồ sơ khác tên cùng SĐT, không cộng đè quyền lợi/thẻ/công nợ có sẵn. --write cần database khớp URI và dữ liệu nguồn, mã đợt ổn định, --approve hash báo cáo đối chiếu và --app-ready xác nhận code tương thích đã deploy; Control guard/transaction snapshot+majority tuần tự, batch Idempotency unique, audit ID các bản mới. Kiểm tra collection/index trước nhập, không tự setup/index vào production. Chỉ cho spacare_live/dev/test, không đổi URI.
Schema bổ sung không backfill/index mới: Invoice.openingBalance/openingDate; Treatment.openingBalance/openingRemaining; CashCard.origin thêm OPENING, openingDate/sourceLabel. Gói nguồn tạo chứng từ liên kết PACKAGE tổng=paid=0/status PAID với nhãn đã trả đủ trước chuyển đổi, không coi 0 là giá mua gốc hay quà tặng. Treatment chỉ remaining/openingRemaining, không bịa totalSessions, startsOn giữ ngày nguồn, chưa có expiresOn; báo cáo duyệt cảnh báo gói được dùng theo số buổi, chưa xác định hạn gốc. Số buổi mới đánh từ 1 kể từ chuyển đổi bằng usedSessions; không tái tạo buổi/chữ ký/hoa hồng cũ. Thẻ OPENING amount=balance=số dư chuyển, không phải mệnh giá gốc hoặc khoản thu mới; không tự tách phần mua/quà. Nợ cũ chứng từ PRODUCT không productId, không xuất kho, total=số còn nợ/paid=0; thu sau bằng payment hiện hành và không có hoa hồng bán gói. Không tạo CashEntry/Payment/Commission/SaleCommission lúc chuyển số dư; buổi thực hiện sau chuyển đổi vẫn hưởng theo quy tắc hiện hành.
UI/PDF ghi rõ chứng từ chuyển số dư, tổng gốc chưa có, 0 chỉ nghĩa không thu thêm; không hiển thị tiến độ dựa trên tổng buổi chưa biết. updateInvoice/refundPackage chặn chứng từ chuyển số dư. API operations không mở action import công khai; CLI xác thực OWNER từ DB. Rollback trước commit tự động toàn đợt; sau commit dùng báo cáo IDs/audit đối soát và kế hoạch sửa được chủ duyệt, không xóa/reset/restore tự động. Không quay về code không hiểu openingBalance/OPENING sau có dữ liệu; giữ patch tương thích hoặc khóa ghi. Backup và kiểm tra deploy trước ghi thật.


## Tên viết tắt khi chuyển sổ liệu trình gội — 24/10/2026
CONFIRMED theo yêu cầu mới nhất: GD/Gđ là Gội đầu cấp collagen (thay cách hiểu Gội đầu chung trước đó); GDDS là Gội đầu dưỡng sinh 1; CVG là Cổ vai gáy; MASK là thêm mặt nạ. Không tự suy giá, hoa hồng hoặc coi mặt nạ thêm kèm là một liệu trình độc lập. Ánh xạ dữ liệu nhập phải đối chiếu đúng ID dịch vụ trước ghi; không đổi tên danh mục hay quyền lợi cũ trên live.

Xác nhận mới nhất 24/10/2026: CSD và ghi chú +1 buổi CSD đều chỉ dịch vụ Chăm sóc da cơ bản (thay tên Chăm sóc da chung trước đó). Không tự cộng buổi khi chưa đọc đủ từng dòng nguồn; không tính buổi thêm này thành GD/GDDS.


## Gộp bảng mặt và gội — xác nhận 24/10/2026
CONFIRMED: Yến Thương giữ 1 buổi Mặt cơ bản và 11 buổi Gội đầu dưỡng sinh 1; dòng GD 11 trong bảng gội là cùng quyền lợi, không cộng lần hai. Ng T Lệ Quyên còn 1 buổi Gội đầu cấp collagen và được tặng 1 buổi Laser Carbon. Khách thiếu SĐT giữ trống, không tự tạo số giả hoặc nhận SĐT khách phía trước.
PROPOSED kỹ thuật: openingInput.phone cho phép thiếu/null/chuỗi rỗng và chuẩn hóa thành undefined; duplicate detection chỉ kiểm số có thật. Khách thiếu SĐT không tự gộp với bất kỳ hồ sơ thiếu số khác, cùng tên có sẵn hoặc trùng tên trong nguồn phải đối chiếu riêng; tạo Customer không có field phone. Mã batch vẫn bảo vệ retry. Treatment input thêm gift/benefitNote tùy chọn, giữ quyền lợi mặt nạ thêm kèm trong tên liệu trình/chứng từ và audit, không cộng thành buổi gội hay tự đặt giá. Gói GD+CVG giữ nhãn kết hợp và phải ánh xạ với danh mục thực tế trước ghi. Gộp ngoại tuyến ra imports/opening-combined.review.json: 84 khách, 93 dòng quyền lợi/319 buổi, 6 thẻ số dư 14.310.000đ, riêng nợ mỹ phẩm 7.000.000đ; 3 khách chưa có số. Loại 3 dòng quyền lợi lặp và 1 thẻ lặp; lưu provenance hai nguồn trong file review bị Git bỏ qua. Chưa đối chiếu/ghi live.

Xác nhận đã cung cấp ngày 24/10/2026 (được người dùng nhắc lại): Meso nám → Tranacix, Meso phục hồi → Exocode; bảng ghép ngang Mặt cơ bản/CSD cơ bản → Chăm sóc da thư giãn, Nặn mụn cơ bản → Chăm sóc da mụn cơ bản, GD cổ vai gáy/GD collagen + CVG → Gội Massage CVG 1, Laser Carbon → Lazer cacbon đã được xác nhận. Chỉ chuẩn hóa nguồn nhập, không sửa danh mục hoặc quyền lợi có sẵn trong database.


## Optional appointment performer (2026-10-25)
CONFIRMED user request: appointment creation permits omitted staffId (unassigned); a supplied staffId must reference active OWNER/STAFF in the authenticated spa. Appointment.staffId is optional. CompleteAppointment and completeTreatmentAppointment accept optional staffId to assign an unassigned visit before recording performance, commission or signed treatment use, in the existing transaction with idempotency and audit. Existing assigned visits retain their performer. PROPOSED technical handling: unassigned visits remain visible/manageable to owner/cashier under existing scope; ordinary staff scope is unchanged. Rescheduling still requires an assigned performer.


## Multi-service cashier invoice (2026-10-25)
CONFIRMED user request: checkout can select multiple standalone services in one invoice.
`serviceInvoice` (OWNER/cashier only): customerId, staffId, items [{serviceId,total?}], dueDate?, cashCard?. Backend validates the current account and every reference against the authenticated spa, rejects inactive services/performers, duplicate services, empty lists, more than 30 lines, nonpositive prices and aggregate money overflow. Prices default to the current service price. No packages, products, or treatment sessions are combined by this action.
Invoice.serviceItems stores immutable serviceId/name/total/fixed-commission snapshots. Invoice total and commission are computed by the backend. A multi-service invoice omits top-level serviceId; a single-line invoice retains it for compatibility. Both are kind SERVICE. Existing invoices remain readable without migration.
PROPOSED technical handling: one selected performer completes all selected services. One Commission record per invoice holds the summed fixed commission and combined service names (serviceId optional for bundles); item-level amounts remain in Invoice.serviceItems. Checkout records performedBy/performedAt immediately, following the completed-service cashier flow. No package sales commission is generated.
The existing transaction commits invoice, commission, optional cash-card debit/additional payment, audit and idempotency together. All transaction writes remain sequential. Cash cards may pay standalone serviceItems; existing package/product/session exclusions remain. Standard payment/deposit operations apply to the combined invoice balance. Detail and PDF show each service/amount separately. Completed invoices retain existing edit restrictions.


## Product origin and dates (2026-10-25)
User request: product create/edit includes origin, manufacturedOn and expiresOn. All three fields are optional for existing/unknown metadata. Origin is trimmed text up to 200 characters; dates are real calendar YYYY-MM-DD strings, and expiry cannot precede manufacture when both are provided (technical validation). Product schema, product/updateProduct actions and product list expose these values under existing owner edit permissions and spa scope. Empty form values clear metadata. Dates currently describe the catalog product, not individual inventory batches. No automatic expiry-based stock changes, sales restriction or expiry alerts are introduced.


## Public multi-service booking and free minute arrival (2026-10-25)
CONFIRMED user request: public booking allows multiple services and choosing arrival hour/minute rather than 30-minute presets. The form uses checkbox selections, a combined estimated total and a native time input with 60-second steps. Opening hours remain 09:00-22:00 Vietnam time; past/out-of-hours requests remain invalid. Arrival time does not reserve a duration or imply staff capacity.
POST /api/booking accepts serviceIds (1-30 unique service IDs), or legacy serviceId, but not both. The first service identifies the spa; every subsequent service must be active and in that same spa. Client spaId/staffId/price are never trusted. One Appointment is created with requestedServices [{serviceId,name}] snapshots and legacy primary serviceId. One owner notification contains all requested names. All writes and idempotency remain in the existing transaction.
Internal list, timeline and customer history display all requested names. Postponed replacement appointments copy requestedServices. Completing a multi-service visit creates one SERVICE invoice with serviceItems, current catalog prices and the sum of fixed service commissions; one performer and one commission entry cover the visit, as in cashier bundles. The multi-service completion form does not offer a single-service price override or unrelated invoice linkage. Legacy single-service completion is unchanged. No new invoice is generated while the client is only booking.


## Notification expansion (2026-10-25)
CONFIRMED user request supersedes owner-only booking notification behavior:
- Push carries the saved title/body (guest, phone, selected services and arrival time for online bookings), with a bounded preview and a link to full details.
- New online bookings notify all active OWNER/STAFF in the same spa. STAFF may read public booking records through bookingSource=PUBLIC_WEB, in addition to their own appointments. This does not grant completion, reschedule, cancellation, invoice or financial rights over another staff member's work. Rescheduled replacement public bookings retain bookingSource.
- Newly created invoices from operational actions notify active owners only. The notification contains customer, invoice description/total, creator and invoice link. Queuing is atomic with invoice/commission/payment/audit/idempotency. Imports of opening balances do not produce a new-sale notification. Retries do not duplicate committed events.
- Daily closing reminders target owners at 22:00 Vietnam time if that day's Day is missing or not CLOSED. They do not open/close a book automatically. They are deduplicated per spa/owner/day under the shared Control transaction guard. A fresh closed-day check suppresses unsent reminders; closeDay marks outstanding reminders read/sent within the closing transaction.
PROPOSED technical storage: Notification retains legacy booking notifications and indexes; ActivityNotification is a separate generalized outbox for INVOICE_CREATED and DAY_CLOSE, with userId, eventKey, kind, optional invoiceId/day, title/body/url, readAt, pushState, nextAttemptAt and attempts. Unique index (spaId,userId,eventKey), inbox index (spaId,userId,createdAt), dispatch index (pushState,nextAttemptAt). Additive setup through npm run push:db creates the new collection/indexes; no history deletion or legacy index replacement.
GET/POST /api/notifications authenticate active OWNER/STAFF and scope every inbox/device read/write to the current spa/user. STAFF only read booking notifications; owner inbox merges booking and financial/reminder events. Device subscriptions still require explicit browser permission. Invalid/expired subscriptions are removed; transient push failures retain the lease/backoff queue. Background sending uses after() once operational writes commit.
GET /api/notifications/daily-close is protected by constant-time CRON_SECRET Bearer authentication, uses no-store, enqueues missing reminders and dispatches pending pushes. vercel.json schedules 0 15 * * * (UTC), which is 22:00 Vietnam time. Requires CRON_SECRET in the Vercel production environment and a new production deployment. Vercel Hobby does not guarantee minute precision: delivery invocation can be 22:00-22:59; exact scheduled-minute execution requires a suitable scheduler/plan. External schedulers can call this same authenticated endpoint. Reference: https://vercel.com/docs/cron-jobs/usage-and-pricing .


## Ten-minute reminders and readable invoice codes (2026-10-25)
CONFIRMED user request: notify ahead of appointments by ten minutes; emphasize invoice service/payment/status text and amounts; show invoice codes as HD plus digits.
Appointment reminders: ActivityNotification adds APPOINTMENT_REMINDER, appointmentId and appointmentStartAt. The scheduler scans CONFIRMED appointments where now < startAt <= now+10min, rechecks inside the spa Control transaction, and deduplicates eventKey appointment:<id>:<startAt ISO> per recipient. Public visits notify all active owners/staff of that spa; internal visits notify owners and assigned staff only. A new start time can produce a new reminder, but canceled/postponed/completed/expired or reassigned visits are checked again before push. Reminder TTL is capped at arrival (at most 600 seconds). If booked less than ten minutes ahead, notify on the next check rather than invent a full ten-minute interval.
GET /api/notifications/dispatch now queues due appointment reminders before sending; it still requires CRON_SECRET Bearer authentication. Call it once per minute from an external scheduler or configure a suitable Vercel plan. Default vercel.json keeps its Hobby-compatible daily closing job; it does not enable a per-minute cron that would break Hobby deployments. Inbox polling and booking/operation callbacks also check nearby appointments, but cannot guarantee background reminders when no client is open. No external scheduler has been provisioned by this code change. STAFF inbox now includes only booking notifications and APPOINTMENT_REMINDER activity events; invoice/closing activity remains owner-only, including read/readAll operations.
PROPOSED technical code scheme: Invoice.code (HD plus a per-spa sequence padded to six digits), unique partial index (spaId,code). Control.invoiceSequence increments inside the existing invoice transaction, rolls back on failure and is not incremented on idempotent replay. MongoDB ObjectIds remain unchanged in URLs and references. Old invoice metadata is backfilled using npm run db:invoice-codes, which creates indexes and serializes each spa migration under Control; it preserves existing codes and financial values, and resumes after the greatest assigned sequence. Until backfill, a deterministic full numeric ObjectId fallback is displayed without truncation. No live backfill has been run by these source changes. Invoice lists, detail, PDF and new invoice notifications use the shared display formatter; code is searchable in invoice lists.


## Hủy hóa đơn chưa thanh toán — 25/10/2026
CONFIRMED theo yêu cầu người dùng: OWNER được hủy hóa đơn nhập sai chưa thanh toán để không cộng công nợ; giữ chức năng sửa hóa đơn chưa giao dịch. Không xóa cứng lịch sử.
PROPOSED kỹ thuật: cancelInvoice {id, expectedUpdatedAt, reason} dùng phiên active/cùng spa, quyền OWNER, transaction Control guard, idempotency và audit before/after. Dùng cùng điều kiện an toàn với updateInvoice: chỉ SERVICE/legacy/PACKAGE chưa thực hiện, chưa liên kết lịch/buổi, không phải quà hay chứng từ mở đầu; không có lịch sử Payment/Allocation/CashCardUse/hoa hồng, hoàn tiền hoặc thẻ tặng; gói và quà chưa dùng/chưa có lịch, ngày lập chưa chốt. Sai phiên bản trả 409. Hủy cả họ hóa đơn/quà và liệu trình liên quan trong transaction tuần tự. Invoice.status=CANCELLED, cancelledTotal giữ giá trị trước hủy, total=0/paid=0 để mọi tổng hợp công nợ và giá trị hóa đơn hiện tại không tính khoản đã hủy; cancelledAt/cancelledBy/cancelReason lưu dấu vết. Giá trị trước hủy chỉ để đối chiếu, không phải tiền đã thu/hoàn. Treatment.status bổ sung CANCELLED; không xóa số buổi lịch sử. Không tạo dòng tiền hay hoàn tiền. Mọi thao tác ghi tham chiếu hóa đơn hủy bị backend từ chối. Không migration/index hoặc ghi dữ liệu vận hành trong phiên triển khai. Hóa đơn đã thực hiện/hoa hồng hoặc xuất kho dù chưa thu tiền vẫn cần quy trình xử lý riêng, chưa hỗ trợ hủy trực tiếp.


## Sửa/hủy dịch vụ đã thực hiện nhưng chưa thanh toán — 25/10/2026
CONFIRMED theo yêu cầu mới nhất: chỉ OWNER được sửa/hủy hóa đơn dịch vụ chưa thanh toán kể cả đã ghi nhận thực hiện/hoa hồng; thay hạn chế trước về performedAt/appointmentId đối với dịch vụ lẻ. STAFF kể cả cashier bị từ chối tại backend. Giữ chặn lịch sử tiền/cọc/thẻ, chứng từ mở đầu, buổi liệu trình và hóa đơn gói đã dùng. Không thay quyền các nghiệp vụ khác.
PROPOSED kỹ thuật: updateInvoice sửa nội dung, tổng tiền dương, hạn trả; giữ khách, dịch vụ, người thực hiện và hoa hồng cố định. serviceItems phân bổ tổng giá mới theo tỷ lệ giá snapshot với số nguyên/BigInt, phần lẻ chia theo thứ tự dòng, không dùng giá danh mục hôm nay. Không hỗ trợ đổi danh mục dịch vụ/nhân viên qua form này. cancelInvoice đưa Commission chưa gắn payrollId về 0, giữ bản ghi và snapshot trước hủy trong Audit; nếu hoa hồng đã thuộc bảng lương duyệt/chi thì chặn hủy với lý do rõ ràng, không sửa bảng lương đã khóa. Sửa giá không thay hoa hồng cố định kể cả đã chốt lương. Giữ lịch hẹn/thời điểm thực hiện để đối chiếu; hủy hóa đơn không tự hủy lịch hay tạo lượt phục vụ mới. Không migration/index hoặc ghi dữ liệu vận hành. Mọi cập nhật trong transaction tuần tự, kiểm tra phiên bản và idempotency hiện có.

Bổ sung theo xác nhận tiếp theo: hủy phải loại hoa hồng và số liệu khách tương ứng; sửa tự cập nhật số liệu. updateInvoice nhận items? [{serviceId,total}] (1–30, không trùng, active/cùng spa, tổng khớp total). Form sửa dịch vụ chọn lại dịch vụ và giá từng dòng, backend tự kiểm tra tổng; giữ người thực hiện. Đổi dịch vụ cập nhật tên/snapshot và hoa hồng cố định từ danh mục cho dịch vụ mới, dịch vụ không đổi giữ mức snapshot cũ. Chỉ đổi giá không đổi hoa hồng cố định. Hoa hồng đã chốt lương không được đổi giá trị; trả 409 nếu thay dịch vụ làm đổi hoa hồng. Commission.cancelledAt mới đánh dấu bản ghi hủy, amount=0; danh sách/thống kê hoa hồng và tập lấy vào bảng lương loại cancelledAt, không xóa cứng. Hồ sơ khách giữ lịch sử hóa đơn hủy nhưng không tính số hóa đơn hiệu lực/công nợ; gói hủy không tính gói đang dùng. Lịch sử lịch hẹn vẫn giữ sự kiện khách đã đến, không tự xóa lần đến. Không thêm index/backfill.


## Xóa vĩnh viễn hóa đơn nhập nhầm chưa phát sinh — 25/10/2026
CONFIRMED theo yêu cầu mới nhất: chỉ OWNER được xóa hẳn hóa đơn nhập nhầm đã hủy, chưa thanh toán/áp cọc/thẻ, chưa phát sinh hoa hồng, thực hiện, lượt dùng hoặc liên kết vận hành. Ngoại lệ này thay quy tắc giữ mọi hóa đơn hủy trước đó; không cho xóa lịch sử tài chính hoặc dữ liệu đang được tham chiếu. Hồ sơ khách giữ nguyên.
PROPOSED kỹ thuật: deleteInvoice {id,expectedUpdatedAt,reason,confirmDelete:true}. Backend xác thực active OWNER/cùng spa, trạng thái CANCELLED, phiên bản mới nhất. Chặn openingBalance; paid/cardPaid/refunded/saleCommissionAccrued; performedAt/performedBy; appointmentId/treatmentId/treatmentUseId/giftOfInvoiceId/productId; kind PRODUCT/SESSION/GIFT. Kiểm tra Payment, Allocation, CashCardUse, Commission (kể cả đã hủy/0đ), SaleCommission, SharedSaleCommission, StockMovement, Treatment theo invoiceId/giftOfInvoiceId, hóa đơn quà và CashCard nguồn. Bất kỳ tham chiếu nào đều chặn 409, không cascade. Ngày lập đã chốt phải mở lại. Xóa Invoice và thông báo INVOICE_CREATED tuần tự trong transaction Control snapshot/majority; giữ audit/idempotency và nhật ký cũ, không sao chép thêm hóa đơn. Retry cùng khóa không xóa lại. Không tái dùng mã/giảm sequence. UI OWNER có Xóa vĩnh viễn ở danh sách/chi tiết hóa đơn hủy; bắt lý do và tích xác nhận không thể khôi phục. Không schema/index/migration mới; không xóa dữ liệu vận hành trong phiên triển khai.


## Xem trước đối chiếu chốt sổ — 25/10/2026
CONFIRMED theo yêu cầu người dùng: tiền mặt kỳ vọng hiện khi sổ OPEN; nhập tiền kiểm đếm được xem trước thừa/thiếu trước khi xác nhận chốt. Không tự tạo khoản cân sổ, không thay quyền mở/chốt/mở lại.
PROPOSED kỹ thuật: GET workspace section=days bổ sung liveExpected,cashIn,cashOut,liveBankNet cho từng ngày OPEN trong trang bằng aggregate toàn bộ CashEntry cùng spa/ngày, không dùng danh sách giao dịch đã phân trang hoặc bộ lọc thu chi khác. Đảo sai sót tính cả gốc và bút toán đối ứng, không bỏ gốc reversed. CLOSED giữ snapshot đã chốt. OPEN/reopened không hiển thị counted/difference cũ như số mới. Không ghi Day khi xem. Form closeDay xem đầu ngày/thu/chi/kỳ vọng, nhập counted và hiển thị chênh lệch; submit gửi expectedPreview? (số nguyên, tùy chọn tương thích client cũ). Backend tính lại trong transaction và trả 409 nếu khác expectedPreview, trước khi lưu/audit/đánh dấu thông báo; client tải lại, yêu cầu mở lại đối chiếu. Giữ idempotency và audit hiện có. Không schema/index/migration hay ghi dữ liệu vận hành trong phiên triển khai. Số tạm tính phản ánh lúc tải, không cam kết realtime; đóng sổ vẫn kiểm tra lại ở backend.


## Xóa hóa đơn đã thu, nhập ngày hóa đơn, lịch gói và dịch vụ thêm — 25/10/2026
CONFIRMED yêu cầu mới nhất thay giới hạn chỉ xóa hóa đơn hủy chưa thanh toán: OWNER được xóa hóa đơn nhập sai đã thu và trừ số liệu liên quan. Hóa đơn có ngày tùy chọn, mặc định hiện tại; dùng gói 0đ có thể thêm dịch vụ lẻ phải trả trong cùng hóa đơn. Khi đặt lịch, chọn khách thấy các gói khả dụng của khách và chọn gói tự chọn dịch vụ; dịch vụ chọn bằng ô lớn.
PROPOSED kỹ thuật: deleteInvoice giữ active OWNER/phiên bản/idempotency/transaction; xử lý cả invoice và họ quà. Khoản Payment chưa đảo được đánh dấu reversed và có CashEntry REVERSAL OUT ngày hiện tại với originalId unique (không ghi là hoàn tiền thực tế); cần sổ hiện tại OPEN nếu có tiền. Allocation chưa đảo trả balance cọc; CashCardUse chưa đảo trả balance thẻ và lưu reversedAt; hoa hồng chưa gắn payrollId đưa về 0, Commission đánh dấu cancelledAt. Phiếu xuất bán được bù phiếu nhập MANUAL có audit; gói chưa dùng chuyển CANCELLED, thẻ tặng chưa dùng về 0. Xóa bản ghi hóa đơn chính, giữ lịch sử tiền/kho/audit/idempotency; thông báo tạo hóa đơn được gỡ. Hóa đơn quà giữ CANCELLED/0đ. Chặn chứng từ mở đầu, buổi đã ký, gói có lượt ký, gói còn lịch chờ, thẻ tặng đã dùng, hóa đơn đã hoàn và hoa hồng đã chốt/chi lương; không xóa dây chuyền các bằng chứng đó. Đây là giới hạn triển khai hiện tại, chưa phải hỗ trợ mọi ngoại lệ. Không reset dữ liệu thật.
issuedOn? YYYY-MM-DD chỉ nhận ở invoice/serviceInvoice/sellPackage/sellProduct; backend kiểm ngày thật/không tương lai. Khi có ngày, Invoice.createdAt dùng 12:00 giờ Việt Nam của ngày chọn để tra/báo cáo theo ngày; recordedAt giữ thời điểm nhập thật. Không có ngày giữ thời gian hiện tại. Thu tiền/cọc vẫn theo ngày thực ghi hiện tại, không backdate tiền. Gói triệt 36 tháng tính ngày mua đã chọn. Không tự backdate chữ ký/thực hiện/hoa hồng lịch sử.
invoice thêm additionalServices? [{serviceId,total}] tối đa 30, không trùng, dịch vụ active/cùng spa, giá dương. Nhánh treatmentId ghi buổi có chữ ký như cũ rồi trong cùng transaction thêm serviceItems (dòng gói 0đ + dòng lẻ), tổng phần lẻ và công nợ, cộng hoa hồng cố định vào Commission lần thực hiện cho cùng nhân viên. Hóa đơn kind SESSION có tổng dương khi có phần lẻ; không áp thẻ cho hóa đơn hỗn hợp trong phiên bản này. Lỗi rollback cả buổi/chữ ký/quyền lợi/hóa đơn/hoa hồng. Cashier cho chọn thêm ô dịch vụ lẻ và giá từng dòng trong Dùng gói. Gói khả dụng vẫn chịu điều kiện ngày/quyền lợi/bảo lưu tại backend. Không thêm indexes hoặc migration; schema mới Invoice.recordedAt, CashCardUse.reversedAt.


## Giữ giỏ liệu trình khi chuyển danh mục — 25/10/2026
CONFIRMED người dùng: khách dùng gói đã mua phải có thể thêm dịch vụ lẻ và sản phẩm trong cùng một lần thu ngân; chuyển tab không được thay thao tác làm mất gói đang chọn.
PROPOSED kỹ thuật: tách browseMode danh mục khỏi mode hóa đơn. Khi đã chọn gói, tab dịch vụ/sản phẩm thêm hoặc bỏ dòng trong giỏ, giữ gói/người thực hiện/chữ ký. Đổi khách xóa toàn bộ giỏ. Bán gói mới vẫn là luồng riêng (chọn tab này xóa giỏ hiện tại). Nhánh invoice có treatmentId thêm additionalProducts? [{productId,quantity,unitPrice}] tối đa 30, không trùng ID, giá/số lượng nguyên dương; kiểm product active/cùng spa/tồn kho và tổng tiền ở backend. Tạo Invoice.productItems snapshot tên/đơn vị/giá/số lượng/tổng; tổng hóa đơn = phần dịch vụ lẻ + sản phẩm, buổi gói vẫn 0đ. Không sinh hoa hồng bán sản phẩm. StockMovement.checkoutInvoiceId lưu tham chiếu hóa đơn hỗn hợp, không tái dùng invoiceId vì index unique cũ chỉ cho một phiếu/hoá đơn; không thay index đang vận hành. Xuất kho tuần tự cùng transaction ghi buổi/chữ ký/hoa hồng/hóa đơn, lỗi bất kỳ rollback cả lượt dùng và tất cả sản phẩm; idempotency giữ một lần trừ kho. API đọc/PDF hiển thị sản phẩm riêng. Không áp thẻ tiền cho hóa đơn hỗn hợp; không mở xóa hóa đơn đã có chữ ký. Không migration hay ghi dữ liệu vận hành trong phiên này.


## Nhiều liệu trình trong một lần đến — 25/10/2026
CONFIRMED theo yêu cầu người dùng: đặt lịch có lọc nhóm/tìm dịch vụ; một khách có thể chọn nhiều liệu trình đã mua trong cùng lịch hoặc hóa đơn (ví dụ gội và triệt). Chọn thêm gói không thay gói đã chọn. Mỗi liệu trình theo buổi ghi 1 buổi; gói theo thời gian giữ cách ghi lượt hiện có. Đặt lịch chưa trừ quyền lợi; hoàn thành phải xác nhận từng liệu trình.

PROPOSED kỹ thuật: một nhân viên thực hiện chung các liệu trình trong lần xác nhận. Khách ký riêng từng gói, mỗi chữ ký có snapshot/digest và remainingBefore riêng. Backend kiểm tra phiên active, quyền, cùng spa/khách, không trùng ID, đủ tất cả gói của lịch, trạng thái/bảo lưu/hạn và token mới nhất. Gộp một hóa đơn SESSION với từng dòng gói 0đ; Thu ngân vẫn thêm dịch vụ lẻ/sản phẩm theo luồng hiện có. Một Commission theo hóa đơn cộng mức cố định của các liệu trình và dịch vụ lẻ, không sinh hoa hồng sản phẩm. Mọi lượt dùng, trừ buổi, hóa đơn, hoa hồng, xuất kho, thông báo, audit và idempotency chạy tuần tự trong cùng transaction; bất kỳ lỗi nào rollback toàn bộ. Thông báo hóa đơn được tạo khi đã có nội dung/tổng cuối cùng, trước commit. Audit chỉ lưu digest chữ ký, không sao chép nét ký vào payload.


## Nhắc kiểm kê tiền/chốt sổ từ 22h — 25/10/2026
CONFIRMED: nhắc chủ spa kiểm đếm tiền, đối chiếu thu chi và chốt sổ lúc 22:00 giờ Việt Nam khi sổ hôm nay chưa CLOSED.
PROPOSED kỹ thuật bổ sung: GET /api/notifications của OWNER gọi queueClosingReminders trước khi đọc inbox, chỉ trong spaId từ phiên active; STAFF không kích hoạt nhắc chủ spa. Client đang hiển thị kiểm tra mỗi 30 giây và tải ngay khi quay lại tab. Trước 22h không truy vấn/ghi nhắc; sau 22h giữ Control transaction và unique eventKey theo spa/người/ngày, không tạo trùng hoặc tự mở/chốt sổ. Lỗi tạo nhắc không chặn đọc inbox. Thông báo ghi rõ kiểm đếm tiền thực tế.
Endpoint CRON_SECRET /api/notifications/dispatch bổ sung queueClosingReminders cùng nhắc lịch và dispatch, dynamic/no-store; scheduler ngoài gọi endpoint này cũng có thể tạo nhắc chốt sổ. /daily-close và cron 0 15 * * * (UTC) giữ nguyên. Polling là dự phòng khi mở ứng dụng, không bảo đảm gửi nền nếu đóng app. Vercel Hobby có thể gọi trong 22:00–22:59; gửi nền sát 22:00 cần scheduler phù hợp đã được cấu hình. Production cần CRON_SECRET, collections/indexes push và VAPID/thiết bị đã cấp quyền để nhận push; chưa xác minh cấu hình/log production trong phiên này. Không schema/index/migration hay thao tác dữ liệu thật.


## Một chữ ký tùy chọn cho hóa đơn — 25/10/2026 (ưu tiên mới nhất)
CONFIRMED theo yêu cầu mới nhất: mỗi hóa đơn chỉ ký một lần và chữ ký không bắt buộc. Yêu cầu này thay quy tắc phải ký từng liệu trình/phải có chữ ký mới ghi buổi trước đây. Hóa đơn có nhiều liệu trình vẫn ghi nhận từng lượt dùng và trừ đúng quyền lợi dù không ký; không thay kiểm tra quyền, spa/khách, trạng thái, remainingBefore, transaction, idempotency hoặc audit.

PROPOSED kỹ thuật: Thu ngân, form hóa đơn và hoàn thành lịch nhiều liệu trình dùng một SignaturePad chung, có thể để trống. Ghi buổi không đặt lịch cũng có chữ ký tùy chọn. UI chỉ gửi signature nếu đã vẽ; chữ ký gửi lên nhưng sai định dạng vẫn bị từ chối (xóa nét ký để bỏ qua). invoice/completeTreatmentAppointment nhận signature? chung và treatments [{treatmentId,remainingBefore}]; use.signature cũng optional. Tương thích client cũ: chữ ký từng dòng được nhận nếu đồng nhất với chữ ký chung/nhau; gửi nhiều chữ ký khác nhau bị từ chối, không âm thầm bỏ bằng chứng.

TreatmentUse.confirmationUseId? (ObjectId) liên kết các lượt sau với lượt đầu cùng hóa đơn; chỉ lượt đầu lưu nét ký. Có ký: lượt đầu method DRAWN_SIGNATURE, các lượt dùng chung method INVOICE_SIGNATURE, giữ digest/snapshot và tham chiếu xác nhận. Không ký: method STAFF_RECORDED, không tạo signature/signatureDigest giả; snapshot ghi rõ nhân viên ghi nhận, không có chữ ký khách hàng. Các lượt sau vẫn liên kết lượt đầu để xem hóa đơn không lặp xác nhận. Audit không lưu nét ký, chỉ digest nếu có và evidenceRecorded phản ánh thực tế.
Đọc chữ ký dùng chung kiểm quyền trên cả lượt hiện tại và nguồn, nguồn phải cùng spa/customer/checkoutInvoiceId, không theo chuỗi tham chiếu. Chi tiết hóa đơn dùng buổi chỉ hiển thị một xác nhận; lịch sử gói vẫn tra được chữ ký chung của buổi tương ứng. Dữ liệu/chữ ký cũ giữ nguyên. Không thêm indexes/migration/backfill, không sửa dữ liệu thật. Giữ hạn chế sửa/xóa lịch sử đã có lượt dùng, kể cả lượt không ký.


## Giỏ nhiều loại và lịch kết hợp dịch vụ/gói — 25/10/2026
CONFIRMED: một lịch hẹn có thể chọn nhiều dịch vụ lẻ cùng nhiều liệu trình khách đã mua. Tìm kiếm/nhóm chỉ lọc dịch vụ lẻ; liệu trình nằm riêng bên dưới, không bị lọc và không bị mất khi chọn dịch vụ. Thu ngân cho tích nhiều gói mới/nhiều sản phẩm; giữ mọi loại mục khi chuyển danh mục.

PROPOSED kỹ thuật:
- Appointment.serviceIds? lưu riêng các dịch vụ lẻ; treatmentIds giữ các gói dùng. requestedServices chứa tên cả hai để hiển thị/nhắc lịch. serviceId và treatmentId đầu vẫn tương thích dữ liệu cũ. appointment nhận serviceIds? (1–30 không trùng) và treatmentIds? (1–30); mọi tham chiếu active/cùng spa, gói đúng khách/ngày. Đặt lịch không ghi tiền/trừ buổi. Dời/xếp lại giữ cả danh sách; hoàn thành lịch gói tính thêm đúng các serviceIds với giá/hoa hồng danh mục tại lúc hoàn thành, giữ một hóa đơn SESSION và một chữ ký tùy chọn. Gói 0đ không bị cộng giá bán lại. Lịch chỉ có dịch vụ lẻ dùng luồng completeAppointment nhiều dòng hiện có.
- Thu ngân giữ bốn danh sách giỏ độc lập. Giá/số lượng/khuyến mãi/gói tặng/thẻ tặng theo từng gói mới; danh sách người tư vấn và hạn trả chung áp dụng từng hóa đơn gói. Đổi khách/xóa giỏ mới xóa các mục. Không tự áp thẻ hoặc tự xác nhận đã thu tiền.
- productInvoice {customerId,dueDate?,items:[{productId,quantity,unitPrice}]} OWNER/cashier: một hóa đơn PRODUCT có productItems snapshots, nhiều StockMovement.checkoutInvoiceId để giữ unique invoiceId index cũ. Trừ kho tuần tự, kiểm tồn/active/cùng spa và tiền nguyên/tổng giới hạn. serviceInvoice bổ sung additionalProducts để gộp dịch vụ lẻ và sản phẩm; invoice có liệu trình vẫn gộp dịch vụ/sản phẩm như trước. Không hoa hồng sản phẩm; thẻ tiền bị chặn trên hóa đơn có productItems ở cả lúc tạo và dùng thẻ sau. PDF không lặp dòng tổng cho hóa đơn sản phẩm; kho mở đúng hóa đơn qua checkoutInvoiceId. Xóa sai sót theo quyền/quy trình hiện có bù kho cả phiếu invoiceId và checkoutInvoiceId; sửa/hủy từng dòng hóa đơn có sản phẩm chưa hỗ trợ để tránh lệch giá/kho.
- checkout {customerId,issuedOn?,actions:[{action,data}]} chỉ OWNER/cashier. Whitelist invoice/serviceInvoice/productInvoice (tối đa một hóa đơn phần đã làm/sản phẩm) và sellPackage (tối đa 30 gói mẫu khác nhau). Mỗi gói mới giữ hóa đơn/liệu trình riêng theo unique Treatment.invoiceId hiện hành để quản lý công nợ/hoa hồng/hoàn gói; không tự gộp công nợ hay đổi quy tắc 5%. Một lần lưu giỏ có thể sinh nhiều hóa đơn; UI nói rõ và chuyển tới danh sách khi có nhiều hóa đơn.
- Tất cả action của checkout cùng spa/khách, một phiên active, một Control transaction snapshot/majority, một khóa idempotency/fingerprint; thực thi/audit/notifications tuần tự, lỗi bất kỳ rollback toàn bộ (gồm xuất kho, gói/quà và buổi đã ghi trước lỗi). Retry không tạo trùng hóa đơn/gói/kho/thông báo. Audit con có checkoutKey digest; không ghi nét ký/mật khẩu vào log. Kết quả trả invoiceIds/invoices/total để đối chiếu giỏ. issuedOn chung vẫn không backdate tiền hoặc thực hiện.
Không thêm indexes, migration/backfill hoặc ghi dữ liệu vận hành trong phiên triển khai.


## Quà tặng dịch vụ lẻ thay cho cả liệu trình — 26/10/2026
CONFIRMED theo yêu cầu mới nhất: quà khi bán gói chỉ chọn dịch vụ lẻ, không tặng nguyên gói liệu trình. Thay quy tắc trước cho chọn PackageTemplate làm quà mới; quà đã cấp giữ nguyên quyền lợi/lịch sử. Tên/ghi chú ưu đãi (promotion) mô tả chương trình áp dụng để tra cứu, không tự tạo mức giảm giá; giữ điều kiện có quà/thẻ tặng thì nhập ghi chú.
PROPOSED kỹ thuật: sellPackage.gifts đổi thành [{serviceId}] strict, không nhận templateId/giá/số buổi từ client. Backend kiểm dịch vụ active/cùng spa và tạo chứng từ GIFT total=paid=0 liên kết hóa đơn mua. Dùng hạ tầng quyền lợi hiện có lưu một lượt dịch vụ tặng (Treatment packageType SESSIONS,totalSessions=remaining=1, không templateId/durationMonths); không cấp bảo hành/gói nhiều buổi và không tự đặt hạn. Khách có thể dùng sau qua luồng dùng quyền lợi: một lượt, chữ ký tùy chọn, hoa hồng thực hiện theo dịch vụ như trước; không sinh khoản thu/công nợ/hoa hồng bán gói cho quà. Mọi quà và gói mua cùng transaction/idempotency/audit, lỗi rollback toàn bộ. UI ghi Dịch vụ lẻ tặng 1 lần, dropdown từ Service; form cũ gửi templateId phải tải lại. Không schema/index/migration/backfill hoặc sửa dữ liệu thật.

## Sửa ngày hóa đơn — 26/10/2026

CONFIRMED theo yêu cầu người dùng: form sửa hóa đơn bổ sung Ngày hóa đơn,
điền sẵn ngày hiện có theo giờ Việt Nam. OWNER được sửa ngày khi hóa đơn đủ
điều kiện sửa hiện hành. Bỏ trống/không gửi giữ nguyên ngày, không lấy ngày hôm nay.
PROPOSED kỹ thuật: updateInvoice nhận issuedOn? YYYY-MM-DD, kiểm ngày thực,
không tương lai và cả ngày cũ/ngày mới chưa CLOSED. Đổi ngày cập nhật Invoice.createdAt
về 12:00 Việt Nam; nếu chọn lại cùng ngày giữ giờ cũ. recordedAt giữ thời điểm nhập
thật (chứng từ cũ thiếu trường này dùng createdAt trước sửa). Không đổi ngày thanh
toán, hoa hồng, thực hiện hay ngày bắt đầu/hết hạn liệu trình chỉ vì sửa ngày hóa đơn;
các trường liệu trình vẫn theo form sửa riêng. Giữ transaction, kiểm phiên active,
cùng spa, OWNER, expectedUpdatedAt, idempotency và audit trước/sau. Không backfill
hoặc sửa dữ liệu thật; không schema/index mới.

## Lịch hẹn và thu ngân dùng chung lần thực hiện — 26/10/2026

CONFIRMED theo yêu cầu triển khai: khi đã đặt lịch, hoàn thành qua thu ngân hoặc
chọn lịch trong thu ngân phải dùng một hóa đơn dịch vụ/buổi cho lần làm. Lưu thành
công mới hoàn thành lịch; đã liên kết thì mở hóa đơn, không tạo lại. Hóa đơn có thể
còn nợ sau khi lịch hoàn thành. Khách không đặt lịch vẫn lập hóa đơn riêng. Gói mới
mua thêm giữ hóa đơn riêng như quy tắc checkout hiện có. OWNER có thể đối chiếu và
liên kết hóa đơn đã lập rời với lịch, không tự ghép bằng khách/ngày.

PROPOSED kỹ thuật: checkout nhận appointmentId?; active OWNER/thu ngân, cùng spa và
khách, lịch CONFIRMED hoặc COMPLETED/đã tới giờ/chưa có hóa đơn và chưa ghi buổi, đủ các serviceIds và treatmentIds
của lịch. Người thực hiện phải khớp người được phân công (lịch chưa giao lấy người
thực hiện trên hóa đơn). Thêm dịch vụ/sản phẩm/gói mới vẫn theo checkout. Một hóa đơn
SERVICE/SESSION cho phần thực hiện; mua gói mới vẫn tách chứng từ. Transaction Control
chung ghi tuần tự hóa đơn, trừ buổi, kho, hoa hồng, lịch, audit, thông báo và idempotency;
lỗi bất kỳ rollback. Không tự ghi Payment hay thu tiền khi đánh dấu hoàn thành.

recordUse của checkout lịch nhận appointmentId vào snapshot của buổi đầu, buổi sau
vẫn dùng liên kết xác nhận hiện có. completeAppointment/completeTreatmentAppointment
sau đó dùng lại invoice/use đã liên kết. Retry cùng key trả kết quả cũ, key khác hoặc
hai lần thu ngân cạnh tranh không lập thêm hóa đơn cho cùng lịch.

POST /api/operations linkAppointmentInvoice {appointmentId,invoiceId,reason}: chỉ OWNER,
cùng spa/khách, lịch CONFIRMED hoặc COMPLETED đã tới giờ, hóa đơn SERVICE/SESSION đã
có performedBy/performedAt, đủ dịch vụ và buổi thực hiện, không mở đầu/quà/hoàn tiền,
không liên kết lịch khác. Kiểm người thực hiện khớp; buổi không thuộc lịch khác.
Chỉ gắn tham chiếu và hoàn thành lịch, không trừ buổi/cộng hoa hồng/thu tiền lần nữa;
giữ snapshot và chữ ký ban đầu, audit ghi lý do cùng trạng thái trước/sau. Hóa đơn
chưa ghi nhận thực hiện cần hoàn thành dịch vụ trước khi liên kết theo luồng này.

GET /api/appointments/checkout: active OWNER/thu ngân; query customerId và page (20
lịch/trang, CONFIRMED/COMPLETED), hoặc appointmentId với customerId tùy chọn để lấy
chi tiết đúng spa/khách. Trả lịch, dấu hiệu hóa đơn đã liên kết; chi tiết trả khách,
dịch vụ, liệu trình để điền giỏ. no-store; không thay endpoint đặt lịch công khai.
UI hỗ trợ phân trang, không giới hạn lịch sử ở trang đầu. Không schema/index/migration
mới, không tự liên kết dữ liệu cũ hay chạy ghi dữ liệu thật khi triển khai code.


## Điều chỉnh riêng ngày hóa đơn đã thực hiện — 26/10/2026

CONFIRMED theo yêu cầu khắc phục hóa đơn buổi liệu trình bị chặn sau khi đã mở lại
sổ: OWNER được điều chỉnh riêng ngày hóa đơn SERVICE/SESSION/PACKAGE/PRODUCT đã
thực hiện hoặc có thanh toán; không mở quyền sửa giá, dịch vụ, số buổi hay lịch sử
thanh toán. Trước đó updateInvoice chặn SESSION/liên kết buổi; ngoại lệ mới chỉ áp
dụng action riêng correctInvoiceDate. Chứng từ nhập ban đầu và hóa đơn CANCELLED
vẫn không dùng action này. Không sửa dữ liệu thật tự động trong phiên phát triển.

PROPOSED kỹ thuật / API: POST /api/operations action correctInvoiceDate,
data strict {id,expectedUpdatedAt,issuedOn:YYYY-MM-DD,reason}. Backend lấy actor/spa
từ phiên active, kiểm OWNER, đúng spa, phiên bản, ngày thực/không tương lai và cả
ngày cũ/ngày mới không CLOSED. Cần mở lại ngày đã chốt trước khi điều chỉnh. Không
yêu cầu ngày mới đã mở sổ vì không ghi dòng tiền. Ngày mới khác ngày cũ dùng 12:00
Việt Nam cho Invoice.createdAt; cùng ngày giữ giờ cũ. Giữ Invoice.recordedAt; chứng
từ cũ thiếu trường này dùng createdAt trước đổi làm thời điểm ghi nhận ban đầu.
Chỉ cập nhật createdAt/recordedAt/updatedAt, không ghi Payment/CashEntry, không đổi
performedAt, chữ ký/snapshot/digest TreatmentUse, quyền lợi Treatment, Commission,
ngày bắt đầu/hết hạn gói hay lịch hẹn. Vì thế số liệu hóa đơn theo ngày đổi theo
ngày mới, còn sổ tiền/hoa hồng/thực hiện vẫn theo thời điểm ghi nhận riêng.
Control transaction, idempotency fingerprint và audit metadata trước/sau cùng lý
do được giữ. UI có nút Sửa ngày hóa đơn tại danh sách/chi tiết; Sửa hóa đơn trên
buổi liệu trình/đã thanh toán mở form chỉ gồm ngày và lý do. Không schema/index hay
migration mới, không xóa/tạo lại hóa đơn hoặc bút toán để thay ngày.


### Điều chỉnh ngày thu khi nhập hóa đơn muộn (2026-10-26)

CONFIRMED theo yêu cầu chủ spa: trong Sửa hóa đơn, tùy chọn Điều chỉnh cả ngày thu tiền gửi correctInvoiceDate.adjustPaymentDates: true (mặc định false). OWNER đang hoạt động được chuyển CashEntry.day của tất cả khoản thu trực tiếp CASH/BANK_TRANSFER còn hiệu lực về ngày hóa đơn đã chọn, khi thực tế mọi khoản này đã thu ngày đó. Đây là ngoại lệ cho quy tắc trước đó chỉ sửa ngày hóa đơn. Không chuyển ngày tiền cọc/thẻ; giữ số tiền, công nợ, thời gian ghi nhận Payment.createdAt/CashEntry.createdAt, buổi dùng, chữ ký và hoa hồng.

Ngày thu cũ và mới phải có sổ OPEN; ngày hóa đơn cũ/mới không được CLOSED. Backend kiểm tra cùng spa, phiên/quyền, phiên bản hóa đơn, liên kết Payment–CashEntry; chặn khoản đảo/dùng chung và hóa đơn đã hoàn tiền. Ghi tuần tự trong transaction, tăng Day.revision cho các ngày thay đổi, giữ idempotency và Audit.details gồm adjustPaymentDates, receiptChanges (receiptId, paymentId, amount, method, before, after), lý do và ngày hóa đơn trước/sau. Không tạo khoản thu mới; tổng toàn kỳ không đổi, thực thu theo ngày chuyển theo CashEntry.day.
