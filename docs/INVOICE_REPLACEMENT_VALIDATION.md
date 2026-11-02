# Bàn giao thay thế chứng từ tư vấn bán gói

## Xử lý hai finding P2 và bằng chứng chạy mới — 03/11/2026

Worktree D:\Spa\Web\spacare-invoice-replacement; nhánh feature/invoice-replacement; HEAD 5e110592ec9de54f389f0e45352f10b37673f0c7. Trước khi làm có 34 file thay đổi/mới (19 M, 15 ??), gồm bốn file HTTP E2E. Giữ nguyên toàn bộ code/test/cấu hình và công việc đang dở; chỉ sửa tài liệu bàn giao này và lưu log kiểm thử. Không checkout/stash/reset, commit/push/merge/deploy hoặc truy cập hóa đơn thật.

Finding trạng thái nghiệp vụ đã được sửa: ba nội dung sau là CONFIRMED theo xác nhận chủ spa đã ghi trong BR-INV-REPLACE-001, không yêu cầu xác nhận lại:

1. V1 chỉ hỗ trợ hóa đơn đã thu đủ bằng đúng một khoản trực tiếp, chưa hoàn/đảo tiền; chặn cọc, thẻ, nhiều khoản thu và hóa đơn hỗn hợp.
2. Giao dịch phát sinh sau thay thế theo chứng từ hiện hành; giữ bản cũ để tra cứu, không tính trùng doanh thu/hoa hồng.
3. Một hóa đơn vận hành, có lịch sử bản cũ và mã riêng cho chứng từ thay thế.

Các ngoại lệ ngoài V1 và chi tiết kỹ thuật chưa được xác nhận vẫn là PROPOSED hoặc giới hạn kỹ thuật; không tự mở action tài chính đang bị chặn, không tự backfill và không coi xác nhận nghiệp vụ là nghiệm thu code.

Finding bằng chứng kiểm thử được đối chiếu bằng lượt chạy mới ngày 03/11/2026 (giờ Asia/Bangkok), gồm các file HTTP E2E hiện tại. Log mới có lệnh, thời điểm bắt đầu/kết thúc và exit code; E2E/integration có tổng số test đạt/trượt. Kết quả mới ở mục này được ưu tiên; các đoạn ngày 02/11/2026 bên dưới là nhật ký bàn giao trước, không dùng thay log mới.

| Kiểm tra mới | Kết quả | Lệnh | Log |
|---|---|---|---|
| Kiểm tra tĩnh runner/target trước chạy | PASS | Đối chiếu URI cố định, guard, binary và môi trường; không kết nối DB ở bước preflight | [preflight](../outputs/invoice-replacement-evidence-20261103-preflight.log) |
| Build độc lập | PASS — exit 0 | npm.cmd run build | [build](../outputs/invoice-replacement-evidence-20261103-build.log) |
| HTTP/session/API qua Next server | PASS — 3 đạt, 0 trượt; runner exit 0 | node --import tsx scripts/run-invoice-replacement-http-e2e.mjs | [HTTP E2E](../outputs/invoice-replacement-evidence-20261103-http-e2e.log) |
| Integration do cùng runner chạy tiếp | PASS — 51 đạt, 0 trượt | node --import tsx --test tests/integration.test.ts | Cùng log HTTP E2E |
| Hậu kiểm fixture trên MongoDB test | PASS — runner hoàn tất với marker PASS và exit 0 | verifyInvoiceReplacementHttpFixture trong runner hiện có | Cùng log HTTP E2E |
| Typecheck sau khi build/runner kết thúc | PASS — exit 0 | npm.cmd run typecheck | [typecheck](../outputs/invoice-replacement-evidence-20261103-typecheck.log) |
| Test thuần/UI component riêng | NOT RUN trong lượt 03/11 | Không chạy lại ngoài phạm vi yêu cầu; số 212/212 và 6/6 ở nhật ký trước là kết quả cũ | Không gọi các kết quả cũ là bằng chứng chạy mới |
| Production/nghiệm thu spa | NOT VERIFIED / không thực hiện | Không kết nối production, không đọc HD000060/HD000061 | Ngoài phạm vi |

