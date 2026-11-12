# Kiểm tra và giới hạn bàn giao

## Kiểm tra bổ sung gộp ngày/modal có điều kiện — 06/11/2026

- Ngày trong CORRECT: chặn ngày không tồn tại, tương lai, issuedOn ở VOID, ngày cũ/mới CLOSED khi đổi; không đổi ngày không chặn vì ngày cũ CLOSED. Date-only delta tiền=0, snapshot ngày đúng, nguồn tiền/ngày làm/earnedAt không đổi; lỗi audit rollback cả update ngày bất biến. Đã bổ sung ca trong model doubles và MongoDB integration (integration chỉ xác nhận khi thực chạy spacare_test).
- UI dịch vụ đơn không selector kho/gói/quà, không input nội dung/giá; trường hợp kho/gói/quà riêng chỉ có nhóm tương ứng. Gói tặng không làm hiện nhóm gói bán. Backend vẫn đối soát đủ và từ chối thiếu lựa chọn thực có, dù UI bị can thiệp.
- Menu chỉ còn Sửa hóa đơn/Thay tư vấn riêng/Vô hiệu hóa; ngày nằm trong form sửa, không có nút hủy chưa thu riêng. Bút chì/thùng rác và Thanh toán giữ quyền, tooltip/aria-label; Quay lại không ghi dữ liệu. Đảo giao dịch vẫn theo guard sổ tiền cũ.

Kết quả vòng bổ sung 06/11/2026: npm test đạt 252/252; npm run typecheck đạt; npm run build đạt (cảnh báo middleware deprecated hiện có). Playwright Chrome cài sẵn: 34/34 ca liên quan desktop 1440×900/mobile 390×844 đạt; sau rút gọn nhãn chạy lại 12/12 ca modal đạt. Bao phủ menu gộp, icon/quyền/Thanh toán, dịch vụ đơn không nhóm thừa, kho/gói/quà riêng và hỗn hợp, lý do bắt buộc, preview rồi xác nhận, ngày gửi cùng CORRECT và không có adjustPaymentDates. Đã xem ảnh mobile đơn dịch vụ và hỗn hợp; ảnh ở outputs/invoice-void-*.png.

Sandbox Windows gặp CreateProcessWithLogonW 1909; chạy lại các lệnh local cần thiết ngoài sandbox. Ở môi trường này Docker khả dụng: npm run test:integration đạt 59/59 trên đúng spacare_test local do runner xác minh host/database. Lần đầu lỗi hai assertion mới (ID lượt dùng và thứ tự khóa JSON); đã sửa theo contract hiện có, chạy lại toàn bộ và đạt. Runner chỉ chuẩn bị collections/indexes test, tạo/xóa fixture test; không sửa database vận hành. Không dùng kết quả model doubles thay cho MongoDB integration. Log integration: outputs/invoice-unified-integration-20261106.log.

Giữ nhánh feature/invoice-replacement và mọi thay đổi có sẵn; không sửa dữ liệu khách thật, không commit/push/merge/deploy. Các kết quả phía dưới là lịch sử lần chạy trước; trạng thái BLOCKED Docker cũ không mô tả lần chạy mới này.


## Điều chỉnh hóa đơn đã thanh toán / gói đang dùng — 06/11/2026

Ma trận xác nhận theo BR-INV-ADJ-001 và BR-TRT-EDIT-001:
- OWNER active/cùng spa được preview/apply/refund; STAFF và cashier bị 403 qua API, inactive 401; không nhận spaId/actorId từ client.
- Giữ Payment/CashEntry/dòng thực hiện gốc; CORRECT lưu delta và before/after; VOID giữ Invoice CANCELLED và delta đảo nghĩa vụ, không tạo REVERSAL/REFUND tiền giả. Nguồn tiền sai, chuyển số dư, đã vô hiệu hóa, preview/timestamp cũ và tham chiếu ngoài spa phải bị từ chối.
- Giảm giá: trả dư cọc/thẻ về đúng nguồn theo thứ tự đã nêu, direct credit tách riêng; không tăng/xóa số tiền gốc. Tăng giá: tiền còn giữ được áp lại, phần thiếu thành nợ. Hoàn thực tế phải xác nhận đã trả, amount dương trong credit, đủ evidence và sổ OPEN. Retry không hoàn/nhập kho/ghi ledger hai lần.
- VOID có kho/gói/quà cần lựa chọn tường minh; nhập bù kho chỉ khi xác nhận RETURN, kiểm reversalOf; CANCEL_REMAINING giữ buổi gốc. KEEP gói sau VOID cho dùng tiếp bằng marker; không khôi phục buổi đã tiêu. Snapshot payroll APPROVED/PAID giữ nguyên, kể cả legacy; delta hoa hồng vào kỳ chưa chốt, draft cần tính lại.
- Sửa gói có preview/lý do/OWNER ở cả hai điểm vào; giảm dưới đã dùng không xác nhận thì 409, có confirmUsedFloor giữ tổng hiệu lực = đã dùng và remaining=0, ghi tổng yêu cầu/rightsImpact; không sửa tiền hoặc lịch sử.
- UI danh sách có hai icon tiếng Việt (tooltip/aria-label), không dropdown; icon thùng rác chỉ mở luồng VOID. Nhân viên không có nút sửa/vô hiệu hóa; còn nợ vẫn có Thanh toán. Gói đã dùng và hóa đơn trả đủ không tự chặn chức năng mới.

Bộ kiểm thử thêm: tests/invoice-adjustment.test.mjs, invoice-adjustment-fixture.ts (model doubles; chặn mọi kết nối thật), invoice-adjustment-ui-fixture.tsx (render/callback); cập nhật treatment-edit.test.mjs và integration.test.ts, thêm invoice-adjustment-integration.ts cho database spacare_test. Model doubles kiểm rollback cả state khi lỗi audit/kho, immutable nguồn/payroll, retry, compensation kỳ mở, cọc/thẻ nhiều lượt cùng nguồn, hoàn thực tế và nguồn sai. Integration chỉ được xem là đạt nếu đã thực chạy trên spacare_test; kết quả mới ghi ngay bên dưới, không dùng các kết quả lịch sử thay cho lần kiểm tra này.

Kết quả lần kiểm tra trước trong phiên local 06/11/2026: npm test đạt 252/252 (gồm model doubles và render/callback UI, không phải browser E2E); npm run typecheck đạt; npm run build đạt với webpack, còn cảnh báo middleware deprecated hiện có. npm run test:integration BLOCKED/exit 1 ở DOCKER_CLI vì không tìm thấy Docker; chưa chạy MongoDB spacare_test, không xác nhận integration đạt. Không chạy migration/setup/backfill hoặc ghi dữ liệu vận hành. Giữ nhánh feature/invoice-replacement, toàn bộ thay đổi có sẵn; không commit/push/merge/deploy. Các lựa chọn phân bổ nguồn/kỳ bù triển khai vẫn PROPOSED kỹ thuật, không được nâng thành xác nhận của spa chỉ vì test đạt.


