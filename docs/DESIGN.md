# Thiết kế chuyển đổi SpaCare

## Nhật ký dễ đọc - 21/10/2026
Theo yêu cầu người dùng: nhật ký OWNER hiển thị nhãn thao tác tiếng Việt, tiền VND, giờ Việt Nam, lý do và thay đổi trước → sau khi bản ghi có snapshot. Bản ghi cũ không có snapshot không suy đoán giá trị trước. Tên tham chiếu lấy từ danh mục hiện tại kèm mã ngắn; tham chiếu không tải được giữ mã để đối chiếu. Chỉ trình bày các trường nghiệp vụ cho phép, không hiển thị JSON, mật khẩu, digest hoặc nét ký. Có tìm kiếm, lọc ngày/người/thao tác và phân trang trong tối đa 500 bản ghi API đã trả. Không đổi API, schema, phân quyền hoặc dữ liệu audit gốc; không ghi mutation khi xem nhật ký.

## Sửa lỗi hiển thị và điều hướng — 21/10/2026

- Bộ lọc danh sách lưu tại query parameter `search`. Mở hóa đơn sau hoàn thành lịch, bấm mã HĐ hoặc mã lịch đều mang mã đầy đủ sang URL đích. Workspace đọc trực tiếp URL, không truyền bộ lọc qua ref của trang cũ; reload và Back/Forward giữ bộ lọc. Nhập tìm kiếm dùng History replaceState được Next.js đồng bộ để không tạo một mục lịch sử cho mỗi ký tự. Điều hướng chỉ đọc dữ liệu đã được API phân quyền, không gọi mutation.
- Chỉ số STAFF giữ điều kiện CONFIRMED và chỉ lịch được phân công cho user hiện tại. Ngày bắt đầu lịch được chuyển bằng `spaDay` theo UTC+7 (Asia/Ho_Chi_Minh) trước khi so với ngày spa; không cắt ngày từ chuỗi UTC. OWNER/thu ngân giữ chỉ số tổng hợp hiện có. Danh sách STAFF vẫn nằm trong cửa sổ tối đa 500 lịch do API trả về; thay đổi này không mở rộng truy vấn hay quyền dữ liệu.
- Trang gốc bọc Workspace trong Suspense để hỗ trợ useSearchParams khi prerender. Không thay schema, API ghi, transaction, idempotency hay audit; các nghiệp vụ OPEN giữ nguyên.

Nguồn: `BRD_SpaCare_v1_1.md` và `README.md` người dùng cung cấp ngày 19/10/2026. Giữ phân biệt nghiệp vụ được spa xác nhận, thiết kế đề xuất và các câu hỏi còn mở.

## Quy tắc được xác nhận và cách chuyển

| BRD | Nội dung | Cách thực hiện trong source |
|---|---|---|
| C01 | Ghi sổ, cuối ngày đưa Excel | Sổ điện tử + chốt ngày; chưa xuất Excel |
| C02 | Không hoàn cọc thông thường; có thể chuyển dịch vụ khi hợp lý | Không tự hoàn; Owner phê duyệt từng phân bổ theo giả định thận trọng |
| C03 | Dư cọc giữ lần sau | `Deposit.balance`; phân bổ không tạo CashEntry |
| C04 | Phiếu liệu trình ký mỗi buổi | Mã tham chiếu phiếu ký; chưa thu chữ ký số |
| C05 | Dừng liệu trình không tự hoàn | Chưa có action kết thúc/bảo lưu, chờ chốt chính sách |
| C06 | Khách nợ và trả sau | `Invoice.total - Invoice.paid`; mỗi lần thu có Payment |
| C07 | Chỉ chủ spa chỉnh khoản đã ghi | STAFF thu ngân chỉ ghi mới; Owner đảo sai sót + audit |
| C08 | Xác nhận thay thế có lý do | Ghi phương thức, lý do, tham chiếu, người ghi, snapshot/digest |
| C09 | Bán gói nhiều buổi, nhận cọc thường xuyên | Treatment gắn Invoice, phân bổ cọc vào Invoice |

## Quyết định kỹ thuật đang áp dụng trong MVP

Các mục này là thiết kế, không được coi là đã có xác nhận bổ sung của spa:

