# Kết quả sửa nội dung hóa đơn — 08/11/2026

Chỉ sửa và kiểm thử local. Giữ các thay đổi đã có; không sửa dữ liệu khách thật, deploy, commit hoặc merge.

## Nguyên nhân và cách sửa

Form điều chỉnh trước đây chỉ nhận ngày, tổng và sửa sai khoản thu; API strict không nhận nội dung dòng. Luồng updateInvoice cũ không được mở lại để vượt đối soát. Bổ sung content patch vào preview/apply hiện có, với dữ liệu điền sẵn từ GET edit=1 và các khóa kiểm lại tại backend.

Luồng hoàn thành dịch vụ cũ cũng chỉ xử lý phần tử đầu. Đã sửa để giữ toàn bộ dòng sau chỉnh nội dung và chỉ ghi hoa hồng từng dòng khi xác nhận thực hiện, trong transaction riêng của thao tác hoàn thành. Sửa nội dung không tự xác nhận thực hiện.

## Trường được sửa và giới hạn

| Nhóm | Được sửa | Khóa khi có lịch sử/ràng buộc |
|---|---|---|
| Thông tin chung | Nội dung, hạn thanh toán, ngày hóa đơn, tổng tiền; khách/người tư vấn khi nguồn cho phép | Không chuyển khách có tiền/quyền lợi/lịch/hoa hồng/quà; giữ guard ngày chốt và chứng từ thay tư vấn |
| Dịch vụ | Giữ/thay/bỏ/thêm dòng chưa thực hiện; giá thực tế và KTV từng dòng | Giữ danh tính dòng/KTV đã thực hiện, có ledger hoặc gắn lịch; giá nguồn thuộc lương chốt/phân bổ dòng bị khóa |
| Sản phẩm | Sản phẩm, số lượng, đơn giá, thêm/bỏ dòng; bù kho theo chênh lệch ròng | Không đủ kho/không khớp phiếu gốc, payroll chốt hoặc phân bổ dòng phải đối soát |
| Gói | Mẫu hợp lệ, giá, số buổi/thời hạn/ngày, khuyến mãi, người tư vấn; gói chưa có ràng buộc | Gói đã thu/dùng/có lịch/quà/hoa hồng giữ nguồn; dùng Sửa gói/Thay người tư vấn/Điều chỉnh tổng khi phù hợp; bỏ gói chưa dùng chỉ CANCELLED, không xóa |
| Nguồn vận hành | Hiển thị buổi/người nhận/KTV, quà/thẻ đã cấp và thông tin thanh toán | Giữ buổi, chữ ký, quyền lợi đã dùng, giao dịch và snapshot đã chốt; không phát hành lại qua sửa nội dung |

Hóa đơn hỗn hợp có gói và tiền/ledger hoặc có phân bổ dòng lịch sử chưa có cơ chế đổi phân bổ an toàn: chặn sửa cấu trúc liên quan và nêu lý do. Gói cũ thiếu giá từng dòng không suy ra từ tổng hóa đơn.

Form tạo/model không có giảm giá riêng: không đặt chính sách mới; chênh lệch tổng so với dòng được giữ và hiện rõ. Model chỉ lưu một performerId/dòng; Thu ngân hiện gửi KTV đầu dù điều khiển cho chọn nhiều. Không thể phục hồi các KTV chưa lưu hoặc tự đặt quy tắc chia hoa hồng.

## Lịch sử và tiền

Chỉ patch field thực sự đổi; chứng từ/audit giữ snapshot trước/sau, actor, thời gian, lý do và liên kết chuỗi. No-op không save hóa đơn, đổi updatedAt hoặc tạo chứng từ/audit nghiệp vụ/kho/tiền/hoa hồng; Control/Idempotency vẫn là ghi kỹ thuật của operate.

Chỉ sửa nội dung không tạo Payment/CashEntry, không đổi ngày thu. Thu thêm thực tế dùng Thanh toán. Sửa sai khoản thu đã có vẫn là thao tác rõ ràng theo từng nguồn/ngày và guard OPEN. Tổng mới thấp hơn nguồn thu dùng adjustmentBalance và hoàn tiền thực tế hiện có; không tạo cọc/hoàn tiền giả. Tồn kho/quyền lợi/audit hoặc ledger hoàn thành lỗi đều rollback; gửi lại cùng key không ghi trùng.

## Kiểm tra đã chạy

- `npm test`: 261/261 đạt, gồm fixture model doubles dùng schema Mongoose khi tạo/save và transaction giả lập rollback. Có no-op, sửa trường/dòng, nguồn thu một phần/đủ, công nợ/tiền dư, giá/KTV, payroll chốt, gói đã dùng, legacy thiếu giá, gói TIME/SESSIONS, tồn kho/nhập ròng sau vô hiệu hóa, stale preview, idempotency, rollback audit/quyền lợi/ledger và hoàn thành nhiều dòng.
- `npm run typecheck`: đạt.
- `npm run build`: đạt; có cảnh báo middleware/proxy hiện hữu.
- Playwright fixture local Chrome: bộ hồi quy 88 ca đạt; thêm 2 ca gói/người tư vấn đạt. Lần chạy cuối 6 ca sửa nội dung trên desktop/mobile đạt. Đã xem ảnh mobile và kiểm tra không tràn ngang.
- `npm run test:integration`: BLOCKED DOCKER_CLI vì không tìm thấy Docker trong PATH. Không gọi kiểm thử MongoDB đạt. Đã bổ sung ca integration có kiểm tra nguồn thu ngày chốt, báo cáo, tồn kho, lịch sử và rollback; chỉ được chạy qua safety runner database spacare_test.
- `git diff --check`: đạt; cảnh báo CRLF/LF không phải lỗi diff.

## File thay đổi trong lượt này

- Giao diện: `src/components/invoice-content-fields.tsx` (mới), `invoice-adjustment.tsx`, `invoice-detail.tsx`, `workspace.tsx`; `src/app/globals.css`.
- Backend: `src/lib/invoice-content.ts`, `invoice-content-rules.ts` (mới), `invoice-adjustment.ts`, `invoice-adjustment-rules.ts`, `invoice-read.ts`, `operations.ts`; `src/app/api/invoices/[id]/route.ts`.
- Kiểm thử mới: `tests/invoice-content.test.mjs`, `invoice-content-fixture.ts`, `invoice-content-integration.ts`.
- Kiểm thử cập nhật: `tests/integration.test.ts`, `invoice-adjustment-fixture.ts`, `invoice-replacement-ui-fixture.tsx`, `invoice-replacement-ui.spec.cjs`.
- Tài liệu: `docs/BRD.md`, `BUSINESS_RULES.md`, `DATA_MODEL.md`, `API.md`, `DESIGN.md` và báo cáo này. Quy tắc mới CONFIRMED được tách khỏi hạn chế triển khai PROPOSED và phần dữ liệu OPEN.
