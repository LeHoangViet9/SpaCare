# SpaCare — Kế hoạch và hướng dẫn kiểm thử (SWT)

Phiên bản: 1.0 — 20/10/2026. Đối tượng: MVP Next.js + MongoDB hiện tại.

## 1. Mục tiêu và phạm vi (Test Plan)

Kiểm tra chức năng, dữ liệu đầu vào, phân quyền và tính nhất quán của cọc, công nợ, liệu trình, sổ tiền, lịch hẹn và danh mục. Đối chiếu `BUSINESS_RULES.md`, `DATA_MODEL.md`, `API.md`. Các rule PROPOSED được kiểm tra theo thiết kế đang có, chưa coi là spa đã nghiệm thu. Rule OPEN chưa có kết quả nghiệp vụ để kết luận Pass/Fail; ghi Deferred và nêu quyết định còn thiếu.

Không nằm trong phạm vi hiện tại: cổng thanh toán, chữ ký điện tử, hoàn tiền ngoại lệ, bảo lưu gói, xuất Excel và kiểm thử tải quy mô lớn. Chức năng chưa có không được ghi Pass.

## 2. Dùng công cụ gì?

| Công cụ | Dùng để làm gì | Loại kiểm thử |
|---|---|---|
| Chrome/Edge + DevTools | Nhập form, bấm nút, xem giao diện và request/response | Manual functional/system, UI |
| Postman | Gọi API với dữ liệu sai hoặc quyền thiếu; thử bỏ qua kiểm tra form | API/system |
| Node.js test runner | Chạy tests/rules.test.mjs, password.test.mjs | Unit test, tự động |
| tsx + MongoDB replica set | Chạy tests/integration.test.ts với transaction thật | Integration test, tự động |
| MongoDB Compass hoặc mongosh | Đọc dữ liệu test để xác minh không ghi trùng/sai số dư | Bằng chứng dữ liệu, không tự thay test |
| Markdown hoặc Excel | Ghi test case, actual result, status, bằng chứng và bug | Quản lý kiểm thử; không tự thực thi test |
| TypeScript / Next build | Kiểm tra kiểu dữ liệu và khả năng biên dịch | Static/build checks; không thay functional test |

Không cần JUnit cho dự án này vì code là TypeScript/Node.js. Hiện chưa có Playwright/Cypress, không gọi các ca thao tác trình duyệt là E2E tự động.

## 3. Thuật ngữ theo môn SWT

- Test scenario: tình huống lớn, ví dụ nhận cọc rồi dùng một phần.
- Test case: điều kiện trước, dữ liệu, bước thao tác và kết quả mong đợi cụ thể.
- Test data: tài khoản/số điện thoại/số tiền/ID dùng để kiểm tra.
- Expected result: kết quả phải xảy ra theo yêu cầu; viết trước khi chạy.
- Actual result: kết quả quan sát thật; ghi sau khi chạy, không chép expected.
- Pass: actual khớp toàn bộ expected, có bằng chứng cần thiết. Fail: khác expected. Blocked: không chạy được do môi trường/tiền điều kiện. Not Run: chưa chạy. Deferred: chờ chốt nghiệp vụ.
- Retest: chạy lại ca đã lỗi sau khi sửa. Regression: chạy các ca liên quan để phát hiện ảnh hưởng phụ.

## 4. Chuẩn bị môi trường

Chỉ dùng dữ liệu giả trên máy phát triển. Trước thao tác thủ công, cấu hình app dùng database thử riêng (ví dụ spacare_manual_test), không dùng dữ liệu spa thật. Giữ bản cấu hình vận hành riêng và không ghi bí mật vào báo cáo.

1. Mở Docker Desktop và chờ engine hoạt động.
2. Trong terminal tại thư mục dự án: `docker compose up -d`.
3. Đặt `.env.local` trỏ replica set/database thử riêng, APP_ORIGIN đúng `http://localhost:3000`; seed owner bằng email test và mật khẩu riêng tối thiểu 12 ký tự.
4. Chạy `npm run db:setup`, sau đó `npm run dev`; nếu app đã chạy thì khởi động lại sau đổi env.
5. Mở http://localhost:3000, đăng nhập OWNER.
6. Tạo STAFF A không có quyền thu ngân và STAFF B có quyền thu ngân; dùng ba hồ sơ trình duyệt hoặc đăng xuất/đăng nhập để tránh lẫn phiên.
7. Trong DevTools → Network, bật Preserve log khi cần; chỉ lưu bằng chứng đã che cookie/mật khẩu/dữ liệu riêng tư.

Dữ liệu nền: khách KH-A, SĐT 0900000001; KH-B, 0900000002; dịch vụ DV-A giá 350.000đ/60 phút; DV-B giá 2.000.000đ/60 phút. Email nhân viên dùng địa chỉ riêng có đuôi example.test, không gửi email thật. Mỗi lần chạy ghi RUN-ID như RUN-20261020-01 vào tên/ghi chú để phân biệt dữ liệu. Dùng số điện thoại khác khi lặp ca tạo mới.

Các ca độc lập cần bản ghi riêng; không tái dùng cọc đã bị tiêu hết hoặc ngày đã chốt. Ca ngày/sổ làm theo thứ tự một lần trong ngày trên spa test; chốt sổ cuối lượt. Không xóa lịch sử tài chính để chuẩn bị lại test.

## 5. Trình tự test nên làm ngay

1. Chạy unit test: `npm test`; đọc tổng pass/fail.
2. Chạy static check: `npm run typecheck`.
3. Chạy build: `npm run build`; ghi lỗi môi trường riêng nếu có.
4. Smoke test: đăng nhập → thêm khách → thêm dịch vụ → mở sổ → nhận cọc → tạo hóa đơn → phân bổ cọc → đối chiếu.
5. Chạy ca âm và ca biên: trùng email/SĐT, tiền 0/âm/vượt nợ, lịch trùng, thiếu xác nhận.
6. Dùng tài khoản STAFF/thu ngân gọi API để kiểm tra backend chặn quyền, không chỉ xem nút có ẩn không.
7. Chạy integration trên database riêng spacare_test theo mục 7.
8. Test font, mobile, bàn phím; ghi bug → sửa → retest → regression.
9. Tổng hợp kết quả; chủ spa nghiệm thu quy trình thật trước khi đưa vào dùng.

### Luồng mẫu đầy đủ: cọc 500k, dịch vụ 350k