- OWNER duyệt mọi phân bổ cọc (hiện tại). Xác nhận 21/10/2026 (BR-ACCESS-002): nhân viên trực tiếp phục vụ sẽ được xác nhận tiền thực nhận và phân bổ cọc; có code mới. STAFF có `cashier=true` được ghi tiền (giữ nguyên cho các hành động khác). Xác nhận 21/10/2026 (BR-ACCESS-001): STAFF truy cập tab Hóa đơn, Tiền cọc và Sổ thu chi; chưa có code. STAFF thường được quản lý khách, đặt lịch, ghi buổi và kết thúc lịch của mình.
- Tiền nguyên VNĐ thay cho NUMERIC(18,2), tối đa 1.000 tỷ mỗi khoản. Nếu nhập từ SQL có phần lẻ phải xử lý riêng, không tự làm tròn.
- Bản ghi xác nhận append-only qua API hiện tại. Chưa có quy trình sửa/xóa xác nhận, nên không cung cấp nút sửa số buổi lịch sử.
- Ngày chốt là ngày Việt Nam UTC+7. Tiền đầu ngày nhập tay; chỉ mở sổ ngày hiện tại.
- Giao dịch sai được đảo bằng bút toán đối ứng ngày hiện tại. Không cập nhật trực tiếp tiền gốc; cờ `reversed` là projection trạng thái, lịch sử nằm ở CashEntry/Allocation/Audit.
- Chốt sổ phản ánh dòng tiền, không lấy tổng hóa đơn; không tự cân chênh lệch.
- Serialize mutations theo spa bằng Control document trong transaction. Cách đơn giản này ưu tiên tính nhất quán cho spa nhỏ; spa lớn cần khóa theo tài nguyên hoặc ngày sau khi đo tải.
- Route Handlers chạy Node.js; không dùng Edge runtime cho kết nối Mongoose.

## Collections và quan hệ

| Collection/model | Trường trọng tâm | Liên kết / index |
|---|---|---|
| Spa | name, timezone | Đơn vị sở hữu |
| User | spaId, name, email, role, cashier, passwordHash | email unique toàn hệ thống |
| Session | spaId, userId, tokenHash, expiresAt | tokenHash unique, TTL |
| Control | spaId, revision | spaId unique, write guard |
| Customer | spaId, name, phone, notes | spaId + phone, không unique vì BRD còn mở |
| Service | spaId, name, price, duration | Thời lượng phút |
| Appointment | customerId, serviceId, staffId, startAt, endAt, status | spaId + staffId + startAt + endAt |
| Invoice | customerId, serviceId, description, total, paid, dueDate | Snapshot tên và giá khi tạo |
| Deposit | customerId, amount, balance, receiptId | Tiền cọc đã thực nhận |
| Allocation | depositId, invoiceId, amount, approvedBy, reason, reversed | Không tạo dòng tiền mới |
| Payment | invoiceId, amount, receiptId, reversed | Lần thu hóa đơn |
| CashEntry | direction, method, kind, day, amount, originalId | Index theo spa/ngày/phương thức; originalId unique khi có |
| Treatment | customerId, invoiceId, totalSessions, remaining | spaId + invoiceId unique |
| TreatmentUse | treatmentId, method, reason, evidenceReference, snapshot, digest | Không có API UPDATE/DELETE |
| Day | day, opening, expected, counted, difference, status | spaId + day unique |
| Audit | actorId, action, targetId, details | Lịch sử sự kiện và snapshot chốt/mở lại |
| Idempotency | userId, key, fingerprint, result | spaId + key unique |
| Migration | version, appliedAt | version unique |

Mongoose tự đặt tên collection ở số nhiều. Mọi tham chiếu được service tìm với `spaId`; MongoDB không có foreign key nên không được ghi trực tiếp bỏ qua service.

```mermaid
erDiagram
  CUSTOMER ||--o{ INVOICE : receives
  CUSTOMER ||--o{ DEPOSIT : owns
  DEPOSIT ||--o{ ALLOCATION : funds
  INVOICE ||--o{ ALLOCATION : applies
  INVOICE ||--o{ PAYMENT : collects
  PAYMENT ||--|| CASH_ENTRY : records
  INVOICE ||--o| TREATMENT : creates
  TREATMENT ||--o{ TREATMENT_USE : confirms
```

## Tính nhất quán

Mọi mutation chạy trong transaction: tăng revision Control, nạp lại quyền user, kiểm tra idempotency, kiểm tra tham chiếu và bất biến, ghi dữ liệu cùng audit/idempotency, commit majority. Mongoose retry các transient transaction conflicts. Không Promise.all các ghi trong cùng transaction.