## Có thể kiểm tra không cần dependencies

`npm test` chạy Node test runner cho quy tắc tính tiền, phân bổ cọc, công nợ, thời gian lịch, biên ngày Việt Nam, yêu cầu xác nhận và password scrypt. Kết quả thực tế nằm trong `test-results.txt` ở thư mục gốc.

## Chưa được xác minh trong môi trường tạo source

- npm install không hoàn tất vì DNS không phân giải registry.npmjs.org.
- Chưa chạy TypeScript typecheck đầy đủ, Next.js build, trình duyệt hoặc MongoDB integration. Không coi các kiểm thử thuần là bằng chứng các API tài chính đã hoạt động đúng thực tế.
- Không có database cũ để kiểm tra nhập/chuyển dữ liệu; không có kết nối MongoDB được người dùng cấp để deploy.

## Integration bắt buộc trước pilot

Đã kèm `tests/integration.test.ts` cho idempotency, cạnh tranh phân bổ cọc/lượt dùng, quyền thu ngân, dữ liệu không thuộc spa và khóa ngày. Chưa chạy được bộ này. Để chạy, tạo `.env.test.local` với `MONGODB_URI` trỏ replica set và database **spacare_test**, sau đó `npm run test:integration`. Script tạo dữ liệu test riêng theo spa và dọn dữ liệu đó; không trỏ vào database vận hành. Vẫn cần kiểm tra thủ công những mục dưới đây và kiểm tra đăng nhập qua HTTP.

Thực hiện trên database thử riêng, không chứa dữ liệu thật:

1. Đăng nhập Owner/Staff/thu ngân; Staff không xem được hóa đơn/cọc/sổ, không tự gọi API chỉnh tiền, không truy cập ID của spa khác.
2. Gửi cùng key hai lần và song song: chỉ một bản ghi tiền. Dùng cùng key khác payload: 409. Thử mất phản hồi sau commit rồi retry.
3. Cọc 500k, hóa đơn 350k, phân bổ 350k: dư 150k, không có CashEntry thu thêm. Hai request song song cùng dùng hết cọc: chỉ một thành công.
4. Hóa đơn 2tr, áp cọc 500k, thu 1tr: nợ 500k. Thu vượt nợ bị từ chối. Thử đồng thời hai khoản thu tổng vượt nợ.
5. Đảo phân bổ khôi phục đúng cọc/nợ; đảo lần hai bị từ chối. Cọc đang dùng không thể đảo khoản thu gốc. Đảo PAYMENT khôi phục công nợ và ghi đối ứng ngày hiện tại.
6. Gói 10 buổi ghi 3 buổi có xác nhận còn 7. Xác nhận thay thế thiếu lý do không trừ buổi. Hai request dùng buổi cuối đồng thời: chỉ một thành công. Không có endpoint sửa phiếu cũ.
7. Kỳ vọng quỹ 2,5tr, đếm 2,45tr: chênh -50k, không tự sinh cân sổ. Sau chốt không thu được; chỉ Owner mở lại và có audit. Ghi tiền/chốt đồng thời phải nhất quán.
8. Đặt hai lịch giao nhau cùng nhân viên: chỉ một thành công. Lịch nối tiếp được phép. Hủy/hoàn thành không tự thu tiền hoặc trừ liệu trình.
9. Kiểm tra dấu tiếng Việt, màn hình 390px và desktop; modal bằng bàn phím, phiên hết hạn, lỗi database và retry.
10. Kiểm tra mongod replica set primary, indexes unique và TTL bằng db:setup; kiểm tra backup/restore.

Chạy song song sổ gốc và SpaCare ít nhất 14 ngày theo BRD. Đối chiếu dòng tiền/cọc/nợ/lượt dùng hằng ngày; chủ spa duyệt quy trình trước khi thay sổ giấy.

## Cập nhật kiểm tra 20/10/2026

- Đã cài dependencies; có package-lock.json. `npm run typecheck` đạt và `npm test` đạt 8/8 trong phiên sửa chức năng.
- Đã bổ sung ca integration cho trùng định danh, sửa dữ liệu và trạng thái. Chạy với database riêng spacare_test nhưng không kết nối được: EACCES 127.0.0.1:27017; chưa kiểm chứng các ca này.
- Build Turbopack bị chặn tạo junction (Access denied); thử webpack bị EPERM khi tạo thư mục .next/server/app/api/auth. Chưa build thành công, chưa xác minh giao diện bằng trình duyệt.
- Các ghi chú chưa cài dependencies ở phần cũ là trạng thái bàn giao ban đầu, được thay thế bởi cập nhật này.

Hướng dẫn thực hiện và ghi nhận theo SWT: [TESTING.md](TESTING.md). Tài liệu có expected và mẫu báo lỗi; các case manual/API mới chưa được thực thi, không phải báo cáo tất cả test đã đạt.

## Kiểm tra sau liên kết lịch–hóa đơn — 20/10/2026

- TypeScript: npm run typecheck đạt.
- Unit test hiện có: npm test đạt 8/8; không coi là bằng chứng cho completeAppointment trên database.
- Đã bổ sung assert integration về quyền, hoàn thành/tạo invoice cùng transaction, retry không trùng, liên kết invoice thủ công, lịch chưa đến giờ/hoãn/hủy và rollback do hạn trả sai.
- Chạy integration với database spacare_test bị chặn EACCES 127.0.0.1:27017 trước khi thực hiện các ca nghiệp vụ.
- Build webpack bị EPERM tạo thư mục .next/types/app/api/auth; chưa build thành công hoặc kiểm tra UI trực tiếp.
- Chưa chạy db:setup trên database hiện tại; cần tạo index bổ sung theo DATA_MODEL.md khi áp dụng.

## Kiểm tra sau lịch gói và trạng thái hóa đơn — 20/10/2026

- npm test: 9/9 đạt, gồm quy tắc trạng thái OPEN/PARTIALLY_PAID/PAID và thay đổi khi đảo khoản thu.
- npm run typecheck đạt sau các cập nhật frontend/backend.
- Đã bổ sung assert integration về gói đúng khách/dịch vụ, xác nhận thiếu lý do, hoàn thành giảm đúng một buổi, retry không trừ lại, không sinh invoice cho lịch gói, thực nhận tiền và trạng thái sau đảo thu.
- Integration spacare_test bị chặn tại kết nối EACCES 127.0.0.1:27017; chưa chạy tới assert nghiệp vụ. Build webpack bị EPERM tạo thư mục .next/static/chunks/next/dist/client.
- Chưa xác minh UI/QR bằng trình duyệt, chưa cấu hình ngân hàng/ảnh QR hoặc chạy db:setup trên database vận hành.
- Cần tạo unique index TreatmentUse.appointmentId bằng setup và khởi động lại app trước khi thử giao diện trên dữ liệu test. Không coi 9 unit test là chứng minh luồng database đã đạt.