1. OWNER vào Chốt sổ ngày → Mở sổ hôm nay → nhập opening=1.000.000đ. Expected: ngày OPEN, chưa phát sinh khoản thu 1.000.000đ.
2. Tiền cọc → Nhận cọc → KH-A, 500.000đ, CASH. Expected: Deposit amount/balance=500.000đ, một CashEntry IN/DEPOSIT=500.000đ.
3. Hóa đơn → Tạo hóa đơn → KH-A, DV-A. Expected: total=350.000đ, paid=0, nợ=350.000đ.
4. Tiền cọc → Áp dụng cọc → đúng cọc KH-A và hóa đơn vừa tạo, 350.000đ, lý do test. Expected: balance=150.000đ, paid=350.000đ, nợ=0; không có khoản thu mới.
5. Đọc sổ: thu tiền mặt vẫn 500.000đ. Quỹ kỳ vọng nếu không có giao dịch khác =1.500.000đ.
6. Chỉ khi xong các ca ghi tiền khác mới Chốt sổ, nhập số thực đếm để kiểm tra chênh lệch.

## 6. Test API bằng Postman

Không dùng Postman chỉ để chứng minh request hợp lệ chạy được; cần gửi dữ liệu mà form HTML có thể chặn trước khi tới backend.

Tạo Environment: baseUrl=http://localhost:3000, origin=http://localhost:3000. Dùng đúng host nhất quán; localhost và 127.0.0.1 khác origin/cookie. Không export mật khẩu hoặc cookie vào tài liệu.

### Đăng nhập

POST `{{baseUrl}}/api/auth/login`

Headers: Content-Type: application/json; Origin: {{origin}}.

Body raw JSON (thay bằng tài khoản test):

```json
{"email":"owner@example.test","password":"<mật khẩu test đã seed>"}
```

Postman cookie jar lưu Set-Cookie `spacare_session`. Kiểm tra cookie tồn tại cho localhost; không chỉ đăng nhập trên trình duyệt rồi mong Postman tự có phiên. Với STAFF, đăng nhập lại tài khoản đó và xác minh GET /api/workspace trả đúng role/cashier.

### Tạo khách và thử trùng

POST `{{baseUrl}}/api/operations`

Headers: Content-Type: application/json; Origin: {{origin}}; Idempotency-Key: {{$guid}}.

```json
{"action":"customer","data":{"name":"RUN-01 API customer","phone":"0900000010","notes":"test"}}
```

Ghi lại id trả về. Gửi lần nữa cùng số nhưng **key mới**: mong đợi 409 và không tạo khách thứ hai. Nếu key giữ nguyên và payload giữ nguyên, đó là kiểm tra retry, phải trả kết quả trước chứ không phải lỗi trùng.

### Kiểm tra backend chặn thu ngân đảo tiền

Đăng nhập STAFF có cashier=true; lấy một CashEntry id thuộc spa test. Gửi action reverseCash với key mới:

```json
{"action":"reverseCash","data":{"id":"<CashEntry ObjectId>","reason":"Test quyền"}}
```

Expected: 403, CashEntry gốc và số dư không đổi. ID placeholder phải thay bằng ObjectId thực, không gửi nguyên dấu <>.

### Kiểm tra idempotency

Đặt header bằng một UUID cố định của lượt test, không dùng {{$guid}} khi cần giữ key. Gửi cùng action/payload hai lần: cùng id, chỉ một ghi tiền. Giữ key nhưng đổi amount: 409. Khi kiểm tra song song dùng integration; bấm Send lần lượt không chứng minh tính đồng thời.

### Script kiểm tra response tùy chọn

Trong Scripts → Post-response, ví dụ ca trùng khách:

```javascript
pm.test('Trùng SĐT trả HTTP 409', function () {
  pm.response.to.have.status(409);
});
pm.test('Có thông báo lỗi', function () {
  pm.expect(pm.response.json().error).to.be.a('string');
});
```

Phải đối chiếu thêm GET /api/workspace hoặc dữ liệu test để xác minh không tạo bản ghi ngoài ý muốn. Mã 500 do mất database không phải kết quả đúng của ca validation.

## 7. Integration test tự động