Tiền cọc và `Invoice.paid` là projection được cập nhật cùng sự kiện. Tổng `paid` không âm/vượt tổng hóa đơn, phân bổ không vượt số dư cọc, một khoản chỉ đảo một lần. `Treatment.remaining` chỉ giảm cùng bản ghi Use đã có xác nhận. Lịch dùng khoảng nửa mở `[startAt,endAt)`, không trùng cùng nhân viên.

## Những câu hỏi còn mở được giữ từ BRD

1. Nhân viên có được lập hóa đơn dịch vụ không gắn với lịch hẹn không (BR-OPEN-001: OPEN).
2. Thời hạn gói (mặt 1–2 năm, triệt lông 2–5 năm) và bảo lưu nếu có lý do hợp lý; còn mở thời hạn cụ thể từng gói, tiêu chí lý do hợp lý và người duyệt (BR-OPEN-002: PARTIALLY ANSWERED).
3. Xác nhận buổi liệu trình: nhân viên cho khách xác nhận trên app; còn mở phương án thay thế khi không thể xác nhận trên app, chưa được tự kết luận ảnh chụp gửi nhóm chat là đủ (BR-OPEN-003: PARTIALLY ANSWERED).
4. Ngoại lệ hoàn tiền khi spa hủy dịch vụ hoặc không thể tiếp tục cung cấp (BR-OPEN-004: OPEN).
5. Sửa khoản thu chi đã ghi: chỉ chủ spa được sửa; còn mở quy trình mở lại hoặc xử lý khoản ghi nhầm đã chốt sổ (BR-OPEN-005: PARTIALLY ANSWERED).
6. Cách ghi nhận doanh thu gói và doanh thu dịch vụ; phân biệt dòng tiền thực thu và doanh thu kế toán (BR-OPEN-006: OPEN).
7. Dịch vụ triệt lông tính theo buổi hay theo liệu trình (BR-OPEN-007: OPEN).
8. Khách dừng gói không hoàn tiền hoặc đổi sang dịch vụ có giá trị tương đương; còn mở cách tính giá trị phần gói chưa sử dụng và người duyệt (BR-OPEN-008: PARTIALLY ANSWERED).
9. Thời hạn gói bắt đầu tính từ ngày mua hay ngày sử dụng đầu tiên (BR-OPEN-009: OPEN).
10. Khách dùng gói trước và thanh toán trong khoảng 1–2 tuần; còn mở số ngày chính xác và mốc bắt đầu tính thời hạn thanh toán (BR-OPEN-010: PARTIALLY ANSWERED).
11. Công thức tính tiền hoa hồng và thời điểm ghi nhận (BR-OPEN-011: OPEN).
12. Quyền của cấp quản lý xem lương và hoa hồng của nhân viên khác (BR-OPEN-012: OPEN).
13. Quy chế tính lương nhân sự và chu kỳ chốt bảng lương (BR-OPEN-013: OPEN).

## Thay Flyway và dữ liệu cũ

`db:setup` là migration MongoDB phiên bản 1: tạo collections và indexes, seed owner nếu email chưa có, ghi Migration.version=1. Chạy lại không đặt lại mật khẩu. Không sửa hoặc chạy SQL V1/V2 trên MongoDB.

Chưa có dữ liệu/schema SQL V1 trong đầu vào nên chưa viết import giả định. Khi có export cũ cần: backup, mapping ID SQL sang ObjectId, giữ legacyId, đối chiếu tổng cọc/công nợ/thu chi/lượt dùng và UNVERIFIED, giữ bản ghi chưa xác minh, dry-run rồi mới chuyển thật. Không mặc định xác nhận dữ liệu liệu trình cũ.

## Cập nhật 20/10/2026

Đọc `BRD.md`, `BUSINESS_RULES.md`, `DATA_MODEL.md` để theo dõi quy tắc và schemas hiện tại. Yêu cầu người dùng mới đã chốt cần kiểm tra trùng email/SĐT, thay cho mục trùng SĐT còn mở trong bản thiết kế ban đầu. Index SĐT vẫn không unique; operations chuẩn hóa và kiểm tra trong transaction. Đã bổ sung sửa khách/dịch vụ/STAFF và ngừng/mở lại dịch vụ/STAFF; xóa mềm là thiết kế đề xuất đang áp dụng.

## Cập nhật 21/10/2026

