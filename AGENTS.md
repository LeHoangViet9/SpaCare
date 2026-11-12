# Hướng dẫn làm việc với SpaCare

Trước khi sửa nghiệp vụ, đọc theo thứ tự:
1. `docs/BRD.md`: bối cảnh, phạm vi và nguồn quyết định.
2. `docs/BUSINESS_RULES.md`: quy tắc và trạng thái xác nhận.
3. `docs/DATA_MODEL.md`: schemas, quan hệ và indexes.
4. `docs/API.md` và các phần liên quan trong `docs/DESIGN.md`.

## Nguyên tắc bắt buộc

- Tuân thủ các quy tắc CONFIRMED. Không tự biến PROPOSED hoặc OPEN thành chính sách đã chốt. Code đang có không chứng minh spa đã xác nhận chính sách.
- Nếu yêu cầu mới mâu thuẫn quy tắc hiện có, nêu rõ mâu thuẫn. Yêu cầu rõ ràng mới nhất của người dùng được ưu tiên; cập nhật tài liệu và kiểm thử tương ứng.
- Quyết định kỹ thuật đang dùng nhưng chưa được spa xác nhận phải ghi rõ là PROPOSED, kể cả khi đã có code.
- Kiểm tra quyền, trạng thái tài khoản và dữ liệu tại backend. Lấy spaId/actorId từ phiên đã xác thực; mọi tham chiếu vận hành phải thuộc cùng spa.
- Các thay đổi tài chính, số buổi và lịch hẹn phải giữ transaction, kiểm tra idempotency và audit. Không ghi song song bằng Promise.all trong cùng transaction.
- Không xóa cứng lịch sử tài chính, xác nhận liệu trình hoặc dữ liệu đang được tham chiếu. Không dùng đảo sai sót thay quy trình hoàn tiền.
- Chỉ chủ spa được sửa khoản thu chi đã ghi. Thu ngân không tự có quyền chỉnh lịch sử.
- Với thay đổi nghiệp vụ, thêm/chỉnh kiểm thử có ý nghĩa theo rule liên quan; chạy `npm test` và `npm run typecheck`. Chạy build khi sửa ứng dụng; chạy integration khi có MongoDB test khả dụng.
- Integration chỉ chạy database `spacare_test`; không dùng dữ liệu vận hành. Không ghi đè/xóa dữ liệu thật để chạy kiểm thử.
- Báo đúng kiểm tra đã chạy và giới hạn. Không gọi test đạt nếu bị chặn kết nối hoặc quyền môi trường.
- Khi sửa schemas/actions/quyền, cập nhật DATA_MODEL, BUSINESS_RULES và API tương ứng. Không đưa mật khẩu, session hay URI bí mật vào tài liệu/log.
- Giữ UTF-8 và tiếng Việt có dấu. Kiểm tra encoding terminal trước khi kết luận mã nguồn hỏng.

## Điểm vào code

- `src/lib/operations.ts`: actions, validation, phân quyền, transaction.
- `src/lib/rules.ts`: quy tắc thuần; `src/lib/models.ts`: dữ liệu và indexes.
- `src/lib/auth.ts`: session và origin; `src/components/workspace.tsx`: giao diện.
- `tests/*.test.mjs`: kiểm thử thuần; `tests/integration.test.ts`: kiểm thử database.

<!-- BEGIN:nextjs-agent-rules -->

## Lưu ý: phiên bản Next.js này có thay đổi

Phiên bản này có các thay đổi không tương thích — API, quy ước và cấu trúc tệp có thể khác với thông tin bạn đã biết. Trước khi viết mã, hãy đọc hướng dẫn phù hợp trong `node_modules/next/dist/docs/` (đường dẫn được tính từ thư mục của tệp này; trong monorepo, package `next` có thể không hiển thị từ thư mục gốc). Lưu ý các cảnh báo về tính năng sắp bị loại bỏ.

Khối này do `next dev` ghi và thêm lại — kiểm tra tại `node_modules/next/dist/server/lib/generate-agent-files.js`. Xóa khối khỏi diff chỉ khiến thay đổi chưa commit xuất hiện lại; commit khối cùng thay đổi của bạn sẽ giữ cây làm việc sạch.

<!-- END:nextjs-agent-rules -->