Tạo `.env.test.local` (không commit bí mật), ví dụ MongoDB replica set local:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/spacare_test?replicaSet=rs0
```

Đảm bảo Docker/replica set truy cập được, rồi chạy:

```powershell
npm run test:integration
```

Script yêu cầu đúng database spacare_test; tự tạo spa/dữ liệu test và dọn theo spa trong finally. Không cần seed vào database này trước; tạo collections/indexes do test thực hiện. Dừng và kiểm tra cấu hình nếu kết nối sai DB. Không chạy trực tiếp script này trên database thủ công hoặc vận hành.

Bộ hiện có kiểm tra operate + MongoDB, không đi qua HTTP/cookie/origin và không thay các ca Postman/trình duyệt. Một test cha chứa nhiều assert; số test hiển thị không phải số test case trong tài liệu. EACCES/ECONNREFUSED là Blocked ở bước kết nối, không được kết luận nghiệp vụ Pass.

## 8. Thiết kế test theo kỹ thuật SWT

| Kỹ thuật | Áp dụng | Bộ dữ liệu / kết quả |
|---|---|---|
| Equivalence Partitioning | SĐT | Hợp lệ: 0900000001; sai: abc, rỗng; trùng: số đã tồn tại |
| Boundary Value Analysis | duration 5–480 | 4 fail, 5 pass, 6 pass; 479 pass, 480 pass, 481 fail; mỗi lần dùng dịch vụ mới |
| Boundary Value Analysis | Khoản thu từ 1 đến MAX_MONEY | 0 fail, 1 pass, MAX_MONEY pass nếu nghiệp vụ cho phép, MAX_MONEY+1 fail; kiểm tra schema qua cash hoặc unit test, không tạo tiền khổng lồ trên dữ liệu thật |
| Decision Table | Quyền đảo giao dịch | OWNER được; STAFF thu ngân và STAFF thường đều 403; chưa đăng nhập 401 khi Origin đúng |
| State Transition | Lịch hẹn | CONFIRMED → COMPLETED/CANCELLED; không chuyển tiếp lần nữa; hoàn thành trước giờ bắt đầu bị chặn |
| State Transition | Sổ ngày | Chưa mở → OPEN → CLOSED → OPEN bởi OWNER có lý do |
| Concurrency | Cọc/lượt cuối | Hai request tranh cùng số dư; chỉ request hợp lệ được commit, không âm |
| Regression | Sửa giá dịch vụ | Giá mới áp hóa đơn mới; total hóa đơn cũ không đổi |

Expected ở ca biên là theo thiết kế MVP đang áp dụng. Với quy tắc còn OPEN, cần chốt trước khi lập expected nghiệp vụ cuối cùng.

## 9. Danh sách test case

Mỗi case bên dưới mặc định **Not Run trong đợt test thủ công này**. Ưu tiên P0: tiền/quyền/tính nhất quán; P1: chức năng chính; P2: giao diện. Dùng biểu mẫu mục 10 để ghi actual, status, evidence cho từng TC-ID.

### TC-AUTH-01 — Đăng nhập hợp lệ

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser |
| Rule / cơ sở | Phiên đăng nhập MVP |
| Tiền điều kiện | Chưa đăng nhập; OWNER test hoạt động. |
| Các bước / dữ liệu | Nhập email/mật khẩu đúng; bấm đăng nhập; tải lại trang. |
| Kết quả mong đợi | Vào workspace đúng OWNER; tải lại vẫn có phiên. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-AUTH-02 — Sai mật khẩu

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser/Postman |
| Rule / cơ sở | Phiên đăng nhập MVP |
| Tiền điều kiện | Có tài khoản test; tránh vượt ngưỡng rate limit trong ca này. |
| Các bước / dữ liệu | Nhập email đúng, mật khẩu sai một lần; thử truy cập GET /api/workspace không cookie. |
| Kết quả mong đợi | Không vào workspace; đăng nhập sai trả lỗi xác thực, workspace không cookie trả 401. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-AUTH-03 — STAFF thường bị chặn tài chính

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Postman/Browser |
| Rule / cơ sở | BR-TECH-002 |
| Tiền điều kiện | Đăng nhập STAFF A cashier=false; sổ test đang OPEN. |
| Các bước / dữ liệu | POST cash với direction=IN, amount=1000, method=CASH, note=test; key và Origin hợp lệ. |
| Kết quả mong đợi | HTTP 403; không có khoản thu mới; giao diện không lộ bảng tài chính. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-CUS-01 — Thêm khách hợp lệ

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser |
| Rule / cơ sở | BR-IDENT-001 |
| Tiền điều kiện | OWNER; SĐT chưa có trong spa. |
| Các bước / dữ liệu | Thêm KH-A với 0900000001; tải lại và tìm số. |
| Kết quả mong đợi | Đúng một khách được lưu, tên/SĐT đúng. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-CUS-02 — Trùng SĐT khác định dạng

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Postman |
| Rule / cơ sở | BR-IDENT-001; BR-TECH-006 |
| Tiền điều kiện | Đã có 0900000001. |
| Các bước / dữ liệu | POST customer mới với +84 900 000 001 và key mới. |
| Kết quả mong đợi | 409; báo trùng; không thêm document. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-CUS-03 — Sửa khách giữ số của mình

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser/Postman |
| Rule / cơ sở | BR-IDENT-001; BR-CATALOG-001 |
| Tiền điều kiện | KH-A và KH-B tồn tại. |
| Các bước / dữ liệu | Sửa tên KH-A, giữ số cũ; lưu. Sau đó sửa KH-A sang số của KH-B. |
| Kết quả mong đợi | Lần đầu thành công; lần sau 409, dữ liệu không bị ghi đè. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-STAFF-01 — Email trùng không phân biệt hoa thường

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Postman |
| Rule / cơ sở | BR-IDENT-001; BR-TECH-006 |
| Tiền điều kiện | OWNER; STAFF có staffa@example.test. |
| Các bước / dữ liệu | Tạo STAFF mới email STAFFA@EXAMPLE.TEST, mật khẩu đủ 12 ký tự; key mới. |
| Kết quả mong đợi | 409; chỉ một tài khoản giữ email đó. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-STAFF-02 — Sửa và khóa nhân viên

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser/Postman |
| Rule / cơ sở | BR-CATALOG-001; BR-TECH-007 |
| Tiền điều kiện | STAFF test chưa có lịch CONFIRMED; giữ phiên STAFF ở trình duyệt khác. |
| Các bước / dữ liệu | OWNER sửa tên/cashier rồi lưu; ngừng hoạt động STAFF; từ phiên STAFF cũ gọi POST customer. |
| Kết quả mong đợi | Thông tin được lưu; STAFF ngừng hoạt động; request ghi từ phiên cũ trả 401; mở lại được. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-STAFF-03 — Không khóa OWNER

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Postman |
| Rule / cơ sở | BR-TECH-007 |
| Tiền điều kiện | OWNER đang đăng nhập; có owner id từ workspace user.id. |
| Các bước / dữ liệu | POST userStatus với id OWNER, active=false. |
| Kết quả mong đợi | 403; OWNER còn hoạt động. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-SVC-01 — Giá snapshot không bị thay

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser |
| Rule / cơ sở | BR-CATALOG-001; BR-TECH-005 |
| Tiền điều kiện | DV-A giá 350000; đã tạo invoice I1 từ DV-A. |
| Các bước / dữ liệu | Sửa giá DV-A thành 400000; tạo invoice I2; xem I1/I2. |
| Kết quả mong đợi | I1 vẫn 350000; I2 là 400000. Khôi phục DV-A 350000 trước luồng cọc mẫu. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-SVC-02 — Thời lượng ở biên

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Postman |
| Rule / cơ sở | BR-TECH-005 |
| Tiền điều kiện | OWNER; dùng tên dịch vụ riêng cho mỗi lần gửi. |
| Các bước / dữ liệu | POST service với duration lần lượt 4,5,6,479,480,481, price=350000. |
| Kết quả mong đợi | 4 và 481 trả 400; 5,6,479,480 thành công; duration không bị tự làm tròn. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-SVC-03 — Ngừng hoạt động giữ lịch sử

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser/Postman |
| Rule / cơ sở | BR-TECH-007 |
| Tiền điều kiện | Dịch vụ test có hóa đơn cũ, không có lịch CONFIRMED. |
| Các bước / dữ liệu | Ngừng dịch vụ; xem danh sách chọn tạo hóa đơn/lịch; POST invoice trực tiếp dùng service id đã ngừng. |
| Kết quả mong đợi | Không chọn được dịch vụ ngừng; backend từ chối tạo invoice; hóa đơn cũ vẫn còn. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-APT-01 — Lịch giao nhau và nối tiếp

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser/Postman |
| Rule / cơ sở | BR-TECH-005 |
| Tiền điều kiện | Một STAFF hoạt động; DV duration=60; chọn ngày mai theo giờ Việt Nam. |
| Các bước / dữ liệu | Đặt 09:00; thử cùng STAFF 09:30; thử 10:00. |
| Kết quả mong đợi | 09:00 thành công, 09:30 trả 409, 10:00 được; giờ kết thúc đúng. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-APT-02 — Quá khứ và trạng thái lịch

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Postman |
| Rule / cơ sở | BR-TECH-005 |
| Tiền điều kiện | Có lịch tương lai CONFIRMED của STAFF A. |
| Các bước / dữ liệu | Thử đặt quá khứ; thử hoàn thành lịch tương lai; hủy lịch rồi yêu cầu hủy lần nữa. |
| Kết quả mong đợi | Quá khứ và hoàn thành sớm bị chặn; chỉ hủy lần đầu thành công; không tự thu tiền/trừ buổi. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-APT-03 — Chặn ngừng khi còn lịch

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser/Postman |
| Rule / cơ sở | BR-TECH-007 |
| Tiền điều kiện | Dịch vụ và STAFF test có lịch CONFIRMED. |
| Các bước / dữ liệu | OWNER gọi serviceStatus và userStatus active=false; sau đó hủy lịch rồi thử lại. |
| Kết quả mong đợi | Trước hủy trả 409 và active giữ nguyên; sau hủy có thể ngừng nếu không còn lịch CONFIRMED khác. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-DAY-01 — Chưa mở sổ không ghi tiền

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Browser/Postman |
| Rule / cơ sở | BR-TECH-004 |
| Tiền điều kiện | Spa test chưa có Day hôm nay; khách đã có. |
| Các bước / dữ liệu | Nhận cọc CASH=500000; sau đó mở sổ opening=1000000. |
| Kết quả mong đợi | Trước mở sổ không tạo Deposit/CashEntry; sau mở Day OPEN và opening đúng, không có khoản thu opening. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-DAY-02 — Không mở trùng ngày

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Postman |
| Rule / cơ sở | BR-TECH-004 |
| Tiền điều kiện | Day hôm nay OPEN. |
| Các bước / dữ liệu | Gửi openDay lần nữa với key mới; thử opening=-1 và day ngày mai. |
| Kết quả mong đợi | Các request bị từ chối; không thêm Day thứ hai, không đổi opening cũ. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-DEP-01 — Cọc dư giữ lần sau

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Browser/Postman/Compass |
| Rule / cơ sở | BR-DEP-003; BR-TECH-001 |
| Tiền điều kiện | Day OPEN; KH-A; invoice 350000 chưa trả; cọc mới 500000 CASH. |
| Các bước / dữ liệu | Ghi số CashEntry trước phân bổ; OWNER phân bổ 350000 đúng khách; tải lại dữ liệu. |
| Kết quả mong đợi | Balance=150000; invoice paid=350000/nợ=0; không tăng số CashEntry do phân bổ; thực thu=500000 của khoản test. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-DEP-02 — Vượt cọc/nợ và khác khách

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Postman |
| Rule / cơ sở | BR-DEP-003; BR-TECH-001 |
| Tiền điều kiện | Cọc KH-A balance=150000; invoice KH-A nợ=100000; invoice KH-B nợ>0. |
| Các bước / dữ liệu | Thử phân bổ 150001 vào invoice KH-A; thử 100001; thử 50000 vào invoice KH-B. |
| Kết quả mong đợi | Tất cả bị chặn; balance và paid không đổi. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-DEP-03 — Hủy lịch không tự hoàn cọc

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Browser |
| Rule / cơ sở | BR-DEP-001 |
| Tiền điều kiện | Khách có cọc 500000 chưa dùng và lịch CONFIRMED; ghi số dư/giao dịch trước test. |
| Các bước / dữ liệu | Hủy lịch; xem cọc, sổ và audit. |
| Kết quả mong đợi | Lịch CANCELLED; cọc vẫn 500000; không phát sinh CashEntry hoàn hoặc đảo cọc. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-INV-01 — Thanh toán từng phần

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Browser/Compass |
| Rule / cơ sở | BR-DEBT-001 |
| Tiền điều kiện | Day OPEN; invoice 2000000 riêng; cọc 500000 riêng của cùng khách. |
| Các bước / dữ liệu | Áp cọc 500000; thu thêm 1000000 bằng BANK_TRANSFER. |
| Kết quả mong đợi | Paid=1500000; nợ=500000; có một Payment/CashEntry 1000000; tiền mặt không tăng bởi chuyển khoản. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-INV-02 — Không thu vượt nợ

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Postman |
| Rule / cơ sở | BR-TECH-001 |
| Tiền điều kiện | Invoice nợ=500000; Day OPEN. |
| Các bước / dữ liệu | POST payment amount=500001; sau đó thử 0,-1,0.5; mỗi request key mới. |
| Kết quả mong đợi | Từ chối tất cả; paid không đổi; không có Payment/CashEntry mới. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-TRT-01 — Ghi buổi với xác nhận

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Browser/Compass |
| Rule / cơ sở | BR-TRT-001; BR-TECH-003 |
| Tiền điều kiện | Gói 10 buổi mới; invoice riêng; chưa dùng buổi. |
| Các bước / dữ liệu | Ghi 3 buổi SIGNATURE_REFERENCE với mã phiếu TEST-01/02/03. |
| Kết quả mong đợi | Có 3 TreatmentUse; remaining=7; mỗi buổi có actor, thời điểm và tham chiếu. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-TRT-02 — Xác nhận thay thế thiếu lý do

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Postman |
| Rule / cơ sở | BR-TRT-001 |
| Tiền điều kiện | Gói còn buổi; ghi remaining trước test. |
| Các bước / dữ liệu | POST use ALTERNATIVE có evidenceReference nhưng reason rỗng; sau đó gửi reason hợp lệ với key mới. |
| Kết quả mong đợi | Lần đầu bị chặn, không giảm buổi; lần sau tạo một Use và giảm đúng 1. Bằng chứng giả chỉ dùng cho test. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-CASH-01 — Chỉ OWNER đảo sai sót

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Postman/Compass |
| Rule / cơ sở | BR-CASH-001; BR-TECH-004 |
| Tiền điều kiện | Day OPEN; có CashEntry INCOME CASH=100000 chưa đảo. |
| Các bước / dữ liệu | STAFF thu ngân gọi reverseCash; OWNER gọi cùng action với key mới và lý do; OWNER đảo lại lần nữa. |
| Kết quả mong đợi | STAFF trả 403; OWNER tạo OUT/REVERSAL=100000, gốc còn và reversed=true; đảo lần hai bị chặn. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-DAY-03 — Chốt quỹ có chênh lệch

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Browser/Compass |
| Rule / cơ sở | BR-TECH-004 |
| Tiền điều kiện | Một lượt độc lập: opening=1000000, tổng thu CASH=2000000, tổng chi CASH=500000; không có tiền mặt khác. |
| Các bước / dữ liệu | Chốt counted=2450000; kiểm tra Day và CashEntry. |
| Kết quả mong đợi | Expected=2500000; difference=-50000; CLOSED; không tạo khoản cân sổ. Khoản BANK_TRANSFER không đổi expected. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-DAY-04 — Khóa ngày và mở lại

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Postman/Browser |
| Rule / cơ sở | BR-TECH-004; BR-CASH-001 |
| Tiền điều kiện | Hôm nay CLOSED; có khoản test cần ghi. |
| Các bước / dữ liệu | Thử cash IN=1000; STAFF thu ngân thử reopenDay; OWNER mở lại có reason; gửi cash lần nữa bằng key mới. |
| Kết quả mong đợi | Trước mở lại không ghi tiền; STAFF 403; OWNER mở lại có audit; sau mở lại ghi được. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-API-01 — Retry không ghi trùng

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Postman |
| Rule / cơ sở | BR-TECH-002 |
| Tiền điều kiện | Day OPEN; khách có sẵn; dùng UUID cố định. |
| Các bước / dữ liệu | POST deposit 500000 cùng key/payload hai lần; rồi cùng key đổi amount=500001. |
| Kết quả mong đợi | Hai lần đầu trả cùng id, một Deposit/CashEntry; lần đổi payload 409. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-API-02 — Origin và phiên

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Postman |
| Rule / cơ sở | BR-TECH-002 |
| Tiền điều kiện | Request operation hợp lệ và tài khoản test. |
| Các bước / dữ liệu | Gửi có cookie nhưng Origin khác APP_ORIGIN; rồi đúng Origin nhưng xóa cookie. |
| Kết quả mong đợi | Lần đầu 403; lần sau 401; không mutation. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-API-03 — Cách ly dữ liệu spa

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / Integration/Postman |
| Rule / cơ sở | BR-TECH-002 |
| Tiền điều kiện | Hai spa test tách biệt; tạo fixture qua môi trường integration hoặc seed test riêng; không có UI tạo spa. |
| Các bước / dữ liệu | Actor spa A thử invoice tham chiếu customer id spa B; key/Origin hợp lệ khi đi HTTP. |
| Kết quả mong đợi | 404; không tạo invoice hoặc ghi dữ liệu spa B. Nếu chưa có fixture thì Blocked, không giả lập bằng ID ngẫu nhiên. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-CON-01 — Cạnh tranh số dư/lượt cuối

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P0 / npm run test:integration |
| Rule / cơ sở | BR-TECH-002; BR-TECH-003 |
| Tiền điều kiện | Database spacare_test khả dụng. |
| Các bước / dữ liệu | Chạy integration: hai phân bổ 350000 tranh cọc 500000 và hai use tranh gói 1 buổi. |
| Kết quả mong đợi | Mỗi cặp đúng một request thành công; cọc còn 150000; gói còn 0; không hai Use buổi cuối. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-UI-01 — Font tiếng Việt và responsive

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P2 / Browser/DevTools |
| Rule / cơ sở | Hiển thị UTF-8 |
| Tiền điều kiện | Browser desktop và viewport 390px; đã có dữ liệu giả. |
| Các bước / dữ liệu | Kiểm tra tổng quan/đăng nhập, các chữ Đã đặt, Khách hàng, Liệu trình; mở bảng dịch vụ, modal; Ctrl+F5. |
| Kết quả mong đợi | Dấu đúng, không ô vuông/chồng dấu/cắt chữ; cột thẳng, bảng cuộn ngang khi cần; modal đọc và thao tác được. Ghi ảnh thực tế. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-UI-02 — Bàn phím modal

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P2 / Browser |
| Rule / cơ sở | Khả dụng giao diện |
| Tiền điều kiện | Một form thêm/sửa đang mở. |
| Các bước / dữ liệu | Dùng Tab/Shift+Tab qua các trường; Escape để đóng khi không busy; nhập sai rồi lưu. |
| Kết quả mong đợi | Focus nằm trong modal; Escape đóng; lỗi đọc được và dữ liệu nhập không mất khi server báo lỗi. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

### TC-OPEN-01 — Dừng gói còn 7 buổi

| Thuộc tính | Nội dung |
|---|---|
| Ưu tiên / công cụ | P1 / Browser/review |
| Rule / cơ sở | BR-TRT-002; BR-OPEN-002 |
| Tiền điều kiện | Gói 10 buổi đã dùng 3. |
| Các bước / dữ liệu | Kiểm tra chưa có tự động hoàn/xóa buổi. Chưa thực hiện đóng/bảo lưu vì chưa có workflow/chính sách. |
| Kết quả mong đợi | Không tự hoàn tiền. Phần đóng/bảo lưu: Deferred, chờ quyết định; không ghi toàn bộ chức năng dừng gói là Pass. |
| Kết quả thực tế | Chưa thực hiện trong đợt manual này |
| Trạng thái / bằng chứng | Not Run / Chưa có |

## 10. Ghi kết quả chạy và báo lỗi

Copy bảng dưới cho mỗi lượt; cập nhật status của case tương ứng sau khi kiểm tra. Không lấy lịch sử 8 unit test đạt để điền Pass vào các case manual/API chưa chạy.

| Run ID | TC-ID | Tester | Ngày/giờ VN | Môi trường / phiên bản code | Actual Result | Status | Evidence | Bug ID |
|---|---|---|---|---|---|---|---|---|
| RUN-YYYYMMDD-01 | TC-DEP-01 | Điền tên | Điền thời gian | Local / phiên bản hoặc mốc sửa | Ghi số dư, paid, số CashEntry thực tế | Not Run | Chưa có | — |

Mẫu bug report:

- Bug ID: BUG-001.
- Summary: mô tả ngắn hiện tượng và điều kiện xảy ra.
- Related TC / Rule: ví dụ TC-DEP-01 / BR-DEP-003.
- Environment: OS, browser/version, database test, phiên bản code.
- Preconditions / Steps: dữ liệu giả cụ thể và các bước tái hiện đánh số.
- Expected / Actual: tách riêng, ghi số tiền và trạng thái thực tế.
- Severity: Critical (sai/mất tiền, vượt quyền), Major (chặn luồng chính), Minor (ảnh hưởng nhỏ), Cosmetic (trình bày).
- Priority: P0/P1/P2 do nhóm sắp xếp xử lý; severity và priority không phải một khái niệm.
- Evidence: ảnh, response đã che bí mật, log cần thiết. Không lưu cookie/token/password.
- Status: New → In Progress → Fixed → Retest → Closed; nếu vẫn lỗi → Reopened.

Ví dụ minh họa, **không phải lỗi đã quan sát**: “Sau phân bổ cọc 350k, có thêm CashEntry thu 350k” → Critical vì thu bị đếm hai lần. Chỉ tạo bug thật khi đã có bước tái hiện và actual.

## 11. Tiêu chí kết thúc và Test Summary Report

Bắt đầu khi app/database test sẵn sàng, có đúng tài khoản/fixture và expected rõ. Nếu thiếu điều kiện thì Blocked.

Có thể kết thúc lượt test khi toàn bộ case trong phạm vi đã có trạng thái và bằng chứng; các P0/P1 đã thực hiện và đạt, không còn bug Critical/Major chưa xử lý; các mục Deferred/Blocked được ghi rõ và có người chịu trách nhiệm quyết định. Chưa kiểm tra tiền/quyền trên MongoDB thật thì chưa nghiệm thu vận hành.

Mẫu tổng hợp: Total, Pass, Fail, Blocked, Not Run, Deferred; số bug theo mức độ; rủi ro còn lại; đề nghị nghiệm thu/chưa nghiệm thu. Pass rate trên ca đã chạy = Pass/(Pass+Fail), nhưng luôn báo thêm coverage = (Pass+Fail)/Total để không che số ca chưa chạy.

Trạng thái có bằng chứng từ phiên làm việc trước:

| Nhóm | Kết quả đã biết | Phạm vi chứng minh |
|---|---|---|
| Unit test | 8/8 đạt | Quy tắc thuần và password tại lần chạy đó |
| TypeScript | Đạt | Typecheck; không chứng minh giao diện đúng |
| Integration | Blocked: EACCES kết nối 127.0.0.1:27017 | Chưa xác minh transaction thực tế trong phiên này |
| Build | Blocked bởi quyền filesystem/junction | Chưa có build thành công |
| Manual/API trong tài liệu này | Chưa chạy | Không có kết quả nghiệm thu |

Không tự động tính các ca trong mục 9 là đã đạt chỉ vì test tự động có nội dung tương tự. Ghi ngày/phiên bản và lưu output riêng khi chạy lại.

## 12. Kiểm tra thông báo sau thao tác — cập nhật 20/10/2026

Các ca dưới đây chưa chạy trên trình duyệt (Not Run):

| TC-ID | Bước thực hiện | Expected |
|---|---|---|
| TC-UI-03 | Thêm khách thành công; đợi 3 giây. Lặp lại rồi chuyển sang Dịch vụ ngay. | Thông báo thành công tự hết sau 3 giây; chuyển mục xóa ngay. |
| TC-UI-04 | Đặt lịch bị trùng nhân viên để tạo lỗi; đóng form; lần lượt mở các mục khác. | Lỗi chỉ hiện trong form khi đang mở; đóng form hoặc chuyển mục xóa lỗi, không lặp ở trang khác. |
| TC-UI-05 | DevTools làm chậm mạng; gửi yêu cầu đặt lịch rồi chuyển mục trước khi có phản hồi (thử cả thành công và lỗi). | Dữ liệu vẫn được tải lại sau ghi thành công; thông báo/form từ thao tác cũ không xuất hiện ở mục mới, kể cả chuyển đi rồi quay lại. |

Lỗi trong form giữ lại để đọc và sửa dữ liệu; lỗi ngoài form trong workspace tự ẩn sau 6 giây. Kiểm tra typecheck không thay thế các ca UI này.

## 13. Kiểm thử hoãn/dời lịch

Các ca mới chưa chạy UI; integration cần MongoDB spacare_test.

| TC-ID | Tiền điều kiện và bước | Expected | Trạng thái |
|---|---|---|---|
| TC-APT-04 | Lịch CONFIRMED ngày mai 14h–15h; dời sang 16h, lý do khách đến muộn | Giờ mới 16h–17h, cùng id, CONFIRMED; audit giữ giờ cũ/mới; không thu tiền | Not Run |
| TC-APT-05 | Hoãn lịch 14h với lý do chưa biết ngày; tạo lịch khác cùng nhân viên vào 14h | Lịch gốc POSTPONED, ghi rõ giờ cũ; tạo lịch khác thành công | Not Run |
| TC-APT-06 | Xếp lại lịch hoãn vào slot đang bận; sau đó vào slot trống | Lần đầu 409 và giữ POSTPONED/giờ cũ; lần sau CONFIRMED đúng slot | Not Run |
| TC-APT-07 | Hủy lịch đang hoãn rồi thử dời/hoàn thành | CANCELLED; dời/hoàn thành bị từ chối; không hoàn cọc tự động | Not Run |
| TC-APT-08 | STAFF A thử dời lịch STAFF B; hoặc tự giao lịch mình cho B | 403; lịch không đổi | Not Run |
| TC-APT-09 | Dời vào quá khứ, thiếu reason, nhân viên ngừng hoặc khác spa | Bị từ chối; không đổi lịch hay audit thành công | Not Run |
| TC-APT-10 | Lịch cũ 60 phút; danh mục sửa 90 phút; dời lịch cũ | Giữ 60 phút; hóa đơn cũ không đổi | Not Run |
| TC-APT-11 | Gửi dời hai lần cùng key/payload; thử cạnh tranh slot cùng nhân viên | Retry một audit/mutation; slot không bị chiếm trùng | Not Run |

Ca tự động bổ sung vào tests/integration.test.ts: hoãn thiếu lý do, giải phóng giờ, dời trùng/quá khứ, quyền khác nhân viên, giữ thời lượng, retry và audit, hủy từ hoãn và không phát sinh tiền. Ca cạnh tranh hai lịch khác id cùng slot vẫn cần kiểm tra thêm theo bảng.

## 14. Kiểm thử liên kết lịch–hóa đơn

Các ca UI mới Not Run; các assert integration đã bổ sung nhưng chỉ có giá trị thực thi khi database spacare_test kết nối được.

| TC-ID | Tiền điều kiện / bước | Expected | Trạng thái |
|---|---|---|---|
| TC-BILL-01 | OWNER/thu ngân, lịch CONFIRMED đã đến giờ; mở Hoàn thành & lập hóa đơn rồi Hủy | Lịch vẫn CONFIRMED, chưa có invoice | Not Run |
| TC-BILL-02 | Lịch dịch vụ 350k đã đến giờ; xác nhận tạo mới | Cùng transaction: COMPLETED, một invoice appointmentId đúng, total=350k/paid=0/OPEN; không CashEntry; chuyển sang đúng hóa đơn | Not Run |
| TC-BILL-03 | Gửi hai lần cùng key rồi retry key mới cho cùng lịch | Cùng invoiceId; chỉ một invoice gắn lịch | Not Run |
| TC-BILL-04 | Có hóa đơn thủ công đúng khách/dịch vụ, chưa gắn lịch; chọn liên kết | Không thêm invoice, giữ nguyên total/paid/status/hạn trả cũ; thêm appointmentId; lịch COMPLETED | Not Run |
| TC-BILL-05 | Chọn hóa đơn khác khách/dịch vụ/spa, đã gắn lịch khác hoặc hóa đơn gói | Backend từ chối; lịch và invoice không bị cập nhật một phần | Not Run |
| TC-BILL-06 | STAFF gọi completeAppointment cho lịch mình rồi lịch STAFF khác; thử gửi existingInvoiceId/dueDate | Lịch mình tạo invoice tự động; lịch khác hoặc tùy chỉnh hóa đơn bị 403. STAFF không xem/thu tiền | Not Run |
| TC-BILL-07 | Lịch tương lai hoặc POSTPONED/CANCELLED; gọi completeAppointment | Bị chặn, không tạo invoice | Not Run |
| TC-BILL-08 | Gửi dueDate không tồn tại 2026-02-30 | Bị chặn; lịch giữ CONFIRMED và chưa có invoice | Not Run |
| TC-BILL-09 | Hoàn thành khi chưa mở sổ, sau đó thử Payment khi chưa mở sổ | Lập hóa đơn được; thu tiền bị chặn đến khi mở sổ | Not Run |
| TC-BILL-10 | Click mã hóa đơn trên lịch và mã lịch trên hóa đơn | Mở đúng mục, lọc đúng bản ghi; mã liên kết vẫn còn sau reload | Not Run |

Để test thủ công, tạo lịch gần nhất trong tương lai rồi đợi tới giờ; không chỉnh đồng hồ máy hoặc sửa database vận hành. Integration tạo fixture lịch quá khứ trực tiếp trong spa test riêng để kiểm tra điều kiện giờ bắt đầu.

## 15. Kiểm thử lịch thuộc gói và thanh toán

Các ca UI/API mới Not Run. Cần khởi động lại app, tạo index và dùng database thử.

| TC-ID | Các bước / dữ liệu | Expected | Trạng thái |
|---|---|---|---|
| TC-PKG-01 | Chọn khách và dịch vụ có một gói ACTIVE còn buổi | Gợi ý gói đúng; chọn khách/dịch vụ khác thì xóa gợi ý cũ; không lộ lựa chọn sai khách | Not Run |
| TC-PKG-02 | Có nhiều gói cùng khách/dịch vụ; mở form đặt lịch | Cho chọn đúng gói; không tự quyết định gói; có thể để trống mua lẻ | Not Run |
| TC-PKG-03 | Đặt lịch gói 7 buổi, tới giờ hoàn thành với phiếu TEST-01 | COMPLETED; remaining=6, một Use có appointmentId; không thêm invoice/cash/payment | Not Run |
| TC-PKG-04 | Hoàn thành ALTERNATIVE thiếu lý do hoặc thiếu mã xác nhận | Không trừ buổi, lịch giữ nguyên; form báo lỗi | Not Run |
| TC-PKG-05 | Gửi hoàn thành cùng lịch gói hai lần, thử key cũ và key mới | Một Use, giảm đúng 1, trả cùng treatmentUseId | Not Run |
| TC-PKG-06 | Gói hết buổi sau khi đã đặt nhưng trước lúc hoàn thành | Báo hết buổi; không âm, không hoàn thành và không tự tạo invoice dịch vụ lẻ | Not Run |
| TC-PKG-07 | API chọn treatmentId của khách/dịch vụ/spa khác | Backend chặn; không có lịch sai liên kết | Not Run |
| TC-PKG-08 | STAFF khác người phụ trách gọi hoàn thành; hoặc gọi appointmentStatus COMPLETED cho lịch gói | Chặn; không bỏ qua xác nhận/trừ buổi | Not Run |
| TC-PAY-01 | Invoice 350k chưa trả; nhận 100k tiền mặt, tick thực nhận | paid=100k, nợ=250k, PARTIALLY_PAID; một CashEntry CASH | Not Run |
| TC-PAY-02 | Invoice còn nợ 250k; mở QR/chuyển khoản nhưng chưa xác nhận | Vẫn nợ 250k và chưa đổi trạng thái/ghi tiền | Not Run |
| TC-PAY-03 | Đối chiếu chuyển khoản 250k rồi tick thực nhận/lưu | paid=350k, PAID, một Payment/BANK_TRANSFER; không tăng tiền mặt | Not Run |
| TC-PAY-04 | Gửi payment thiếu receivedConfirmation hoặc false | 400; paid và sổ không đổi. Ca API tiền sai khác cần gửi receivedConfirmation=true để kiểm tra đúng validation đang nhắm tới | Not Run |
| TC-PAY-05 | Đảo sai khoản thu cuối của hóa đơn đã PAID | PAID trở lại PARTIALLY_PAID theo paid; đảo hết trở OPEN | Not Run |
| TC-PAY-06 | Chưa cấu hình BANK_* hoặc ảnh QR | Báo chưa cấu hình; không dùng tài khoản/mã giả; không tự đánh dấu PAID | Not Run |
| TC-PAY-07 | Cấu hình ngân hàng + ảnh QR chính thức của tài khoản test | Hiện ngân hàng/STK/tên/QR đúng; số tiền nhập và nội dung SPACARE + invoiceId rõ ràng; QR tĩnh không tự điền tiền | Not Run |

Các kiểm thử cũ gửi action payment cần thêm receivedConfirmation=true khi mô phỏng khoản thực thu hợp lệ. Ghi nhận tiền kiểm thử chỉ dùng tài khoản/dữ liệu giả; kiểm tra giao diện QR không yêu cầu chuyển tiền thật.

## 16. Kiểm thử giao diện điện thoại

Cập nhật thiết kế: dưới hoặc bằng 700px, sidebar thay bằng chọn mục trên đầu + thanh truy cập nhanh bốn mục ở đáy. Bảng thành thẻ có nhãn cột, không bỏ các nút nghiệp vụ. Form mở dạng bottom sheet. Desktop giữ bảng và sidebar.

Dùng Chrome/Edge DevTools (F12 → Toggle device toolbar) ở 320, 360, 390, 430, 700px và desktop 1280px; nếu có điều kiện đối chiếu thêm Safari iPhone và Chrome Android thật. Các ca bên dưới chưa xác minh bằng trình duyệt trong phiên sửa này.

| TC-ID | Bước kiểm tra | Expected | Trạng thái |
|---|---|---|---|
| TC-MOB-01 | Mở tổng quan ở 320/360/390/430px; cuộn tới cuối | Không tràn ngang toàn trang; số tiền đọc đủ, nội dung cuối không bị thanh đáy che | Not Run |
| TC-MOB-02 | Chọn mọi mục qua menu đầu; dùng bốn nút đáy; thử STAFF và OWNER | Mục được đánh dấu đúng; danh sách mục theo quyền; vẫn có nút đăng xuất | Not Run |
| TC-MOB-03 | Xem lịch hẹn, hóa đơn, khách, dịch vụ, gói, sổ tiền | Mỗi bản ghi thành thẻ với nhãn; có đủ giá/giờ/trạng thái và thao tác; không phải kéo ngang bảng | Not Run |
| TC-MOB-04 | Mở form đặt lịch/hoàn thành/thu tiền; bật bàn phím điện thoại và cuộn | Form vừa màn hình, cuộn được; nút lưu/đóng tiếp cận được; không cuộn trang sau modal | Not Run |
| TC-MOB-05 | Nhập liệu và tick thực nhận tiền bằng chạm | Ô nhập cỡ chữ 16px; checkbox/nút dễ chạm; không tick nhầm do hai nút sát nhau | Not Run |
| TC-MOB-06 | Xem thông tin chuyển khoản với tên dài và QR; mở audit chi tiết dài | Nội dung tự xuống dòng, QR không vượt chiều rộng, không tràn màn hình | Not Run |
| TC-MOB-07 | Đổi chiều màn hình và resize qua 700px; thử desktop 1280px | Desktop lại hiển thị bảng; mobile có thẻ; không xuất hiện hai menu cùng lúc | Not Run |
| TC-MOB-08 | Dùng Tab/Shift+Tab và trình đọc màn hình ở bảng/thẻ | Tiêu đề cột còn trong cấu trúc table, focus rõ, không có nút ẩn vẫn nhận focus | Not Run |

## 17. Phân trang danh sách

Thiết kế giao diện: desktop mặc định 10 bản ghi/trang; điện thoại khi mở danh sách mặc định 5. Có chọn 5/10/20/50; Trước/Sau và tổng bản ghi đang lọc. Tìm kiếm, chuyển mục hoặc đổi số dòng đưa về trang đầu. Mỗi bảng có trang riêng. Đây là phân trang phía giao diện trên tối đa 500 bản ghi backend đã tải, chưa phải truy vấn phân trang toàn database.

| TC-ID | Bước | Expected | Trạng thái |
|---|---|---|---|
| TC-PAGE-01 | Mở danh sách 13 lịch trên desktop | 10 dòng trang 1; Sau có 3 dòng; Trước ở đầu/Sau ở cuối bị vô hiệu hóa | Not Run |
| TC-PAGE-02 | Đang trang 2, tìm đúng tên hoặc mã hóa đơn | Về trang đầu của kết quả lọc; không hiện trang trắng do giữ offset cũ | Not Run |
| TC-PAGE-03 | Chọn 5/20/50 dòng | Về trang 1, số dòng và nhãn phạm vi đúng; không mất nút nghiệp vụ | Not Run |
| TC-PAGE-04 | Mở danh sách mới trên điện thoại | Mặc định 5 thẻ; chuyển trang đưa lên đầu danh sách, menu đầu không che điều khiển | Not Run |
| TC-PAGE-05 | Lọc không có kết quả hoặc dữ liệu ít hơn một trang | Hiện rỗng/range đúng, không có nút chuyển trang thừa | Not Run |

## 18. Bảng desktop gọn chiều ngang

Cập nhật theo phản hồi kéo ngang quá dài: lịch hẹn gộp thành 6 cột (khách/dịch vụ, nhân viên, giờ, trạng thái/hóa đơn, chi tiết, thao tác); hóa đơn gộp thành 6 cột (khách/mã, dịch vụ, số tiền, trạng thái, lịch/hạn trả, thao tác). Nội dung dài xuống dòng; bảng dùng table-layout:fixed theo chiều rộng vùng nội dung; các nhóm nút nằm trong menu Thao tác. Gói/lý do/ghi chú vẫn xem được trong Chi tiết. Mobile vẫn dùng thẻ.

| TC-ID | Bước | Expected | Trạng thái |
|---|---|---|---|
| TC-WIDTH-01 | Xem lịch/hóa đơn ở desktop 1024/1280/1440px với sidebar | Các cột nằm trong vùng nội dung, chữ dài xuống dòng, không cần kéo ngang để tìm thao tác | Not Run |
| TC-WIDTH-02 | Mở Thao tác trên lịch và hóa đơn, dùng chuột và bàn phím | Đủ nút hiện có; chọn mở đúng form; menu không bị cắt ở cạnh panel | Not Run |
| TC-WIDTH-03 | Mở Chi tiết, xem gói/lý do/ghi chú, bấm mã hóa đơn/lịch | Thông tin không bị mất và liên kết vẫn hoạt động | Not Run |
| TC-WIDTH-04 | Thử tên khách/dịch vụ/email dài và chuyển về 390px | Không kéo giãn toàn trang; mobile vẫn đọc được thẻ và thao tác | Not Run |