Xác nhận phân quyền giao diện (BR-ACCESS-001): STAFF truy cập tab Hóa đơn & công nợ, Tiền cọc và Sổ thu chi; code hiện tại hạn chế các tab này cho finance/cashier, cần cập nhật. Xác nhận nhân viên phục vụ được thu tiền và phân bổ cọc (BR-ACCESS-002): thiết kế kỹ thuật PROPOSED, chưa có code. Bán gói một luồng là nhu cầu CONFIRMED chưa có code (BR-PKG-001). Bổ sung chính sách: thanh toán 1-2 tuần (BR-PKG-002), thời hạn gói theo loại dịch vụ (BR-PKG-003), bảo lưu tùy trường hợp (BR-PKG-004), dừng gói có thể đổi dịch vụ tương đương (BR-TRT-002). Xếp lại lịch hoãn bằng lịch mới xung đột với reschedule-on-same-record hiện tại (BR-TECH-008); cần xét lại code. Rà soát và đồng bộ các câu hỏi mở BR-OPEN-001 đến BR-OPEN-010: phân biệt rõ nội dung đã biết và nội dung còn mở; xác nhận buổi thực hiện trên app và không tự kết luận ảnh chụp nhóm chat là đủ (BR-OPEN-003); giữ nguyên trạng thái OPEN cho các nội dung chưa được chốt.

Thiết kế menu phân cấp (BR-ACCESS-001):
- Tái cấu trúc menu sang dạng phân cấp có khả năng thu gọn/mở rộng:
  - **Tổng quan** (`overview`)
  - **Vận hành**: Lịch hẹn (`appointments`), Khách hàng (`customers`)
  - **Dịch vụ & liệu trình**: Danh mục dịch vụ (`services`), Gói liệu trình (`packages`), Buổi đã sử dụng (`treatment_uses`)
  - **Tài chính**: Hóa đơn & công nợ (`invoices`), Tiền cọc (`deposits`), Sổ thu chi (`cash`), Chốt sổ ngày (`days`), Thống kê dòng tiền (`reports`)
  - **Quản trị**: Nhóm Nhân viên [Danh sách nhân viên (`staff`), Lương (`salary`), Hoa hồng (`commission`)], Nhật ký thao tác (`audit`)
- Mỗi mục con mở một trang riêng biệt, không cuộn gộp trên trang dài.
- Trang Lương và Hoa hồng được phân quyền xem: Nhân viên chỉ xem của chính mình, Chủ spa xem toàn bộ. Công thức tính hoa hồng và quyền quản lý xem nhân viên khác được đánh dấu rõ ràng là OPEN (BR-OPEN-011, BR-OPEN-012, BR-OPEN-013). Hệ thống ghi nhận sản lượng thực tế (ca làm, buổi ghi) mà không tự ý tính toán tiền hoa hồng giả định.


## Cập nhật ưu tiên theo yêu cầu mới nhất — 21/10/2026

Menu phân cấp có thể thu gọn/mở rộng, dùng chung cấu hình cây trên desktop và mobile. Tổng quan tại `/`; mỗi mục hoạt động mở trang riêng `/workspace/{section}`, hỗ trợ tải lại và Back/Forward. Server kiểm tra phiên và quyền: services/staff/audit chỉ OWNER, days/reports OWNER hoặc thu ngân. Không thay đổi quyền ghi tài chính hay phạm vi dữ liệu API workspace.

Yêu cầu này thay thế mô tả trước về trang Lương/Hoa hồng hiển thị sản lượng: chỉ tạo trang hoạt động khi nghiệp vụ được xác định. Hiện hai mục chỉ ghi “Chưa triển khai”, không liên kết, không có trang hoạt động, schema hoặc API lương/hoa hồng. Không tạo kỳ lương giả hay suy ra hoa hồng từ người ghi buổi. Khi triển khai: backend lấy spaId/actorId từ phiên, STAFF chỉ xem của mình, OWNER xem toàn spa. BR-OPEN-011 (công thức/thời điểm hoa hồng), BR-OPEN-012 (quyền quản lý xem nhân viên khác), BR-OPEN-013 (quy chế và kỳ lương) giữ OPEN. Cấu hình route là thiết kế kỹ thuật; không chốt thêm chính sách tài chính.