## Kiểm tra script dữ liệu demo — 20/10/2026

- npm run db:demo:check đạt: validate schema 63 bản ghi; đối chiếu invoice.paid với Payment/Allocation, cọc với phân bổ, số buổi với Use và Payment với CashEntry.
- npm run typecheck và npm test (9/9) đạt.
- Đã thử npm run db:demo nhưng không kết nối được MongoDB (MongooseServerSelectionError); chưa ghi dữ liệu mẫu thực tế trong phiên này, chưa xác minh chạy lại/unique indexes/transaction trên database.
- Chỉ cho phép database spacare_demo; dev:demo không thay .env.local. Chi tiết và số liệu expected ở DEMO_DATABASE.md.

## Kiểm tra cập nhật giao diện điện thoại — 20/10/2026

- npm run typecheck đạt; npm test đạt 9/9. Test thuần không xác minh responsive.
- CSS parse bằng PostCSS thành công.
- npx next build --webpack đã hoàn tất thành công (khác các lần trước bị chặn quyền). Chưa kết luận npm run build mặc định Turbopack đạt.
- Đã thử mở localhost bằng trình duyệt tích hợp nhưng tab không kết nối được; chưa có ảnh kiểm chứng ở kích thước điện thoại. Các ca TC-MOB-* vẫn Not Run, cần kiểm tra DevTools/thiết bị thật.

## Kiểm tra phân trang — 20/10/2026

Typecheck đạt, unit test 9/9 đạt. Build webpack lần này bị EPERM khi tạo .next/server/app/api/auth, chưa xác nhận build của bản phân trang. TC-PAGE-* chưa chạy trên trình duyệt. Phân trang chỉ giới hạn số dòng/thẻ hiển thị, không thay phép tính tổng hoặc dữ liệu backend.


## Kiểm tra thay đổi luồng nghiệp vụ — 21/10/2026
- npm test: 13/13 đạt (bao gồm hạn thanh toán được chọn và xác nhận/tham chiếu thu tiền).
- npm run typecheck: đạt sau chỉnh sửa cuối.
- Integration: đã bổ sung kiểm tra bán gói cùng transaction/idempotency, dùng gói chưa trả, quyền nhân viên, thu tiền/phân bổ cọc giữ số dư và lịch hoãn tạo mới. Chạy npx tsx --test tests/integration.test.ts với URI cố định database spacare_test; bị chặn EACCES 127.0.0.1:27017 trước kết nối. Không coi là đạt, không chạm dữ liệu vận hành.
- npm run build (Turbopack): bị chặn quyền tạo junction.
- npx next build --webpack: có một lần đạt trước điều chỉnh giao diện cuối; lần kiểm tra bản cuối bị EPERM tạo thư mục .next/static/chunks/app/api/operations và .next/server/app/api/auth. Không coi bản cuối đã build đạt.
- Chưa kiểm tra tương tác UI trên phiên có database. Cần chạy lại integration/build ở môi trường đủ quyền trước nghiệm thu.
- Schema mới: khởi động lại ứng dụng; db:setup tạo unique partial index rescheduledFromId. Chưa chạy setup trên database vận hành.


## Bổ sung regression theo yêu cầu người dùng — 21/10/2026

Lượt này chỉ sửa test và báo cáo kiểm tra; không đổi mã nghiệp vụ/schema/quyền production. Schema hiện chỉ hỗ trợ OWNER/STAFF; không tạo vai trò MANAGER hoặc tự chốt quyền quản lý.

### File thay đổi
- tests/navigation.test.mjs: mọi vai trò, kể cả tên MANAGER chưa hỗ trợ, đều không mở trang lương/hoa hồng chưa triển khai; không nhận quyền trang quản trị của OWNER.
- tests/roles.test.mjs (mới): validate model không kết nối MongoDB; từ chối MANAGER/ADMIN/role sai chữ hoa; OWNER và STAFF hợp lệ.
- tests/rules.test.mjs: bảo toàn số dư cọc qua nhiều lần áp; biên hạn thanh toán/ngày nhuận; xác nhận thực nhận phải boolean true và chuyển khoản phải có ghi chú/tham chiếu hợp lệ.
- tests/integration.test.ts: thêm 11 subtest có tên. Bao phủ quyền lấy lại từ DB thay vì tin claims; khóa tài khoản/thu hồi cashier; rollback khi lỗi giữa tạo hóa đơn và tạo gói (mock lỗi Treatment.create, còn transaction và các model khác dùng MongoDB thật); thu tiền cạnh tranh không vượt nợ; dùng gói còn nợ đúng ngày hạn; cọc sai khách/vượt số dư/vượt nợ; tham chiếu có thật thuộc spa khác; nhân viên xếp lại lịch gói giữ nguyên lịch cũ và chỉ một lịch mới; chỉ OWNER đảo phân bổ/đảo thu; giữ bản gốc/bút toán đối ứng/chống đảo lần hai; Idempotency-Key ràng buộc actor/payload; đảo thu/chi khác; lỗi đảo khi sổ đóng rollback cả invoice/payment/audit/idempotency. Cleanup chỉ theo các spa fixture được tạo trong spacare_test.

### Kết quả lệnh trong lượt này
| Lệnh | Kết quả |
|---|---|
| npm test | PASS: 18/18; chỉ test thuần/schema không DB, không chứng minh integration đạt |
| npm run typecheck | PASS, bao gồm file integration.test.ts mới |
| npm run build | BLOCKED/exit 1: Turbopack không được tạo junction .next/node_modules/mongoose-* (Access is denied, os error 5) |
| Preflight MongoDB test | BLOCKED: EACCES khi kết nối 127.0.0.1:27017, URI cố định chỉ spacare_test; không ghi dữ liệu |
| Integration | NOT RUN: preflight không khả dụng; không chạy npm run test:integration và không gọi assert nghiệp vụ DB |

Không dùng database vận hành, không sửa .env.local, không chạy db:setup/seed. Không khẳng định build/integration đạt. Cần chạy lại chúng trong môi trường đủ quyền.

### Nội dung vẫn OPEN
Quyền quản lý xem lương/hoa hồng người khác, công thức hoa hồng/quy chế lương (BR-OPEN-011/012/013); giá trị phần gói còn lại khi đổi (BR-OPEN-008); bảo lưu/thời hạn cụ thể (BR-OPEN-002/009); số ngày/mốc tính hạn thanh toán chuẩn và chế tài quá hạn (BR-OPEN-010); xác nhận buổi thay thế (BR-OPEN-003); quy trình duyệt sửa sai sau chốt sổ (BR-OPEN-005); quyền STAFF lập hóa đơn độc lập (BR-OPEN-001). Các regression chỉ kiểm tra thiết kế kỹ thuật hiện tại, không nâng PROPOSED/OPEN thành CONFIRMED.


