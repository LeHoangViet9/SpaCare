# Thay thế chứng từ tư vấn bán gói

Ngày: 02/11/2026. Nguồn: yêu cầu triển khai trên feature/invoice-replacement và xác nhận chủ spa do người dùng cung cấp trong phiên cập nhật tài liệu. Chính sách CONFIRMED: BR-INV-REPLACE-001.

CONFIRMED theo xác nhận chủ spa ngày 02/11/2026, thay trạng thái PROPOSED trước đây của đúng các nội dung sau:

- V1 chỉ hỗ trợ hóa đơn thu đủ bằng đúng một khoản trực tiếp, chưa hoàn/đảo tiền; chặn cọc, thẻ, nhiều khoản thu và hóa đơn hỗn hợp.
- Giao dịch phát sinh sau thay thế phải gắn với chứng từ hiện hành; giữ chứng từ cũ để tra cứu và không tính trùng doanh thu/hoa hồng.
- Một hóa đơn vận hành, có lịch sử bản cũ và mã riêng cho chứng từ thay thế.

Các field, schemas, cách lưu snapshot/liên kết ledger, cơ chế transaction và giới hạn kỹ thuật khác vẫn là PROPOSED. Quy tắc phát sinh sau thay thế không tự mở các nghiệp vụ đang bị chặn, không mở rộng V1 và không xác nhận nghiệm thu code. Phiên này chỉ cập nhật tài liệu/trạng thái nghiệp vụ, không đổi logic hoặc chạy migration.

Khắc phục ba P2 theo yêu cầu tiếp theo: các dòng gốc liên kết bằng sourceType=PAYMENT/sourceId=Payment._id, không dùng thời điểm để gom giao dịch. Các dòng thay thế giữ paymentId cùng nguồn. Không thay schema/index của Payment hoặc viết lại ledger cũ; chỉ thêm paymentId tùy chọn trên hai ledger bán gói. Bút toán đảo giữ earnedAt của từng nguồn; phần người còn lại giữ thời điểm riêng, phần người mới nhận thời điểm của người bị thay. Các cặp nhân viên–tháng của ledger đảo/tạo xác định chính xác draft cần tính lại và kỳ cần kiểm khóa; không mở rộng sang tháng khác.

Với chứng từ gốc thiếu mã, lưu legacyInvoiceId trong lịch sử, không ghi fallback ObjectId vào trường code. Nhãn cũ được tính lúc hiển thị và giữ ổn định sau migration; snapshot/liên kết không đổi. Migration vẫn phục hồi sequence theo effectiveCode và mã lịch sử thực sự được cấp, đồng thời tương thích fallback do bản thay thế cũ tạo mà không sửa lịch sử. Kiểm thử migration gọi phạm vi spa fixture cụ thể, không chạy migration dữ liệu vận hành.

Một Invoice giữ định danh vận hành ổn định và projection hiện hành; chứng từ trước được giữ đầy đủ trong documentHistory với trạng thái REPLACED. Chứng từ thay thế có documentId và mã mới, không phải một giao dịch bán mới. Bản gốc lưu nguyên giá, khoản đã trả, người tạo/ngày gốc, danh sách tư vấn và tham chiếu. Các màn hình/report/PDF dùng mã hiện hành; bản gốc tra trong chi tiết, không có nút sửa bản hết hiệu lực. Tiền và số chứng từ tài chính không tăng vì không thêm Invoice/Payment/CashEntry/quyền lợi/buổi. Không sửa TreatmentUse, SESSION, chữ ký, snapshot/digest, Appointment, thẻ/quà hoặc payment allocation.

Backend nạp active OWNER từ phiên qua operate, khóa Control theo spa và kiểm phiên bản tài liệu hiện hành. Kiểm bản ghi cùng spa, ngày bán/ngày earnedAt/hôm nay chưa CLOSED; không cần ghi sổ vì không ghi tiền. Chặn payrollId bất kỳ và mọi mảng ID của payroll APPROVED/PAID tham chiếu ledger, kể cả legacy. Chặn kỳ đã chốt của tư vấn mới.

Chỉ hỗ trợ giao dịch đủ tiền bằng một Payment trực tiếp CASH/BANK_TRANSFER còn nguyên trạng, chưa hoàn/đảo, không cọc/thẻ/openingBalance/hỗn hợp; dòng gói cùng seller đại diện. Thiếu saleCommissionVersion=1/2, accrued hoặc ledger không khớp công thức gốc thì từ chối. V1 không tự suy quy tắc cho trường hợp còn nợ, nhiều khoản thu, seller khác nhau theo dòng hoặc lịch sử điều chỉnh khác.

Hoa hồng: quỹ gốc floor((paid-refunded)/20), chia đều và phần dư theo thứ tự ID như sharedCommissionDeltas. Giữ số người, thay đúng một thành viên; người mới chưa có trong danh sách. Ghi bút toán âm đảo từng ledger hiện hành và bút toán dương theo phân bổ mới, giữ earnedAt gốc và saleCommissionAccrued. Ledger cũ bất biến. Thay tiếp chỉ đảo phần dương của documentId hiện hành. Các payroll draft của nhân sự bị ảnh hưởng đánh dấu needsRecalculation, không sửa bảng đã duyệt/chi. Cập nhật nháp dùng cơ chế tính lại hiện có, xóa dấu rồi mới duyệt.

Snapshot/chuỗi, counter, projection, ledger âm/dương, dấu draft, audit và idempotency commit cùng transaction snapshot/majority; ghi tuần tự. Lỗi audit sau các bước ghi cũng rollback. Thanh toán/hoàn tiền/thay thế/chốt lương cùng Control nên chỉ một kết quả phù hợp thắng cạnh tranh.

Sau thay thế, v1 chặn thu thêm, áp/đảo cọc, đảo tiền, hoàn gói, sửa nội dung/ngày, tạo thêm quyền lợi hoặc vô hiệu hóa cả chuỗi. Đây là giới hạn kỹ thuật cần quy trình tiếp theo, không thay chính sách hoàn tiền hiện có. Sử dụng quyền lợi thật tiếp theo và thay tư vấn tiếp vẫn giữ được. Không chỉnh riêng consultant hồ sơ/người tạo/người thực hiện, không hoàn tác buổi.

Không commit/push/merge/deploy, chạy migration hoặc kết nối production. Kiểm thử tổng hợp dùng fixture giả trên database spacare_test cục bộ; UI fixture chặn request ngoài /api/operations. Xem kết quả thực tế trong bàn giao của phiên triển khai, không suy test đã chạy chỉ từ sự tồn tại của test.
