# Kiểm toán per-line performers — 29/10/2026

Kết luận sau khắc phục: **GO cho phạm vi hai lỗi thanh toán đã yêu cầu sửa**, trên dữ liệu có ledger dòng nhất quán. Đây không phải phê duyệt deploy hoặc xác nhận mọi tính năng release. Base HEAD `544aaa822df162e165a18a8c9938cb543bd9d6ce`, nhánh `integration/per-line-performers-maintenance`. Không push/merge/deploy hoặc kết nối Atlas/prod.

## Đã sửa và tái hiện

`updateInvoice` tự lấy `performedBy` cấp hóa đơn cho dòng chưa chọn performer, kể cả dịch vụ mới. Regression integration thất bại trước sửa tại assertion performer trống. Bản sửa giữ performer trống trên hóa đơn có lineId và commission bằng 0; giữ fallback tương thích hóa đơn legacy không có lineId. Test cũ từng kỳ vọng fallback đã được chỉnh: kiểm tra hủy commission dùng fixture chọn performer tường minh. Cập nhật API, BUSINESS_RULES và DATA_MODEL, không migration/backfill.

Nhận định ban đầu về nhân đôi hoa hồng khi sửa danh sách dịch vụ được rút lại: guard trước nhánh sửa chặn hóa đơn có commission.lineId bằng 409. Không chứng minh được lỗi nhân đôi qua API này.

## Kết quả khắc phục thanh toán

- Đã đóng P1 thiếu phân bổ: thu một phần khi nhiều dòng còn nợ bắt buộc lineAllocations; thiếu/sai tổng/dòng lạ/trùng/vượt dư bị từ chối và rollback. Form thu tiền/cọc có ô phân bổ; đổi hóa đơn xóa dữ liệu dòng cũ. Nếu tất toán hoặc chỉ còn một dòng nợ thì có duy nhất một cách phân bổ, server lưu cách đó tường minh vào ledger. Đây là quyết định kỹ thuật PROPOSED đã ghi trong BUSINESS_RULES/API.
- Đã đóng P1 thẻ + tiền thu thêm: CashCardUse lưu phần thẻ, Payment lưu additionalLineAllocations của phần thu thêm. Cả hai cập nhật paid từng dòng và tổng hóa đơn trong một transaction. Đảo Payment giữ nguyên tiền thẻ, số dư thẻ và phần dòng trả bằng thẻ. UI thẻ có hai nhóm phân bổ. Giỏ nhiều dịch vụ lưu trước, trả bằng thẻ tại chi tiết hóa đơn; inline một dịch vụ giữ nguyên.
- Sửa lỗi đảo tiền đọc ObjectId của ledger thành string trước kiểm tra dòng. Sửa versionKey:false trên ba sub-schema lineAllocations để rollback không bị StrictModeError __v che lỗi gốc. Không thêm index/migration.

## Giới hạn cần giữ khi phát hành

- Hóa đơn legacy hoàn toàn không có mã dòng giữ luồng tổng cũ; từ chối yêu cầu phân bổ tường minh. Hóa đơn có mã dòng nhưng số tiền đã trả lệch hoặc thiếu mã một phần bị chặn thu thêm để đối soát. Không tự phân bổ lịch sử; chưa kiểm tra dữ liệu vận hành và không tuyên bố dữ liệu đó đã nhất quán.
- P2 ngoài phạm vi hai lỗi thanh toán: chưa có luồng điều chỉnh performer riêng cho hóa đơn đã có ledger. Guard 409 hiện tại bảo vệ lịch sử; không coi tính năng chỉnh performer này đã sẵn sàng.

## Bằng chứng và giới hạn

- Unit Windows cuối: 185 pass, 0 fail; typecheck đạt. Lần chạy unit Linux ở lượt trước bị lỗi test nhập XLSX phụ thuộc Windows; không gọi lần đó là đạt.
- Integration cuối: 43 pass, 0 fail (gồm suite cha), MongoDB 8.0.16 replica set rs0, database spacare_test trong mạng Docker internal. Test chạy chung network namespace với MongoDB; không publish port, không mount env hay dữ liệu vận hành; chỉ mount src/tests read-only. Guard URI local cố định giữ nguyên.
- Typecheck và build cuối: đạt trong container network none, source/tests hiện tại, dependencies/config từ image Playwright có sẵn. Không nạp .env thật. Build còn cảnh báo middleware deprecated; không sửa ngoài phạm vi.
- git diff --check đạt.
- UI regression mới: 6 pass, 0 fail, desktop/mobile trong container network none. Dùng component thật FormModal/CashCards với fixture HTTP bộ nhớ; xác minh payload thu tiền/cọc, đổi hóa đơn không mang dòng cũ, tách tiền thẻ và tiền thu thêm. Không gọi đây là E2E trên dữ liệu vận hành. Suite performer cũ 5 pass/1 skip do người dùng cung cấp chưa chạy lại.
- Integration bổ sung kiểm tra thiếu/sai/trùng/dòng lạ không ghi tiền; cọc đảo đúng dòng; thẻ + tiền thu thêm rollback khi Payment.create lỗi; retry chỉ một lần; đảo thu thêm giữ phần thẻ; legacy và số dư không khớp. Các ca quyền, cách ly spa, chốt ngày, payroll và concurrency hiện có vẫn đạt.
- Không sửa dữ liệu lịch sử hoặc quyết định PROPOSED/OPEN thành CONFIRMED. Cần đối soát dữ liệu vận hành và nghiệm thu quy trình trước quyết định phát hành toàn bộ; phiên này chỉ sửa và xác minh code local.