## RUN-20261021-FULL — thực thi lại với MongoDB khả dụng ở cổng27018

Các kết quả dưới đây là lần chạy mới, thay thế giới hạn EACCES của các lượt trước trong phạm vi lần này. Không gọi kết quả cũ là đã đạt.

- npm test:18/18 đạt. npm run typecheck:đạt. npm run build:đạt,Turbopack production.
- npx tsx --test tests/integration.test.ts:12/12 đạt (1testcha+11subtest),transaction MongoDB thật trong spacare_test;URI không chứa bí mật,cổng27018/directed primary.
- tests/workbook-http.ts:54/54 tình huống HTTP+DB đạt;53mãTCgốc+phầnAPI củaTC-SVC-03. Chỉ xác nhận trọnTC-SVC-03 sau kiểm traUI không chọn dịch vụ ngừng.
- Trình duyệt:đã đăng nhậpOWNER/STAFF giả,menu13/8trang,5nút đáy,form,xác nhận,gợi ý gói,keyboard,thông báo,phân trang,viewport320–1440px.
- Workbook99ca:89Pass,4Fail,5Blocked,1Deferred;không còn ca chưa được phân loại. Chỉ93ca đã thực thi toànexpected(89Pass+4Fail),không coi6caBlocked/Deferred là đã chạyđạt.
- Hai lỗi chưa sửa:BUG-UI-001 mất bộ lọc mã khi chuyển lịch/hóa đơn (TC-BILL-02/10,TC-WIDTH-03);BUG-UI-002 TổngquanSTAFF so ngàyUTC,hiển thị4thay vì11CONFIRMED theo ngàyVN (TC-REG-12). DB liên kết invoice đúng,không phát hiện thu/trừ buổi lặp trong bộđãchạy.
- Blocked:UI05 thiếu throttle cókiểmsoát;PAY07 thiếuQR/ngân hàngtest đãxácnhận;MOB04 thiếu bànphímthiếtbịthật;MOB06 thiếuQR/tên tài khoản dài;MOB08 chưa cóscreenreader. OPEN01 Deferred vìchưa chốtđóng/bảolưu/đổi gói.
- Chỉ dùngspacare_test;appisolated127.0.0.1:3100;không sửa.env.local/khôngchạm dữliệuvậnhành. Đã dọnfixturetheoIDspatestđượctạo và dừngđúngserver3100.
- File kếtquả:outputs/test-review-20261021/SpaCare_Test_Cases_20261021.xlsx. Giữ4sheet/10ảnhnguồn;ảnhcũchuyểncộtS đểkhông chebằngchứngmới;ẩn mật khẩu;filter mởrộng99ca;summarytínhtheocôngthức,đã render/kiểmtra.
- Files test mới:tests/workbook-http.ts,tests/workbook-ui-fixture.ts. Không sửa mã production để che lỗi trong lượt test này.

Lệnh/exit code lần cuối: npm test=0; npm run typecheck=0; npx tsx --test tests/integration.test.ts=0; npm run build=0
# Kiểm thử lại BUG-UI-001/002 — 21/10/2026

Phạm vi lượt này: sửa hai lỗi UI và retest TC-BILL-02, TC-BILL-10, TC-WIDTH-03, TC-REG-12. Không chạy lại toàn bộ 99 ca Excel. Kết quả Pass của các ca khác là lịch sử lượt trước.

- Nguyên nhân BUG-UI-001: pendingSearch/state của Workspace mất khi route được dựng lại. Đổi sang `?search=...` làm nguồn bộ lọc; bỏ ref truyền giữa các trang. Đã thao tác hoàn thành lịch, bấm liên kết hai chiều, reload từng trang, Back/Forward. Mỗi trang đích chỉ hiện một bản ghi. Chi tiết dịch vụ/gói, lý do và ghi chú vẫn đầy đủ trên desktop 1280px.
- Nguyên nhân BUG-UI-002: startAt.slice(0,10) so ngày UTC với ngày Việt Nam. `staffBookingsToday` dùng spaDay, lọc staffId và giữ CONFIRMED. Trình duyệt STAFF hiển thị 11, query Mongo theo dayBounds ngày Việt Nam cũng 11; hai lịch OWNER không được tính. Query URL trỏ invoice ngoài phạm vi STAFF trả danh sách rỗng.
- Regression mới: `tests/workspace-view.test.mjs`. Hai test thất bại với logic trước sửa (mã search mất khỏi URL; đếm lệch ngày/phạm vi), sau sửa đạt. Bao phủ ngay trước/đúng/sau 00:00 Việt Nam, ngày UTC khác ngày Việt Nam, trạng thái không tính và nhân viên khác.
- Đối chiếu sau hoàn thành và sau điều hướng: 1 invoice liên kết, total=350000, paid=0, OPEN; tổng 7 invoice/13 lịch không đổi do điều hướng; Payment=0 và CashEntry=0. Chỉ dùng fixture có mã WORKBOOK-UI riêng trong spacare_test; app test riêng 127.0.0.1:3100, không thay .env.local hay dữ liệu vận hành.
- `npm test`: Pass 20/20. `npm run typecheck`: Pass. `npx tsx --test tests/integration.test.ts`: Pass 12/12 (1 test cha +11 subtest), MongoDB spacare_test replica set khả dụng. `npm run build`: lần đầu trong sandbox bị Access denied khi tạo junction Turbopack; chạy lại trong môi trường hỗ trợ junction đạt production build. Không ghi nhận lần bị chặn là Pass.
- Bằng chứng lượt này: outputs/retest-20261021/ui-retest.json, db-proof.json, integration.log, build.log. Excel giữ lịch sử Fail và nguyên nhân trong Retest/Ghi chú; không xóa bug cũ. Tổng hợp sau retest: 93 Pass, 0 Fail, 5 Blocked, 1 Deferred (99 ca). Các ca ngoài phạm vi retest giữ thời điểm/bằng chứng lượt trước.
- 5 Blocked giữ nguyên: UI-05 thiếu giữ/throttle phản hồi có kiểm soát; PAY-07 thiếu ngân hàng/QR test xác nhận; MOB-04 thiếu bàn phím ảo thiết bị thật; MOB-06 thiếu QR/tên tài khoản dài; MOB-08 thiếu phiên screen reader. TC-OPEN-01 vẫn Deferred. Không tự đặt quy tắc đổi/bảo lưu/giá trị buổi còn lại, chế tài quá hạn, lương/hoa hồng hoặc quyền quản lý chưa chốt.