## Quyết định triển khai luồng — 21/10/2026
Theo yêu cầu mới nhất: triển khai sellPackage, thu tiền/phân bổ cọc cho nhân viên phục vụ và tạo lịch mới khi xếp lại POSTPONED. Các mục kế hoạch/chưa có code trước đó cho các luồng này đã được thay thế; đọc BUSINESS_RULES, DATA_MODEL và API cập nhật.
CONFIRMED: lịch cũ được giữ; bán gói một thao tác; dùng gói còn nợ trong hạn đã chọn; xác nhận tiền thực nhận và tham chiếu ảnh chuyển khoản gửi nhóm; phân bổ cọc giữ số dư.
PROPOSED kỹ thuật đang áp dụng: liên kết lịch kế tiếp bằng rescheduledFromId cùng unique index; STAFF chỉ payment/allocate hóa đơn trực tiếp hoặc gói có lịch CONFIRMED/COMPLETED được giao; hạn thanh toán chọn tường minh trên Invoice; schema/action như API cập nhật. Mọi mutation tuần tự trong transaction, bảo vệ Control theo spa, quyền user được nạp lại, audit và idempotency commit cùng dữ liệu.
OPEN: chế tài quá hạn, chuẩn số ngày và mốc tính hạn; giá trị buổi còn lại khi đổi gói; quy trình/tiêu chí bảo lưu. Không suy ra hoàn tiền, quy đổi buổi hay tự khóa gói. Không giả định tham chiếu ảnh ngân hàng là phương thức xác nhận buổi liệu trình được spa duyệt; BR-OPEN-003 vẫn giữ.


## Thiết kế ghi buổi ký trực tiếp — 21/10/2026
Theo xác nhận mới nhất: thay form chọn phương thức/tham chiếu bằng thông tin khách/gói/người thực hiện/buổi và ô ký tay/chuột. Khách có lịch thực hiện tại Lịch hẹn; không lịch thực hiện trên Gói. Ký lại xóa nét, Hủy không lưu; submit khóa khi chữ ký trống/đang gửi. SVG chỉ render polyline từ tọa độ hữu hạn, không chèn markup từ dữ liệu. Dùng Pointer Events + pointer capture và touch-action:none riêng khung ký; nét lưu tọa độ chuẩn hóa để xem trên nhiều kích thước.
Backend ràng buộc chữ ký với snapshot buổi và remainingBefore trong transaction. Dữ liệu thay đổi khi đang ký trả409, không tự áp chữ ký cũ cho buổi tiếp theo. Chuỗi lịch/gói/khách được kiểm tra cùng spa; không thay quyền thanh toán hoặc thu ngân. Chữ ký đầy đủ tải riêng khi người có quyền mở xem; list và audit không chứa nét ký. Không dùng ảnh ký mẫu/giả cho bản ghi lịch sử.
Bảo lưu: ACTIVE -> PAUSED -> ACTIVE bằng action OWNER, lưu before/after/lý do trong audit, không đổi remaining. Không scheduler tự mở lại, không kéo hạn dùng theo holdUntil. expiresOn là ngày OWNER nhập tường minh khi duyệt gia hạn lúc mở lại, không suy ra hạn gốc hoặc chính sách quá hạn.


## Khôi phục kết nối MongoDB - 21/10/2026

Thiết kế kỹ thuật PROPOSED: chỉ chia sẻ promise đang kết nối; xóa promise khi hoàn tất hoặc thất bại. Sau mất kết nối, lần gọi tiếp theo phải kết nối lại thay vì nhận promise thành công cũ. Log lỗi kết nối chỉ chứa mã phân loại cố định, không chứa thông báo driver có thể mang bí mật. Kiểm tra session cookie trước DB để người chưa đăng nhập vẫn nhận 401 khi DB không sẵn sàng.


## Đồng bộ điều hướng điện thoại - 22/10/2026

Theo yêu cầu người dùng: thanh dưới điện thoại lấy trực tiếp 5 nhóm cấp đầu của menu chung, cùng tên và thứ tự với menu phía trên/desktop. Nhóm mở bảng mục con nổi, không đẩy nội dung trang xuống; Tổng quan mở trang gốc. Mục con giữ kiểm tra canViewPage và mục chưa triển khai giữ trạng thái không bấm được. Đường dẫn nhóm hiện tại suy ra từ cây menu, không duy trì bảng ánh xạ riêng. Chọn mục đóng bảng; hỗ trợ đóng bằng nút, nền ngoài và Escape. Đây là thay đổi trình bày, không đổi API, schema hoặc quyền nghiệp vụ.


## Danh sách và bộ chọn khách hàng lớn - 22/10/2026

Trang Khách hàng tìm và phân trang tại backend, không lọc chỉ trong preview workspace. Bộ chọn khách trong form tìm backend, 20 kết quả mỗi trang, giữ khách đã chọn khi tìm/trang thay đổi; request cũ được hủy để tránh ghi đè kết quả mới. Sửa/thêm khách reload dữ liệu và trang khách. Các bản ghi workspace có tham chiếu khách ngoài preview được nạp đúng tên/điện thoại theo cùng spa. Chưa đổi cơ chế tải 500 của danh sách khác hoặc báo cáo khoảng ngày.