[Tổng hợp máy đọc được](../outputs/invoice-replacement-evidence-20261103-summary.json) lưu lệnh/ngày/exit code/số test; preflight lưu SHA-256 của bốn file runner/config/spec/fixture HTTP hiện tại. Log nằm trong outputs được Git ignore, không được tự động đưa vào commit.

Trước khi chạy đã đọc AGENTS.md, tài liệu nghiệp vụ, package.json, runner, cấu hình Playwright và guard integration. Runner cố định MongoDB 8.0.16 tại 127.0.0.1:27018/spacare_test, rs0, Next chỉ bind 127.0.0.1:3223. Runner yêu cầu các port trống, tự tạo thư mục MongoDB tạm, kiểm server/schema và chỉ dùng fixture giả. Không đọc/đổi cấu hình sang production hoặc dùng dữ liệu khách thật. Người dùng đã cho phép riêng test migration trên fixture giả trong spacare_test sau khi được thông báo runner có chạy bước này. Không chạy migration/script trên dữ liệu vận hành. Không sửa dependencies, code ứng dụng, test hoặc cấu hình.

Lượt HTTP kiểm tra đăng nhập/session OWNER, preview chuyển khoản 1.750.000đ có buổi ký thật, lý do, xác nhận, retry cùng key, chuỗi chứng từ và báo cáo không cộng trùng. Các ca 401/403/404/400/409 hoàn tất theo spec hiện tại. Runner tiếp tục chạy integration và hậu kiểm Payment/phiếu thu/quyền lợi/buổi/SESSION/chữ ký/lịch hẹn/ledger/audit.

Giới hạn thao tác test: Playwright trên Windows đã ghi ok cho cả ba ca nhưng chờ ở bước đóng Next server. Đã dừng đúng process node của server test tại port 3223 sau khi kiểm tra điều kiện; không dừng runner hoặc integration, không đổi source/cấu hình. [Log hỗ trợ teardown](../outputs/invoice-replacement-evidence-20261103-cleanup.log) ghi thời điểm, PID, lệnh và lý do. Sau đó Playwright ghi 3 passed, integration 51/51, hậu kiểm và toàn runner hoàn tất PASS/exit 0. Vì vậy đây là kết quả chạy thật có hỗ trợ teardown, không khẳng định teardown Windows đã hoàn toàn tự động. Cảnh báo build middleware/proxy hiện có vẫn còn; không có lỗi ứng dụng cần sửa được phát hiện trong lượt chạy này.

Không mở rộng kết luận sang dữ liệu thật hoặc các nghiệp vụ ngoài V1. Phần nhật ký trước bên dưới được giữ để đối chiếu lịch sử.

## Bổ sung sửa ba finding P2 — 02/11/2026

Nhánh/HEAD vẫn là feature/invoice-replacement / 5e110592ec9de54f389f0e45352f10b37673f0c7. Giữ 29 file thay đổi/mới ban đầu; thêm thay đổi vào tests/invoice-codes-fixture.ts (file đã được Git theo dõi), tổng status hiện là 30 file. Không reset/stash/đổi nhánh, truy cập hóa đơn thật, kết nối production hoặc commit/push/merge/deploy.

- P2 timestamp: bỏ yêu cầu earnedAt giống mili giây. Dùng PAYMENT.sourceId đối chiếu đúng Payment._id; REPLACEMENT/REPLACEMENT_REVERSAL giữ paymentId nguồn trong field additive của hai ledger bán gói. Giữ earnedAt của từng bút toán gốc; người mới nhận thời điểm của người bị thay. Không gom theo ngày/tháng. Test có nguồn trỏ sang một Payment độc lập cùng spa/ngày và bị từ chối.
- P2 payroll: tính tập cặp staffId/month từ earnedAt của các ledger âm/dương thực sự được ghi. Chỉ draft tại các cặp đó được đánh dấu; audit ghi affectedPayrollPeriods. Giữ chặn mọi payrollId và ID snapshot APPROVED/PAID. Test ba nhân viên, mỗi người có draft ở tháng hiện tại và tháng trước: chỉ tháng hiện tại cần tính lại, nháp tháng trước giữ nguyên và duyệt được.
- P2 legacy: lịch sử nguồn thiếu code lưu legacyInvoiceId, không lưu fallback số ObjectId vào code. Nhãn lịch sử được tính khi đọc; migration xét mã được cấp, bỏ qua fallback cũ có provenance phù hợp, không sửa snapshot/liên kết. Test thay hóa đơn thiếu code rồi migration giới hạn spa fixture, retry migration, đối chiếu history/head/payment/quyền lợi và nhãn trước/sau. Test migration thuần bao phủ cả định dạng legacy mới và fallback do bản cũ lưu.