## Ký trực tiếp và bảo lưu — kiểm tra ngày21/10/2026
Phạm vi mới: thay tham chiếu phiếu cho mọi buổi mới bằng nét ký trên màn hình; ca có lịch và không lịch; duyệt/gia hạn bảo lưu và mở lại bởi OWNER. Các kết quả Excel lượt trước không được coi là retest cho tính năng mới này.

- npm test:21/21 Pass. npm run typecheck:Pass (lần chạy đầu có lỗi type ở mock.restore trong test mới, đã sửa thành mock.mock.restore và chạy lại đạt). npx tsx --test tests/integration.test.ts:13/13 Pass (1testcha+12subtest). npm run build:Pass sau thay đổi cuối.
- Integration thật chỉ spacare_test trên replica set khả dụng. Kiểm tra chữ ký rỗng/sai/legacy bị từ chối, snapshot/digest, ẩn nét ký mặc định, retrycùngkey, kháckey với số buổi cũ409, STAFF/cashier không duyệt/mở/gia hạn bảo lưu, hết ngày bảo lưu không tự mở, held remaining giữ nguyên, gia hạn sử dụng chỉ khi chọn, IDspa khác404. Chèn lỗi Audit.create sau ghi Use/remaining/lịch để chứng minh toàn bộ rollback.
- HTTP:55/55 Pass với app test riêng3100, database spacare_test. Có ca GET chữ ký: STAFFghi/OWNER200,STAFFkhác403,chưađăngnhập401; workspace không chứa nét ký/snapshot; retry/stale không trừ thêm. Không mock database.
- Browser: STAFF không thấy nút bảo lưu; chữ ký trống khóa submit; Ký lại xóa nét và khóa lại; ký bằng chuột rồi ghi không lịch giảm7=>6. Hủy form ký lịch giữ Đã đặt, sau ký+lưu lịch COMPLETED và gói7=>6. Mở Xem chữ ký có đúng thông tin khách/gói/nhân viên/thời điểm. OWNER duyệt bảo lưu6buổi vẫn6, PAUSEDkhông có nút ghi buổi; mở lại không chọn hạn mới giữ expiresOn chưa đặt.
- Mobile390x844 giả lập:modal/ôký không tràn ngang, có thể cuộn tới nút xác nhận/hủy. Mô phỏng đồng thời một buổi khác trong lúc form hiển thịremaining6:form cũ bị409, đóng/xóa nét cũ và tự tải danh sáchremaining5, không trừ thêm. Chưa xác minh nét ký bằng ngón tay trên thiết bị thật; không ghi nhận kiểm thử thiết bị thật.
- DB đối chiếu fixtureUI:3chữ ký (2thao tácUI và1lượt cạnh tranh tổng hợp), gói có lịchremaining6 và1Use/lịch, gói không lịchremaining5; Invoicevẫn6,Payment0,CashEntry0. Không thu tiền/tạoinvoice do ghi buổi. Đã dọn đúng fixturevà dừng app test3100, không sửa .env.local hoặc dữ liệu vận hành. Bằng chứng:outputs/signature-20261021/{results.json,final-results.json,unit.log,typecheck.log,integration.log,build.log,http-results.json,ui-proof.json,cleanup.log}.

Các file triển khai:src/components/workspace.tsx,src/components/signature-pad.tsx,src/lib/signature.ts,src/lib/models.ts,src/lib/operations.ts,src/app/api/operations/route.ts,src/app/api/treatment-uses/[id]/route.ts,src/app/globals.css. Tests:tests/signature.test.mjs,tests/integration.test.ts,tests/workbook-http.ts. Tài liệu:BRD,BUSINESS_RULES,DATA_MODEL,API,DESIGN,VALIDATION.

Không backfill chữ ký/hạn dùng và không cần index mới; khởi động lại app để nạp schema. BR-OPEN-002 đã chốt phần bảo lưu, nhưng hạn gốc/mốc tính còn mở; không tự khóa theo expiresOn. BR-OPEN-003 ngoại tuyến vàBR-OPEN-008đổi gói/giá trị buổi còn lại cùng các OPEN tài chính/lương/hoa hồng khác giữ nguyên. Không tự đổi trạng thái Deferred của ca Excel cũ bao gồm cả dừng/đổi gói thànhPass chỉ vì đã có bảo lưu.


## Lương nháp và nghỉ phép — 04/11/2026
- Nhánh triển khai: fix/payroll-commission-and-leave. Ban đầu chỉ có next-env.d.ts thay đổi do Next dev; giữ lại các import .next/dev/types. Không commit/push/deploy/merge, không migration hoặc ghi dữ liệu vận hành.
- npm test: 232/232 đạt (gồm quy tắc tổng bốn ledger, nháp cũ/mới, snapshot đã khóa, render bảng lương/nghỉ và tương thích công thức công lịch sử).
- npm run typecheck: đạt khi chạy tuần tự sau build; lần chạy song song với build ban đầu bị thiếu file .next/types do build tái tạo chúng, đã chạy lại thành công.
- npm run build: đạt. Cảnh báo middleware convention deprecated là cảnh báo sẵn có, không thuộc phạm vi sửa.
- git diff --check: đạt.
- MongoDB kiểm thử 127.0.0.1:27018 không nhận kết nối TCP. Không chạy integration hoặc dùng database khác để thay thế. Đã bổ sung/cập nhật integration cho đồng bộ bốn ledger không cộng trùng, nghỉ có lương/không lương, nghỉ chờ duyệt, không cần Workday và snapshot APPROVED/PAID bất biến; chưa xác minh các ca này trên database.
- OPEN: công thức giảm chỉ theo nghỉ không lương chưa xác nhận. Giữ lương cơ bản và cảnh báo chủ spa nhập khấu trừ có lý do; không coi công thức DAILY dựa công thực tế cũ là chính sách mới.