## Phân trang toàn bộ workspace - 22/10/2026

Thay thế cửa sổ dữ liệu cũ: mỗi trang danh sách gọi workspace với section, search, page, pageSize. Tìm kiếm/đếm trước khi cắt trang. Cọc và lịch sử phân bổ đổi trang độc lập. Audit lọc ngày/người/thao tác tại backend. Khi đổi bộ lọc, về trang đầu; response cũ không ghi đè request mới hoặc trang sau điều hướng. Bảng giữ phân trang local cho phần xem nhanh Tổng quan; các danh sách lịch sử dùng metadata backend. Danh mục và lựa chọn nghiệp vụ còn dùng được tải riêng với dữ liệu tham chiếu của trang, giúp lịch sử cũ hiển thị đúng tên. Xóa dòng giới hạn bản ghi trên footer, gói và nhật ký. Báo cáo dùng DB aggregate; không cộng các dòng của một trang.


## Rút gọn chữ trên điện thoại - 22/10/2026

Theo yêu cầu người dùng: gom nút menu biểu tượng vào một hàng cùng thương hiệu/tài khoản; chỉ giữ một H1 của trang. Trên mobile ẩn breadcrumb, eyebrow, mô tả trang, vai trò lặp trong header, footer và tiêu đề panel đầu khi trùng ngữ nghĩa với H1. Tổng quan bỏ phần khẩu hiệu trên mobile, giữ nút đặt lịch và số liệu; tiêu đề các phần khác nhau như lịch gần nhất/biểu đồ/lịch sử phân bổ vẫn giữ. Không ẩn lưu ý nghiệp vụ, lỗi, trạng thái hoặc nội dung xác nhận thanh toán/chữ ký. Desktop giữ cách trình bày hiện có.

### Tìm và chọn khách trong biểu mẫu
- Nhãn tìm khách được in đậm. Kết quả tên và số điện thoại hiển thị ngay dưới ô tìm kiếm dưới dạng danh sách chọn, không cần mở dropdown thứ hai.
- Danh sách có vùng cuộn và phân trang máy chủ, giữ khách đã chọn khi đổi từ khóa hoặc trang; áp dụng cho đặt lịch và các biểu mẫu dùng chung bộ chọn khách.


## Bán gói và hóa đơn — 22/10/2026
- Danh mục liệu trình tách khỏi Gói của khách: OWNER nhập mẫu, nhân viên có quyền bán chọn khách/mẫu/giá/hạn trả, thêm nhiều Quà tặng0đ và tên đợt khuyến mãi.
- Tư vấn mặc định tại form khách; form bán/hóa đơn có lựa chọn thay thế. Danh mục dịch vụ có mức hoa hồng tiền cố định, chưa hiển thị bảng tính trả hoa hồng.
- Tạo hóa đơn: tìm khách, chọn dịch vụ, sửa nội dung/giá; nếu chọn gói khả dụng của khách thì giá khóa0 và yêu cầu ký trước khi lưu. Không bấm thu tiền cho hóa đơn0.
- Hóa đơn có người tạo, nút Chi tiết/chữ ký; chi tiết hiện chữ ký trực tiếp khi được phép, quà tặng và lịch sử. Khách hàng có nút Lịch sử phân trang, mở từng hóa đơn. Menu nhật ký thao tác/buổi sử dụng được ẩn; routes cũ giữ để không phá tham chiếu lịch sử.
- Hoàn thành buổi gói từ lịch hoặc gói mở ngay hóa đơn mới0đ. Hủy ký không ghi/trừ buổi. Không tạo chữ ký/người tạo giả cho dữ liệu cũ.

Lịch sử khách có bộ chọn Hóa đơn và buổi đã thực hiện / Lịch hẹn / Gói đã mua hoặc được tặng; từng loại phân trang độc lập. Hoàn thành lịch lẻ cho người có quyền tài chính sửa nội dung/giá hóa đơn mới ngay trước khi xác nhận.

Chữ ký trong chi tiết hóa đơn: hiển thị ngay hình ký theo từng buổi, ngày thực hiện và tên gói. Hóa đơn mua gói có cả buổi của quà tặng kèm, phân trang5. Hóa đơn/lượt cũ có chữ ký đã lưu được tra qua liên kết gói/lịch, không cần tạo lại hóa đơn. Khi không có chữ ký được phép xem phải hiện trạng thái rõ ràng thay vì ẩn cả mục.