| Kiểm tra sau sửa P2 | Kết quả | Lệnh và bằng chứng local |
|---|---|---|
| Toàn bộ test thuần | PASS — 212/212 | npm test |
| Integration MongoDB | PASS — 51/51 | node --import tsx scripts/run-invoice-replacement-http-e2e.mjs (runner: node --import tsx --test tests/integration.test.ts) |
| Typecheck sau build | PASS | npm run typecheck |
| Build | PASS | npm run build (within the guarded E2E runner) |
| UI component local desktop/mobile | PASS — 6/6 | npx.cmd playwright test --config=playwright.invoice-replacement.config.cjs; outputs/p2-ui.log |
| UI xuyên toàn bộ HTTP/session/Next với database | PASS — 3/3 | node --import tsx scripts/run-invoice-replacement-http-e2e.mjs |
| Nghiệm thu spa / production / deploy | SKIP | Ngoài phạm vi yêu cầu |

### E2E giao diện qua HTTP/session/Next — 02/11/2026

Lệnh `node --import tsx scripts/run-invoice-replacement-http-e2e.mjs` hoàn tất PASS. Runner dùng MongoDB 8.0.16 cục bộ do chính runner khởi chạy tại `127.0.0.1:27018/spacare_test`, rs0 và thư mục tạm riêng; xác minh replica primary/schema trước khi ghi, build `npm run build`, chạy Next production chỉ bind loopback, rồi dừng server và xóa thư mục tạm. Playwright dùng Chromium đã có sẵn tại máy; không tải browser/dependency. Integration chạy cùng MongoDB cô lập bằng `node --import tsx --test tests/integration.test.ts`. Sau lượt cuối: UI 3/3, integration 51/51, `npm test` 212/212, `npm run typecheck` và build đều PASS. Port 27018/3223 và tiến trình mongod đã được xác nhận đóng.

Fixture chỉ dùng tên/địa chỉ giả, mã `HD910001` trở đi và `HD920001`; không dùng HD000060/HD000061 hoặc dữ liệu hóa đơn thật. E2E thực sự đăng nhập OWNER qua `/api/auth/login` để nhận session cookie, thao tác trên trang hóa đơn/báo cáo qua Next và gọi API cùng origin. Ca chính kiểm preview người cũ/mới, chuyển khoản 1.750.000đ, buổi có chữ ký, quỹ hoa hồng trước/sau; nhập lý do và chỉ commit một lần. Replay nguyên payload với cùng Idempotency-Key trả lại cùng chứng từ, không tạo audit/ledger lặp. Bản mới và link chứng từ cũ được mở để tra cứu; endpoint xác nhận PAID, buổi và chữ ký vẫn có. Báo cáo giữ nguyên tổng hóa đơn/dòng tiền/quỹ hoa hồng; mã mới xuất hiện đúng một lần, phần cũ giảm 43.750đ và người mới nhận đúng 43.750đ.

Các chặn qua HTTP/session được kiểm tra: chưa đăng nhập (401), tài khoản OWNER inactive không đăng nhập được, STAFF (403), invoice thuộc spa khác (404), thiếu lý do (400), expectedUpdatedAt cũ (409). Hậu kiểm trực tiếp trên MongoDB test so sánh Payment, phiếu thu/chuyển khoản, Treatment, Appointment, TreatmentUse/chữ ký, SESSION và xác nhận tổng ledger/audit chỉ thay đổi như dự kiến. Đây là test local; không chứng minh nghiệm thu của chủ spa hoặc quyền truy cập production.