## Sửa lỗi tạo Payroll do pendingLeaves — 04/11/2026
- Nguyên nhân: savePayroll spread kết quả attendanceFor có field tạm pendingLeaves vào payload create; Payroll giữ strict:'throw' nên HTTP 500. Sửa bằng cách chỉ lấy rõ bốn field snapshot salaryPolicy/leaveStats/workdays/attendanceDigest để lưu cho cả create/update. Không đổi schema, công thức lương hoặc guard duyệt nghỉ.
- Regression integration mới: nhân viên chưa có Payroll/công/nghỉ và có policy DAILY tạo DRAFT thành công, retry idempotency không trùng; kiểm raw Mongo document chỉ có field schema, không pendingLeaves, validate thành công. Cập nhật khi có nghỉ PENDING vẫn không lưu field tạm; duyệt lương bị chặn, duyệt nghỉ/cập nhật nháp rồi duyệt lương được; nghỉ hưởng lương không giảm base, không cần Workday.
- Đã chạy regression trước sửa: thất bại đúng StrictModeError pendingLeaves. Sau sửa chạy toàn bộ integration: 55/55 đạt, không skipped; mọi ca từng thất bại về payroll/commission/leave, legacy và thay tư vấn đều đạt.
- Rà log cũ: ca leave-only có lỗi fixture lineId ngoài schema ở ledger không phải InvoiceLineCommission (khác các ca lỗi pendingLeaves). Đã sửa helper test chỉ tạo lineId cho InvoiceLineCommission để kiểm được đầy đủ bốn ledger; không nới schema/giảm assert.
- Runner scripts/run-cash-flow-integration.mjs dùng mongod local mới, cổng 27018 kiểm trống trước chạy, dbpath mới, chỉ spacare_test/rs0. Preflight xác minh đúng host/port/database/primary và schema trước mọi fixture ghi dữ liệu. Không đọc .env.local hoặc dùng production/demo; runner dừng mongod sau test.
- npm test: 232/232 đạt. npm run typecheck: đạt. npm run build: đạt trên bản sao source không .env, giữ next-env.d.ts gốc. git diff --check: đạt.
- Browser Chromium thật: 12/12 kịch bản local đạt tại 127.0.0.1:3226 với MongoDB test mới cùng target đã preflight. Tạo nháp mới trả 200; cập nhật hai lần từ 125.000đ thành 215.000đ dịch vụ + 87.500đ bán gói = 302.500đ không cộng trùng; nháp lệch bị chặn; APPROVED/PAID giữ snapshot sau phát sinh; nghỉ hưởng lương không giảm base; nghỉ không lương khấu trừ tay có lý do; PENDING chặn duyệt; không ghi công; lịch sử Payroll/Workday synthetic không đổi. Không pageerror trong lượt cuối. App/mongod test đã dừng.
- Bằng chứng: outputs/payroll-pending-leaves-fix-20261104/{integration-before-fix.log,integration-after-fix.log,unit.log,typecheck.log,build.log,ui-runner.log,final-ui-results.json,workspace-proof.json,REPORT.md}. Các kết quả review thất bại trước đây vẫn giữ trong thư mục review cũ, không ghi đè lịch sử.
- Không commit/push/deploy/merge, migration/backfill hay ghi dữ liệu thật. Quy tắc giảm chỉ theo nghỉ không lương vẫn OPEN như trước, không thêm công thức mới.

## Chi tiết hóa đơn — 05/11/2026

- `npm test`: đạt 212/212, gồm kiểm tra dữ liệu đọc theo từng dòng dịch vụ, từng Payment, giới hạn cùng spa và method=null khi thiếu phiếu liên kết.
- `npm run typecheck`: đạt sau khi loại thư mục artifacts `outputs` khỏi phạm vi TypeScript. Lần đầu bị lỗi từ các snapshot cũ trong outputs; một lần chạy đồng thời build gặp file .next/types đang được tái tạo, đã chạy lại tuần tự sau build.
- `npm run build`: đạt với webpack; còn cảnh báo middleware đã deprecated có từ cấu hình hiện tại.
- Playwright fixture trong bộ nhớ: đạt 2/2 (desktop 1440×900, mobile 390×844), kiểm tra kỹ thuật viên riêng/chưa có, nhiều khoản cùng phương thức không gộp, tổng 1.500.000đ/đã trả 1.500.000đ/nợ 0đ, dòng cần bỏ, Người tạo và không tràn ngang. Dùng Chrome cài sẵn vì Chromium của Playwright chưa có. Đã xem ảnh dịch vụ/phương thức ở cả hai kích thước. Artifacts: outputs/invoice-detail-20261105/results-final.
- Integration MongoDB chưa chạy: preflight không kết nối được 127.0.0.1:27018; không ghi database vận hành và không coi kiểm thử mock là integration.

## Thanh toán nhiều phương thức — 05/11/2026

- `npm test`: đạt 213/213. Kiểm thử splitPayment bằng model doubles bao phủ 500.000đ chuyển khoản + 1.000.000đ tiền mặt, một phương thức, 0/vượt nợ/thiếu xác nhận/trùng phương thức, nợ một phần, retry/cạnh tranh, quyền/active/cùng spa/sổ đóng/chứng từ hủy hoặc thay thế. Xác nhận một transaction/một idempotency cho cả lần thu; lỗi khoản thứ hai ở Payment/CashEntry/Audit/SaleCommission rollback cả tiền, dòng, audit, hoa hồng và khóa. Có kiểm tra phân bổ nguồn sai tổng/dòng lạ/vượt dư và hoa hồng nguồn riêng không tính trùng.
- `npm run typecheck`: đạt. `npm run build`: đạt với webpack; còn cảnh báo middleware deprecated hiện có.
- Playwright dùng Chrome cài sẵn: bộ liên quan hóa đơn/thanh toán đạt 10/10 ở desktop 1440×900 và mobile 390×844. Kiểm tra một nút Thanh toán, tổng/nợ một phần, chặn 0/vượt nợ/thiếu thực nhận, một phương thức với ô còn lại trống, phân bổ từng nguồn, đổi số tiền phải xác nhận lại và không tràn ngang. Đã xem ảnh ở cả hai kích thước.
- Chạy toàn bộ input-ui: 12/16 đạt; 4 lỗi ở dấu required-mark của money-test và kiểm tra “8/10 buổi” tại trang packages (mỗi ca lặp desktop/mobile). Đã chạy lại đúng các ca đó với fixture/Workspace/InvoiceDetail/globals.css từ HEAD: cả 4 lỗi tái hiện, không do splitPayment. Không ghi nhận bộ UI đầy đủ là đạt. Bằng chứng trong outputs/split-payment-20261105/{results,baseline-results}.
- Integration MongoDB chưa chạy: preflight 127.0.0.1:27018 không khả dụng. Đã thêm subtest integration trên spa cô lập trong spacare_test, gồm retry, khoản thu riêng, nợ, phân bổ và lỗi lần ghi thứ hai rollback; chưa xác nhận kết quả trên database thật. Không dùng dữ liệu vận hành, không migration/backfill, không merge/deploy.

## Ghép stash sau cập nhật main — 05/11/2026