## Thu ngân tham khảo EasySalon — 22/10/2026
- Tham khảo bố cục danh mục cạnh hóa đơn, ô tìm kiếm và chuyển loại dịch vụ/gói đã quan sát trên EasySalon. Dùng màu và thành phần SpaCare, không sao chép dữ liệu tài khoản tham khảo.
- Ba phần: Khách hàng (tìm tên/SĐT phân trang, thêm khách và tự chọn khách vừa tạo); danh mục thẻ (Dịch vụ lẻ/Bán gói/Dùng liệu trình, tìm không dấu, phân trang8); hóa đơn xem trước và tổng tiền.
- Desktop danh mục/hóa đơn cạnh nhau, hóa đơn sticky; tablet/điện thoại xếp dọc, thẻ2 cột. Không có thanh tìm trùng ở header trang này. Đổi khách/loại/xóa lựa chọn xóa chữ ký cũ và lựa chọn liên quan.
- Bán gói có nhiều quà tặng0đ và tên đợt; dùng gói chỉ hiện ACTIVE/còn buổi của khách đã chọn, giá0 và yêu cầu chữ ký. Backend tiếp tục xác minh mọi điều kiện khi lưu.
- Lưu xong mở Chi tiết hóa đơn để xem chữ ký và chọn Thu tiền mặt/Chuyển khoản; form payment xác nhận thực nhận vẫn dùng chung. Reset bản soạn sau khi lưu thành công; lỗi giữ nội dung để sửa/retry. Chọn danh mục không tạo nháp DB.
- Nút Tạo hóa đơn ở danh sách và Bán gói ở gói khách cùng dẫn về Thu ngân; lịch sử/hóa đơn cũ giữ cách truy cập cũ. Không bổ sung giỏ nhiều dịch vụ/sản phẩm hay chính sách tài chính từ EasySalon.


## Các màn tham khảo EasySalon — 22/10/2026
- Thanh bộ lọc chung cho lịch, hóa đơn, cọc, gói, dịch vụ, nhân viên, thu chi/chốt sổ. Bộ lọc lưu URL để tải lại/Back giữ lựa chọn; đổi bộ lọc về trang1. Tìm kiếm vẫn riêng và áp dụng cùng bộ lọc tại backend.
- Lịch: Hôm nay/7 ngày tới/khoảng ngày, chọn trạng thái/nhân viên. Danh sách giữ đầy đủ dời/hoãn/hủy; Lịch theo ngày là agenda phân trang, có giờ/khách/dịch vụ/nhân viên và hoàn thành. Không hứa lịch đã tải đủ toàn bộ ngày khi còn trang khác.
- Khách: cột lần đến/lịch tới theo quyền; hồ sơ có ghi chú/tư vấn/tổng hợp trong phạm vi, ba tab Hóa đơn-chữ ký/Lịch hẹn/Liệu trình. Nút đặt lịch điền sẵn khách; nút thu ngân chọn sẵn khách (chỉ tài chính).
- Dịch vụ: nhập nhóm, lọc nhóm/trạng thái; nhóm gói kế thừa dịch vụ và chọn được ở Thu ngân. Không tự gán nhóm cho dữ liệu cũ.
- Thu chi: mã phiếu/người tạo, chọn tiền mặt/ngân hàng/thu-chi/ngày/nhân viên; ba số thu/chi/chênh lệch tính cả tập lọc. Giữ lưu ý về cọc/thanh toán và đảo sai sót.
- Nhân viên: lọc trạng thái, bấm tên mở hồ sơ sản lượng và xem lịch được giao; giữ sửa/khóa theo OWNER. Không có bảng lương giả.
- Kiểm tra trực quan bằng SSR component thực + dữ liệu minh họa, CSS mobile, không tràn ngang ở viewport thực tế502px. Đây là kiểm tra bố cục tĩnh, không thay kiểm thử tương tác hay database trên ứng dụng đang chạy.


