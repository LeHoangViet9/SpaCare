# Kiểm chứng tổng hợp sổ thu chi — 03/11/2026

Nguồn: yêu cầu người dùng sửa tổng hợp dòng tiền, không sửa ledger/dữ liệu vận hành. Worktree `spacare-cash-reversal-summary`, nhánh `fix/cash-reversal-summary`, commit nền `5e110592ec9de54f389f0e45352f10b37673f0c7`. Giữ nguyên 15 file thay đổi/mới có sẵn; bổ sung kiểm thử và runner test riêng.

## Hành vi

- Tổng thu/chi bỏ dòng gốc `reversed=true` và `REVERSAL` có `originalId`; không ghép theo số tiền, ghi chú, ngày hoặc mã hóa đơn.
- Sổ chi tiết/audit giữ lịch sử; `REFUND` thật vẫn tính chi. Bộ lọc tổng hợp dùng chung cho sổ, tổng quan, báo cáo/CSV và preview/backend chốt sổ; tiền chuyển khoản không cộng vào tiền mặt kỳ vọng.
- Fixture giả ngày 02/11 và fixture MongoDB theo ngày test xác nhận Thu 3.880.000đ, Chi 0đ, Chênh lệch 3.880.000đ (tiền mặt 320.000đ, chuyển khoản 3.560.000đ). Thêm hoàn tiền chuyển khoản 250.000đ thì Chi 250.000đ.
- Không đọc hoặc xác nhận dữ liệu thật HD000067; kết quả trên là kiểm chứng source/fixture, không phải đối soát hóa đơn vận hành.

## Kết quả chạy mới

| Kiểm tra | Kết quả |
| --- | --- |
| `npm.cmd test` | PASS: 213/213, exit 0 |
| `npm.cmd run build` | PASS: exit 0 |
| `node --import tsx scripts/run-cash-flow-integration.mjs` | PASS lần chạy lại: 50/50, runner exit 0 |
| `npm.cmd run typecheck` sau build | PASS: exit 0 |
| `git diff --check` | PASS |

Integration chỉ tạo server mới ở `127.0.0.1:27018`, database `spacare_test`, replica set `rs0`, thư mục dữ liệu tạm mới trong outputs. Runner từ chối cổng đang dùng, kiểm môi trường/server identity và 36 collections/55 yêu cầu index trước fixture. Không nạp file môi trường production, không migration hoặc xóa dữ liệu sẵn có. Tiến trình MongoDB do runner tạo được dừng sau test; thư mục synthetic giữ lại để chẩn đoán. Đường dẫn binary local có thể truyền bằng `SPACARE_TEST_MONGOD`, mặc định outputs/mongo-bin/mongod-x64-win32-8.0.16.exe.

Lần integration đầu có 50/50 test đạt nhưng runner exit 1 vì kiểm cleanup chỉ xét exitCode, bỏ qua signalCode khi tiến trình đã dừng bằng tín hiệu. Đã sửa runner và chạy lại toàn bộ trên database tạm mới; lần cuối exit 0, không cần dừng thủ công. Không coi lần đầu là runner PASS.

Log local (được Git ignore): `outputs/cash-reversal-summary-20261103-summary.json`, các log `-tests.log`, `-build.log`, `-integration.log`, `-integration-rerun.log`, `-typecheck.log`. Mỗi log ghi lệnh, ngày giờ và exit code; summary chứa hash log.

## Phạm vi và giới hạn

`tests/cash-flow-integration.ts` chạy query/aggregation MongoDB thật, reverseCash thực và retry, tổng trước phân trang, lọc phương thức/chi, hoàn tiền, tenant, đọc không sửa ledger và chốt sổ. Integration preview cũ được sửa thành cặp đảo có originalId, kỳ vọng mới không tính hai dòng đã đảo. Kiểm thử thuần/cross-day dùng fixture giả/model doubles bao phủ ngày thu khác ngày hóa đơn, CSV, giữ snapshot CLOSED, mở lại/chốt lại và stale preview.

Snapshot Day CLOSED giữ nguyên, báo cáo tính lại theo ledger hiện tại nên có thể khác snapshot cũ; ngày không còn dòng hợp lệ có thể không có hàng báo cáo. Không tự mở lại/backfill/cân sổ. Chính sách xử lý sai sót khác ngày của BR-OPEN-005 vẫn chưa được chốt đầy đủ; đây là hành vi kỹ thuật đã kiểm thử, không nâng thành quyết định nghiệp vụ mới. Chưa kiểm thử trình duyệt E2E hoặc nghiệm thu spa trong lượt này; không tuyên bố đã xác minh production.


## Đồng bộ main / giải quyết xung đột PR #4 — 03/11/2026

Từ HEAD `28b3ed608ae19a0a0d54b7a416f709886fb7fe20`, fetch và merge `origin/main` tại `4625351e12c3551d7e63e3729b98cc10a17624bb` (đã chứa invoice replacement của PR #3). Preflight worktree đúng nhánh và sạch. Một xung đột import tại tests/integration.test.ts được giải bằng cách giữ cả cashFlowIntegration và invoiceReplacementIntegration/invoiceReplacementP2Integration; giữ toàn bộ lời gọi test của hai nhóm.

Đối chiếu các dòng thêm/xóa trước khi cập nhật bàn giao: bản sửa cash reversal 19 file giữ nguyên so với main mới; bản invoice replacement 34 file giữ nguyên so với HEAD trước merge. Backend/UI/report tự hợp nhất giữ cả effectiveCode/documentHistory, replacement actions/guards và bộ lọc cashFlowMatch. Không chọn ghi đè toàn file từ một phía.

Chạy lại trên cây đã hợp nhất: npm test PASS 219/219; build PASS exit 0; typecheck sau build PASS exit 0; integration PASS 52/52, runner exit 0, gồm cả cash summary và hai nhóm invoice replacement. Runner tạo MongoDB tạm mới spacare_test ở loopback/rs0, kiểm identity và schema trước fixture và dừng tiến trình của mình sau test. Kiểm thử cấp mã chỉ chạy trên spa fixture giả trong database tạm; không chạy CLI migration hoặc truy cập dữ liệu vận hành.

Log mới riêng: outputs/cash-reversal-merge-20261103-summary.json và các log -tests.log, -build.log, -integration.log, -typecheck.log (Git ignore). Không chạy lại HTTP/browser E2E trong lượt đồng bộ này; giới hạn nghiệm thu và snapshot CLOSED ở trên giữ nguyên. Không kết nối production, không sửa dữ liệu thật, không merge PR hoặc deploy.