- Đã ghép từng vùng xung đột trong 9 file, giữ toàn bộ mục tài liệu của cả main và stash. Giữ menu Thao tác/Xử lý hóa đơn, sửa ngày, bố cục tổng tiền/chữ ký và lý do xử lý từ main; khôi phục kỹ thuật viên từng dòng, từng khoản thu và biểu mẫu thanh toán gộp từ stash. Dòng buổi liệu trình không trùng dòng dịch vụ cũng lấy kỹ thuật viên theo phân công riêng.
- `npm test`: đạt 243/243; `npm run typecheck`: đạt; `npm run build`: đạt (cảnh báo middleware deprecated hiện có).
- UI Chrome thật với fixture trong bộ nhớ: 10/10 ca thanh toán/chi tiết và 42/42 ca danh sách/xử lý/thay tư vấn/chữ ký/sổ thu, trên desktop 1440×900 và mobile 390×844. Điều chỉnh các assertion từ main về hai nút thu tiền/người thực hiện chung sang giao diện đã yêu cầu; giữ kiểm tra quyền, chữ ký, bố cục và các nội dung main khác. Không chạy lại hoặc sửa 4 lỗi UI ngoài phạm vi đã xác định trước đó.
- `npm run test:integration`: BLOCKED, exit 1 ở DOCKER_CLI vì không tìm thấy docker trong PATH; không khởi động MongoDB hay gọi database khác để thay thế. Không ghi nhận integration đạt.
- Đã kiểm tra không còn conflict marker hoặc unmerged index entry; HEAD và stash@{0} giữ nguyên. Các file mới trong working tree được giữ nguyên; next-env.d.ts được khôi phục đúng nội dung trước build. Chỉ sửa thêm các component/fixture/assertion cần thiết để giao diện mới của main và tính năng stash hoạt động cùng nhau. Không reset, xóa stash, commit, push, merge thêm hoặc deploy.
- Bằng chứng UI và bản đối chiếu ban đầu: outputs/stash-resolution-20261105/.

## Biểu mẫu phân bổ rút gọn — 05/11/2026

- `npm test`: đạt 248/248, gồm tự phân bổ một dòng còn nợ, tất toán một/hai phương thức theo số dư sau khoản thu trước, không sửa object hóa đơn, không đếm trùng buổi phản chiếu, legacy và đối soát dữ liệu lệch. Model doubles của splitPayment nhận đúng payload tự phân bổ và lưu từng nguồn/dòng như cũ; kiểm tra phân bổ một phần và rollback hiện có vẫn đạt.
- `npm run typecheck`: đạt. `npm run build`: đạt với webpack; cảnh báo middleware deprecated hiện có. Khôi phục next-env.d.ts đúng nội dung trước build.
- Playwright Chrome cài sẵn: 18/18 ca UI liên quan đạt trên desktop 1440×900 và mobile 390×844. Bao phủ một dịch vụ trả một phần/trả hết, nhiều dịch vụ nhưng một dòng còn nợ, trả một phần nhiều dòng (mục mặc định đóng, mở theo thao tác hoặc khi thiếu/sai), trả hết hỗn hợp theo số dư thật, bỏ phân bổ tay cũ khi chuyển sang trả hết, giữ xác nhận từng nguồn và không tràn ngang. Đã xem ảnh mobile của một dòng nợ, trả hết và mục phân bổ mở. Artifacts: outputs/payment-compact-20261105/results.
- `npm run test:integration`: BLOCKED/exit 1 tại DOCKER_CLI vì không tìm thấy docker trong PATH. Không chạy MongoDB test, không dùng database khác và không ghi nhận integration đạt.
- Không sửa operations.ts, resolver/apply phân bổ backend, quyền, transaction/idempotency, schema/index hoặc dữ liệu vận hành. Không commit/push/deploy.

## Bỏ phân bổ khoản thu theo dịch vụ — 05/11/2026

- Đã rà soát toàn bộ luồng đang dùng phân bổ: UI InvoicePayment/FormModal/CashCards; backend payment/splitPayment/allocate/redeemCashCard/inline card/thu thêm và reverseCash/reverseAllocation; model/đọc tổng hóa đơn; tests thuần, model doubles, integration và UI. Xóa component/reader/state/helper tạo phân bổ mới; model giữ nguyên field lịch sử. Backend mới không tạo lineAllocations hoặc sửa paid theo dòng. Chỉ đảo khoản lịch sử còn apply phân bổ gốc, không yêu cầu sum(line.paid)=Invoice.paid sau thu mới.
- `npm test`: đạt 242/242. Các ca chính sách phân bổ mới/tự động cũ được loại bỏ; giữ kiểm tra toán học dữ liệu lịch sử và thêm ca công nợ cấp hóa đơn. Model doubles: bill nhiều dịch vụ 2.300.000đ thu 2.000.000đ bằng một/hai phương thức còn 300.000đ; cùng key trả lại kết quả không tăng khoản thu; thu nốt trả đủ; vượt nợ bị chặn; lỗi khoản thứ hai rollback; tiền cọc/thẻ/thu thêm không phân bổ; line data cũ không bị sửa khi thu; đảo Payment/Allocation cũ sau thu tổng vẫn đúng; mảng lịch sử giữ nguyên; replay fingerprint trước đổi quy tắc vẫn trả kết quả cũ. Client cũ gửi field deprecated không tạo ledger phân bổ mới hoặc ghi audit sai ý nghĩa.
- `npm run typecheck`: đạt. `npm run build`: đạt với webpack, còn cảnh báo middleware deprecated hiện có. Giữ nội dung next-env.d.ts trước build.
- Playwright Chrome cài sẵn, fixture trong bộ nhớ: 22/22 ca thu tiền/chi tiết và 6/6 ca payment/áp cọc/thẻ đạt trên desktop 1440×900 và mobile 390×844. Xác nhận form chỉ có hai ô tiền, không mục/ô/payload phân bổ cho một/nhiều dịch vụ, trả một phần một/hai phương thức, trả đủ và hóa đơn có dữ liệu dòng lịch sử. Checkbox thực nhận, chặn 0/vượt nợ và kiểm tra bố cục vẫn đạt. Đã xem ảnh desktop/mobile trường hợp bill 2.300.000đ thu hai phương thức. Artifacts: outputs/invoice-level-payment-20261105/.
- Đã cập nhật ca MongoDB integration về thu tổng, các nguồn thanh toán, retry/rollback và đảo khoản lịch sử. `npm run test:integration`: BLOCKED/exit 1 ở DOCKER_CLI vì không tìm thấy docker trong PATH; chưa chạy database tests và không coi model doubles là integration đạt. Không kết nối database khác, migration/backfill hoặc ghi dữ liệu thật.

## Thu ngân thêm nhiều lượt cùng dịch vụ — 05/11/2026

