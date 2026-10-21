# Kiểm tra và giới hạn bàn giao

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
# Retest BUG-UI-001/002 — 21/10/2026

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