CONFIRMED theo xác nhận chủ spa đã được ghi nhận trong BR-INV-REPLACE-001 và [INVOICE_REPLACEMENT.md](INVOICE_REPLACEMENT.md): (1) V1 chỉ hỗ trợ hóa đơn thu đủ bằng đúng một khoản trực tiếp, chưa hoàn/đảo tiền; chặn cọc, thẻ, nhiều khoản thu và hóa đơn hỗn hợp; (2) giao dịch phát sinh sau thay thế phải theo chứng từ hiện hành, chứng từ cũ được giữ để tra cứu và không tính trùng doanh thu/hoa hồng; (3) dùng một hóa đơn vận hành, có lịch sử bản cũ và mã riêng cho chứng từ thay thế. Không còn coi ba nội dung này là PROPOSED hoặc yêu cầu chủ spa xác nhận lại.

Các ngoại lệ chưa được chủ spa xác nhận, field/schema, cơ chế ledger/transaction và cách mở thêm nghiệp vụ ngoài phạm vi V1 vẫn là PROPOSED hoặc giới hạn kỹ thuật hiện có. Ví dụ: seller khác nhau theo dòng và ledger thay thế cũ thiếu paymentId bị chặn để đối soát; không tự suy diễn/backfill, không tự mở các action tài chính đang bị chặn sau thay thế. Cập nhật trạng thái tài liệu không phải nghiệm thu code và không mở rộng chính sách đã chốt.

Ca xuyên suốt mới gọi operate qua sellPackage → payment BANK_TRANSFER 1.750.000đ → completeTreatmentAppointment có chữ ký → preview/replace. Dùng delay sau ghi ledger trong test để bảo đảm timestamp khác nhau, không sửa ngày ledger. So sánh toàn bộ Payment/CashEntry/Treatment/TreatmentUse (cả chữ ký)/SESSION/Appointment trước và sau; quỹ hoa hồng vẫn 87.500đ, người cũ bằng 0, hai người hiện hành mỗi người 43.750đ, accrued không đổi. Ledger gốc giữ nguyên, ledger đảo/dương liên kết đúng payment và thời điểm. Báo cáo thực thu/giá trị hóa đơn đều 1.750.000đ, nợ 0; không thêm chứng từ bán hoặc buổi. Bổ sung ca V1 từ chối Payment đảo, phiếu thu đảo/có reversal, nhiều Payment, Allocation cọc, CashCardUse, hóa đơn có dịch vụ hỗn hợp và nguồn thanh toán độc lập.

Lượt integration đầu của ca mới lỗi DataCloneError trong phần so sánh fixture Mongoose; đã đổi sang snapshot toObject và chạy lại đạt. Khi bổ sung ca nguồn Payment độc lập, fixture ban đầu đụng unique index SaleCommission; đã dùng giao dịch tư vấn chung độc lập (ledger ở SharedSaleCommission) để kiểm tra đúng sự từ chối nguồn mà không nới index hoặc xóa ledger. Một lượt typecheck chạy trùng build lỗi TS6053 do .next/types đang được tạo lại; đã chạy lại sau khi build kết thúc và đạt, không sửa tsconfig để bỏ qua lỗi. Các cảnh báo build middleware/Edge Runtime hiện có vẫn còn. Không có FAIL/BLOCKED còn tồn tại trong lượt kiểm tra cuối.

MongoDB test local dùng binary 8.0.16 sẵn có, rs0, 127.0.0.1:27018/spacare_test và thư mục outputs/mongo-p2-test. Runner cố định URI test, kiểm môi trường/server/schema; không đọc .env. Migration chỉ gọi onlySpaId của fixture; không chạy script migration production. Không đổi dependencies/lockfile. Toàn bộ dữ liệu và bằng chứng trong ca mới là giả.