- Bỏ guard trùng serviceId ở serviceInvoice.items và addServices; giữ min/max số lượt, kiểm giá, dịch vụ/kỹ thuật viên active/cùng spa, quyền, transaction tuần tự, idempotency và audit. Mỗi lượt dùng lineId và ledger hoa hồng riêng như cơ chế hiện có. Không sửa dữ liệu hóa đơn/lịch sử hoặc schema/index. Giỏ đã hỗ trợ từng lượt và xóa theo lineId; sửa hướng dẫn cũ còn yêu cầu phân bổ thành thanh toán số còn nợ.
- `npm test`: đạt 242/242. Regression model doubles chạy bằng tài khoản STAFF có quyền thu ngân: cùng dịch vụ 2–3 lần, kỹ thuật viên giống/khác, ID dòng riêng, tổng 700.000đ/1.050.000đ và hoa hồng từng lượt đúng; retry tạo hóa đơn/thanh toán không trùng. Thu 100.000đ tiền mặt + 150.000đ chuyển khoản để lại đúng nợ 450.000đ/800.000đ, không tạo lineAllocations hoặc đổi dòng thực hiện. Bao phủ checkout, dịch vụ thêm khi ghi buổi gói, lỗi lượt sau rollback toàn bộ; giỏ giữ đúng giá/người và tổng khi bỏ lượt giữa.
- `npm run typecheck`: đạt. `npm run build`: đạt (webpack); còn cảnh báo middleware deprecated hiện có. Khôi phục next-env.d.ts đúng nội dung trước build. `git diff --check`: đạt; không có unmerged entry.
- Playwright với Chrome cài sẵn và fixture trong bộ nhớ: 28/28 ca liên quan đạt trên desktop 1440×900 và mobile 390×844, gồm 10 ca dịch vụ lặp và 18 ca thanh toán cấp hóa đơn. Kiểm thêm 2–3 lượt, kỹ thuật viên giống/khác, đổi giá riêng, bỏ lượt giữa giữ đúng lượt còn lại, tổng giỏ và không tràn ngang. Đã xem ảnh desktop/mobile; không chạy hoặc sửa 4 lỗi UI ngoài phạm vi đã ghi trước đây. Artifacts/log: outputs/repeated-services-20261105/.
- Đã bổ sung MongoDB integration cho các ca dịch vụ lặp, hoa hồng, thanh toán một phần và retry bằng quyền thu ngân. `npm run test:integration`: BLOCKED, exit 1 tại DOCKER_CLI vì không tìm thấy docker trong PATH. Chưa chạy các ca database, không coi model doubles/UI fixture là integration đạt; không kết nối database khác.
- Giữ toàn bộ thay đổi thanh toán cấp hóa đơn đang có. Không migration/backfill, commit, push, merge hoặc deploy.

## KTV bắt buộc cho từng lượt thực hiện — 05/11/2026

- Đối chiếu thấy serviceInvoice/addServices và invoice.treatments từng cho phép thiếu KTV, use còn mặc định actor.id. Theo yêu cầu mới nhất, backend và giỏ chặn thiếu KTV với số dòng/lượt + tên, kể cả giá 0. Không dùng người tạo hoặc staffId chung của serviceInvoice/invoice.treatments để bù dòng thiếu. Ghi buổi trực tiếp bỏ fallback người đăng nhập; form STAFF chọn bản thân tường minh. Hoàn thành lịch giữ KTV đã phân công, cả dịch vụ lẻ thêm trong lịch hỗn hợp. Bán gói dùng sau/sản phẩm/hóa đơn lập trước vẫn không bắt KTV. Không sửa dữ liệu cũ, schema/index, chính sách thanh toán hoặc quyền.
- `npm test`: 242/242 đạt. Regression model doubles kiểm thiếu KTV dòng 1/2/3, các lượt cùng dịch vụ, giá 0, thiếu KTV trong treatments/additionalServices/use batch, rollback toàn state gồm counters/ledger/audit/idempotency; giỏ không lấy staffId chung; người tạo chỉ thành KTV nếu được chọn tường minh. Giữ kiểm thử kỹ thuật viên giống/khác, tổng tiền, thanh toán một phần ở cấp hóa đơn và retry. Xác minh bán gói, sản phẩm và hóa đơn lập trước không tự có performedBy/performedAt/ledger thực hiện.
- `npm run typecheck`: đạt sau build. `npm run build`: đạt (webpack), còn cảnh báo middleware deprecated hiện có. Khôi phục next-env.d.ts đúng nội dung trước build. `git diff --check`: đạt.
- Playwright Chrome cài sẵn, fixture trong bộ nhớ: 44/44 ca liên quan đạt trên desktop 1440×900 và mobile 390×844. Gồm 16 ca yêu cầu KTV mới (dòng thiếu 1–3, lượt dùng gói có người riêng, bán gói/sản phẩm/lập trước không bắt KTV, chọn KTV từng lượt trong form hóa đơn) và 28 ca dịch vụ lặp/thanh toán cấp hóa đơn đã có. Không tràn ngang; đã xem ảnh lỗi chỉ rõ dòng và form KTV. Không chạy/sửa 4 lỗi UI ngoài phạm vi đã xác định. Artifacts: outputs/technician-required-20261105/.
- Cập nhật integration theo quy tắc mới: bỏ ca coi KTV là tùy chọn khi đã thực hiện, chọn KTV tường minh trong các ca thành công cũ, giữ ca lịch sử/chứng từ trước làm; thêm kiểm tra thiếu KTV không ghi dở dang. `npm run test:integration`: BLOCKED, exit 1 tại DOCKER_CLI vì không tìm thấy docker trong PATH. Chưa chạy database tests; không coi model doubles hoặc UI fixture là integration đạt. Không kết nối database khác.
- Giữ nhánh feature/invoice-replacement và toàn bộ thay đổi trước đó. Không migration/backfill, commit, push, merge hoặc deploy.

## KTV khi thực hiện dịch vụ tặng kèm trong integration — 05/11/2026

- Chỉ sửa hai test catalog sale và lương/hoa hồng trong tests/integration.test.ts: invoice dùng buổi quà gửi staffId = employee.id; use của nhân viên tính lương gửi staffId = who.id, đều là tài khoản cùng spa. Không sửa backend hoặc nới yêu cầu KTV. Bán gói gửi participantIds theo luồng tư vấn hiện có và không gửi KTV; kiểm chứng từ mua không có performedBy/performedAt.
- Cả hai test thêm lượt gọi thiếu KTV: phải lỗi 400 đúng thông báo chọn KTV; đối chiếu quyền lợi gói, hóa đơn, lượt dùng, hoa hồng, sổ thu, audit/idempotency và Control không thay đổi. Sau đó truyền KTV tường minh và dùng lại key của lần bị từ chối, retry không ghi trùng; kiểm staffId trên lượt thực hiện/hoa hồng và buổi quà về 0. Không suy KTV từ người tư vấn/người tạo/người ghi nhận.
- npm run test:integration: BLOCKED/exit 1 tại DOCKER_CLI, không tìm thấy docker trong PATH. Hai ca database chưa được thực thi trong môi trường này; không ghi integration đạt hoặc dùng database khác.
- npm test: 242/242 đạt. npm run typecheck: đạt. npm run build: đạt; sửa khai báo kiểu của hai callback assertion sau lần build đầu báo TS7006, còn cảnh báo middleware deprecated hiện có. Khôi phục next-env.d.ts đúng nội dung trước build. git diff --check: đạt.
- Log kiểm tra: outputs/gift-performer-integration-20261105/. Không commit, push, merge hoặc deploy; giữ nguyên toàn bộ thay đổi đang có trước yêu cầu này.