## Giao diện Lương / Hoa hồng — 22/10/2026
Mở hai mục trong Quản trị > Nhân viên, bỏ trạng thái chưa triển khai. STAFF chỉ đọc của mình, OWNER có chọn nhân viên và tháng.
Lương: cấu hình lương từng người; lập nháp tháng với cơ bản/thưởng/khấu trừ/lý do; xem phân rã, số buổi và khoản tồn trước tháng; duyệt; ghi nhận chi qua tiền mặt/chuyển khoản có checkbox thực chi. Bảng duyệt/chi không có sửa/xóa. Danh sách phân trang10. Cài lương không đồng nghĩa đã chi; duyệt không tạo phiếu chi.
Hoa hồng: tổng tiền/số ca-buổi/thành phần chưa chốt, từng dòng dịch vụ/người làm/ngày/nguồn và trạng thái vào bảng/đã chi. Không lấy doanh thu khách trả làm hoa hồng.
Hóa đơn lẻ không lịch có nút Hoàn thành dịch vụ / ghi hoa hồng, chọn người trực tiếp làm; tạo hóa đơn hoặc bán gói chưa ghi Commission. Buổi gói không lịch cho người có quyền chọn nhân viên trước ký; đổi người xóa chữ ký. Có lịch giữ người của lịch.
Các phiếu chi PAYROLL hiển thị Chi lương và không có Đảo sai sót thông thường. Không có chuyển tiền thật hoặc tài khoản ngân hàng nhân viên trong MVP này.


## Cài hoa hồng theo dịch vụ — 22/10/2026
Trang Hoa hồng của OWNER có vùng Hoa hồng theo dịch vụ, nút ＋ Tạo hoa hồng mở chọn dịch vụ + tiền cố định mỗi lần. Danh sách tìm theo tên, phân trang10, Sửa hoa hồng từng dịch vụ; dịch vụ ngừng có nhãn. Chưa có dịch vụ dẫn sang Thêm dịch vụ. STAFF chỉ xem khoản hưởng, không có cấu hình.

## Lịch hẹn ngang và giờ hoạt động - 23/10/2026
CONFIRMED theo yêu cầu người dùng: giờ vận hành 09:00–22:00 Asia/Ho_Chi_Minh. Public booking tạo mốc bắt đầu mỗi 30 phút, lọc theo duration để endAt không vượt 22:00. Backend áp dụng cùng kiểm tra cho appointment, rescheduleAppointment và POST /api/booking. Lịch theo ngày trình bày trục ngang chia theo nhân viên; lịch cũ ngoài giờ vẫn hiện với viền cảnh báo. Đây là giờ hoạt động nghiệp vụ, không thay đổi schema.

## Đặt lịch web và cạnh tranh khung giờ - 23/10/2026
Frontend giữ UUID cho cùng nội dung khi retry, tạo UUID mới nếu nội dung đổi, gửi thời gian theo +07:00 và bỏ số điện thoại giả. Khi backend trả 409, hiển thị thông báo trong role=alert, giữ form để khách chọn giờ khác. Backend kiểm tra overlap bằng startAt < end mới và endAt > start mới, chỉ CONFIRMED, chung Control guard với operations để tránh race. Không trả chi tiết lịch của người khác.

## Đơn giản phiếu kho - 23/10/2026
Nhập/xuất từ thẻ sản phẩm: tiêu đề ghi tên sản phẩm, mô tả có SKU/tồn hiện tại; productId giữ trong defaults, form chỉ nhập số lượng và không hiển thị lý do. Nút nhập/xuất chung vẫn có bộ chọn sản phẩm.

## Ảnh và danh mục sản phẩm công khai - 23/10/2026
Form sản phẩm dùng bộ chọn ảnh với nút Chọn ảnh/Chụp ảnh, preview và Bỏ ảnh. Khóa nút lưu trong lúc tải; lỗi tải giữ ảnh cũ và hiển thị thông báo. Ảnh tối đa 5 MB; HEIC hiển thị hướng dẫn đổi JPG. Menu desktop/mobile/footer có Sản phẩm; danh mục công khai dạng thẻ 3 cột desktop, 2 cột tablet, 1 cột điện thoại, ảnh lazy load, tìm kiếm và phân trang. Không hiển thị dữ liệu kho chính xác cho khách.

## Giao diện dùng chung - 23/10/2026
Theo yêu cầu người dùng: ngoài và trong dùng cùng bộ màu, font, nút, ô nhập và thẻ nội dung trong ui.css. Brand dùng chung cho trang công khai, quản lý và đăng nhập/đăng ký; menu công khai dùng một cấu hình cho desktop/mobile; ServiceCard dùng chung trang chủ và danh mục. Trang chủ rút gọn thành giới thiệu, dịch vụ, sản phẩm qua liên kết và thông tin spa; footer liên hệ gọn, giờ 09:00–22:00. Không đổi route công khai, quyền, dữ liệu hoặc luồng nghiệp vụ; /workspace vẫn là tổng quan quản lý và / là trang chủ công khai.


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