File sửa riêng cho ba P2: src/lib/invoice-replacement.ts, models.ts, invoice-code.ts, invoice-code-migration.ts, export-read.ts; src/components/invoice-replacement.tsx; tests/invoice-replacement-integration.ts, integration.test.ts, invoice-codes-fixture.ts, invoice-replacement.test.mjs, invoice-replacement-ui-fixture.tsx, invoice-replacement-ui.spec.cjs; docs/BUSINESS_RULES.md, DATA_MODEL.md, API.md, INVOICE_REPLACEMENT.md và tài liệu này. Các thay đổi từ triển khai trước vẫn được giữ.

Giới hạn còn lại: giữ nguyên phạm vi V1 một khoản thu trực tiếp đủ, chưa hoàn/đảo/cọc/thẻ/hỗn hợp; chưa adjustment payroll đã chốt. Ledger REPLACEMENT cũ thiếu paymentId sẽ bị chặn để đối soát, không tự suy đoán hoặc backfill. Thay đổi field là additive, không thêm index. Phần bàn giao lần triển khai đầu bên dưới được giữ như nhật ký, các kết quả mới ở mục này được ưu tiên.

Ngày 02/11/2026. Nhánh `feature/invoice-replacement`; HEAD `5e110592ec9de54f389f0e45352f10b37673f0c7`. Worktree sạch trước triển khai. Không commit/push/merge/deploy hoặc kết nối/sửa dữ liệu production.

Đã thêm luồng OWNER xem trước, chọn người cũ/mới, nhập lý do và xác nhận một lần tại Chi tiết hóa đơn. Bản trước lưu nguyên snapshot trong chuỗi REPLACED, cấp documentId/mã mới; giữ một Invoice vận hành và mọi tham chiếu. Khoản thu, gói, buổi thật/SESSION 0đ, chữ ký, snapshot/digest và lịch hẹn không bị ghi lại/chuyển/xóa. Hoa hồng thêm ledger âm/dương cùng transaction với audit, idempotency và dấu draft cần tính lại; dùng quy tắc v1/v2 gốc, giữ accrued và earnedAt. Payroll đã chốt, kể cả ID snapshot legacy, bị chặn.

| Kiểm tra | Kết quả thực tế | Lệnh / phạm vi |
|---|---|---|
| Test thuần và regression hiện có | PASS — 211/211 | `npm.cmd test` |
| TypeScript | PASS | `npm.cmd run typecheck` |
| Build ứng dụng | PASS | `npm.cmd run build` |
| Integration MongoDB | PASS — 50/50 | `node --import tsx outputs/run-integration.mjs` chạy test entry `node --import tsx --test tests/integration.test.ts` |
| UI local desktop/mobile | PASS — 4/4 | `npx.cmd playwright test --config=playwright.invoice-replacement.config.cjs` với server fixture và Chromium local |
| Khoản thu/gói/SESSION/chữ ký/lịch hẹn giữ nguyên | PASS | So sánh toàn bộ documents trước/sau trên MongoDB test; thêm buổi thật sau thay vẫn dùng được, chữ ký cũ không đổi |
| Hoa hồng cũ/mới, tiền lẻ, nhiều người, chuỗi thay tiếp | PASS | Test thuần và integration với fixture tổng hợp |
| Retry, bản hết hiệu lực, cạnh tranh, rollback sau lỗi audit | PASS | Integration transaction thật; cạnh tranh hai thay thế, hoàn tiền và duyệt lương |
| Draft, payrollId, APPROVED/PAID và snapshot legacy | PASS | Chặn các tham chiếu và kỳ người mới đã chốt, draft cần tính lại |
| Quyền/inactive/cross-spa/ngày khóa | PASS | Backend integration, có bản ghi spa khác thực sự |
| Báo cáo/lịch sử/export tính một lần, mã hiện hành | PASS | Report summary, customer history/count và invoiceExport trên DB test |
| Hóa đơn chưa thu/thu một phần/đã hoàn một phần | PASS — bị chặn | Integration và test quy tắc |
| UI xuyên toàn bộ HTTP/session/Next trên database | SKIP | UI chạy component thật với API fixture; DB kiểm bằng operate/read/export thật, không tuyên bố đã chạy end-to-end HTTP |
| Nghiệm thu nghiệp vụ trực tiếp của chủ spa | SKIP | Chưa thực hiện trong phiên phát triển |
| Production/migration/deploy | SKIP theo giới hạn yêu cầu | Không chạy |

Không có mục FAIL/BLOCKED còn lại trong các lệnh kiểm tra cuối. Lần cài công cụ MongoDB tạm bị chặn cache npm đã được chạy lại với quyền được cấp. Lần chạy UI đầu hoàn thành 4 ca nhưng tiến trình server Windows kết thúc chậm; lượt cuối dùng server fixture quản lý riêng, 4/4 và exit 0. Server fixture và MongoDB tạm đã dừng.

Integration dùng MongoDB 8.0.16 tạm tại **127.0.0.1:27018/spacare_test**, replica set rs0; có guard xác minh môi trường/server/schema trước ghi fixture. Runner tạo collections/indexes chỉ trên database test, test tự dọn fixture của chính nó. Công cụ mongodb-memory-server chỉ cài tạm `--no-save --package-lock=false` để tải binary; sau đó đã chạy lại `npm.cmd ci --ignore-scripts` để khôi phục chính xác lockfile và chạy lại toàn bộ kiểm tra cuối. Lượt integration cuối khởi động binary local riêng, runner shutdown sau test. Không thêm dependency dự án/sửa lockfile hoặc đọc .env production. Log local: outputs/unit.log, outputs/integration.log, outputs/ui-final.log, outputs/build.log; ảnh UI: outputs/replacement-desktop.png và outputs/replacement-mobile.png. outputs được gitignore.

Build có cảnh báo convention middleware/proxy và API Next nội bộ trong Edge Runtime; build kết thúc thành công. Git có cảnh báo không đọc được ignore toàn cục và chuẩn hóa CRLF/LF; `git diff --check` đạt. Các chuỗi mới được lưu UTF-8 và ảnh UI đã kiểm tra tiếng Việt có dấu.

Giới hạn v1: chỉ PACKAGE thu đủ bằng một Payment trực tiếp còn nguyên trạng; không cọc/thẻ/nhiều khoản thu/hoàn hoặc đảo tiền/hóa đơn hỗn hợp/dòng gói seller khác nhau/thiếu snapshot quy tắc gốc. Sau thay thế chưa hỗ trợ chỉnh tài chính, ngày, nội dung hoặc vô hiệu hóa cả chuỗi; tiếp tục dùng buổi và thay tư vấn được hỗ trợ. Không tự adjustment payroll đã chốt. Quy tắc đầy đủ ở INVOICE_REPLACEMENT.md.

Các file thay đổi/thêm:

- Backend và quy tắc: `src/lib/invoice-replacement.ts`, `src/lib/invoice-replacement-rules.ts`, `src/lib/operations.ts`, `src/lib/models.ts`.
- Đọc/hiển thị/export/audit/mã: `src/lib/invoice-code.ts`, `src/lib/invoice-code-migration.ts`, `src/lib/workspace-read.ts`, `src/lib/report-read.ts`, `src/lib/export-read.ts`, `src/lib/audit-view.ts`. Không sửa tổng hợp dòng tiền CashEntry.
- Giao diện: `src/components/invoice-replacement.tsx`, `src/components/invoice-detail.tsx`, `src/components/workspace.tsx`, `src/components/salary-table.tsx`, `src/app/ui.css`.
- Kiểm thử: `tests/invoice-replacement.test.mjs`, `tests/invoice-replacement-integration.ts`, `tests/integration.test.ts`, `tests/invoice-replacement-ui-fixture.tsx`, `tests/invoice-replacement-ui.spec.cjs`, `scripts/test-invoice-replacement-ui.mjs`, `playwright.invoice-replacement.config.cjs`.
- Tài liệu: `docs/BRD.md`, `docs/BUSINESS_RULES.md`, `docs/DATA_MODEL.md`, `docs/API.md`, `docs/DESIGN.md`, `docs/INVOICE_REPLACEMENT.md`, tài liệu bàn giao này.
