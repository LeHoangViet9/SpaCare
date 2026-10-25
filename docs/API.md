# API nội bộ

API dùng cookie session cùng origin. Phải đăng nhập, không chấp nhận `spaId` hay `actorId` do client gửi để quyết định quyền.

| Endpoint | Nội dung |
|---|---|
| POST /api/auth/login | `{email,password}` → set cookie |
| POST /api/auth/logout | Thu hồi session hiện tại |
| GET /api/workspace | Dữ liệu theo spa/quyền; danh sách phân trang, số tổng quan aggregate toàn bộ |
| POST /api/operations | `{action,data}` + header `Idempotency-Key` |

Ví dụ tạo lịch, thời gian phải có UTC offset:

```json
{"action":"appointment","data":{"customerId":"OBJECT_ID","serviceId":"OBJECT_ID","staffId":"OBJECT_ID","startAt":"2026-11-01T09:00:00+07:00","notes":""}}
```

| Action | Quyền | Payload chính |
|---|---|---|
| customer | Tất cả nhân viên | name, phone, notes? |
| service | OWNER | name, price, duration |
| user | OWNER | name, email, password, cashier? |
| appointment | Nhân viên | customerId, serviceId, staffId, startAt, notes? |
| appointmentStatus | OWNER/thu ngân/người được phân công | id, status: COMPLETED/CANCELLED |
| invoice | OWNER/thu ngân (hiện tại); chưa rõ nhân viên có được lập hóa đơn dịch vụ không gắn với lịch hẹn không (BR-OPEN-001) | customerId, serviceId, dueDate? |
| deposit | OWNER/thu ngân | customerId, amount, method, note? |
| allocate | OWNER (hiện tại); dự kiến mở rộng cho nhân viên phục vụ theo BR-ACCESS-002 (chưa có code) | depositId, invoiceId, amount, reason |
| reverseAllocation | OWNER | id, reason |
| payment | OWNER/thu ngân (hiện tại); dự kiến mở rộng cho nhân viên phục vụ theo BR-ACCESS-002 (chưa có code) | invoiceId, amount, method, receivedConfirmation=true, note? |
| cash | OWNER/thu ngân | direction: IN/OUT, amount, method, note |
| reverseCash | OWNER | id, reason |
| treatment | OWNER/thu ngân | invoiceId, name, totalSessions |
| use | Nhân viên; khách xác nhận trên app; phương án thay thế khi không dùng được app còn mở (BR-OPEN-003) | treatmentId, method, reason?, evidenceReference |
| openDay | OWNER/thu ngân | day: YYYY-MM-DD, opening |
| closeDay | OWNER/thu ngân | day, counted, note? |
| reopenDay | OWNER | day, reason |

Tiền là integer VNĐ; method thanh toán là CASH/BANK_TRANSFER. Method xác nhận buổi là SIGNATURE_REFERENCE/ALTERNATIVE; ALTERNATIVE bắt buộc reason. Nhân viên cho khách xác nhận buổi liệu trình trên app; phương án thay thế khi không thể xác nhận trên app còn mở, chưa tự kết luận ảnh chụp nhóm chat là đủ (BR-OPEN-003). Không gửi ảnh/base64 trong evidenceReference.

Mã lỗi: 400 dữ liệu/quy tắc; 401 hết phiên; 403 quyền/origin; 404 dữ liệu không trong spa; 409 xung đột; 413 body lớn; 429 giới hạn đăng nhập; 500 lỗi chưa xử lý; 503 thiếu khởi tạo. Không có PATCH/DELETE sổ tiền hoặc xác nhận.

## Thao tác danh mục bổ sung — 20/10/2026

| Action | Quyền | Payload |
|---|---|---|
| updateCustomer | OWNER | id, name, phone, notes? |
| updateService | OWNER | id, name, price, duration |
| serviceStatus | OWNER | id, active: boolean |
| updateUser | OWNER, chỉ sửa STAFF | id, name, email, cashier: boolean |
| userStatus | OWNER, chỉ đổi STAFF | id, active: boolean |

Email được trim/lowercase; SĐT khách được chuẩn hóa +84 thành 0 và bỏ dấu phân cách trước kiểm tra trùng. Email unique toàn hệ thống; SĐT kiểm tra trong spa. Sửa giữ định danh của chính bản ghi được phép. Đổi active=false bị chặn nếu còn lịch CONFIRMED; lịch sử vẫn giữ. Chi tiết trạng thái chính sách: BUSINESS_RULES.md.

## Hoãn và dời lịch — 20/10/2026

| Action | Quyền | Payload |
|---|---|---|
| appointmentStatus | OWNER/thu ngân/người được phân công | id, status: COMPLETED/CANCELLED/POSTPONED, reason?; POSTPONED bắt buộc lý do |
| rescheduleAppointment | OWNER/thu ngân; STAFF chỉ lịch mình và giữ mình thực hiện | id, staffId, startAt (ISO có offset), reason bắt buộc |

CONFIRMED được dời/hoãn/hủy/hoàn thành; POSTPONED được xếp lại bằng rescheduleAppointment hoặc hủy. COMPLETED/CANCELLED không được đổi tiếp. Hoãn không giữ slot cũ; dời kiểm tra giao nhau và loại chính bản ghi đang sửa. Thay đổi không tác động cọc/hóa đơn/liệu trình. UI dời có thể chọn ngày/giờ sớm hơn hoặc muộn hơn giờ cũ nhưng phải là tương lai tại lúc lưu. Chưa có ghi nhận giờ đến thực tế.

## Hoàn thành và lập/liên kết hóa đơn

POST /api/operations, action=completeAppointment, quyền OWNER/thu ngân hoặc STAFF được phân công trên lịch đó; STAFF không được gửi existingInvoiceId hoặc dueDate.

```json
{"action":"completeAppointment","data":{"id":"APPOINTMENT_OBJECT_ID","existingInvoiceId":"OPTIONAL_INVOICE_OBJECT_ID","dueDate":"2026-11-01"}}
```

Bỏ existingInvoiceId để tạo mới hoặc dùng lại hóa đơn đã liên kết. Bỏ dueDate nếu chưa có hạn trả. Body ví dụ dùng placeholder cần thay bằng ObjectId thực. Response: {id: appointmentId, invoiceId, message}. Yêu cầu Idempotency-Key và Origin như các mutation khác.

Chấp nhận CONFIRMED hoặc COMPLETED đã đến giờ. CONFIRMED chuyển COMPLETED cùng việc tạo/liên kết invoice trong một transaction. Invoice đã có được dùng lại, kể cả request key mới; nếu chọn invoice khác với invoice đã liên kết thì 409. Invoice có sẵn phải cùng spa/khách/dịch vụ, chưa gắn lịch khác và chưa dùng tạo gói.

Không ghi tiền/cọc/buổi; không cần mở sổ để lập hóa đơn. Khi thực nhận tiền vẫn cần sổ OPEN và action payment; áp cọc theo allocate do OWNER duyệt. appointmentStatus COMPLETED cũ cho dịch vụ lẻ cũng tự tạo invoice khi nhân viên hoàn thành lịch mình; UI tài chính có nút Lập / liên kết hóa đơn cho lịch đã hoàn thành chưa có liên kết.

## Lịch thuộc gói và xác nhận thanh toán

- appointment nhận thêm treatmentId tùy chọn. Backend kiểm tra gói cùng spa, đúng khách/dịch vụ, ACTIVE và remaining>0. Để trống là lịch dịch vụ lẻ.
- completeTreatmentAppointment: {id,method:SIGNATURE_REFERENCE|ALTERNATIVE,evidenceReference,reason?}. Quyền OWNER/thu ngân/STAFF được phân công. Lịch phải CONFIRMED hoặc COMPLETED và đã tới giờ; lịch hoãn/hủy bị từ chối. Lần đầu yêu cầu xác nhận hợp lệ, ghi 1 buổi và hoàn thành atomically; retry lịch đã có Use trả treatmentUseId cũ, không giảm thêm. Response {id,treatmentUseId,message}.
- completeAppointment từ chối lịch có treatmentId. appointmentStatus COMPLETED cũng từ chối lịch gói để không bỏ qua xác nhận/trừ buổi.
- payment bổ sung receivedConfirmation: true bắt buộc. Các client/test cũ cần gửi trường này. Không chấp nhận false hoặc thiếu trường; vẫn cần quyền thu ngân, mở sổ và không vượt nợ.
- Trạng thái invoice trả về OPEN/PARTIALLY_PAID/PAID dựa trên paid/total. CashEntry mới chỉ tạo sau Payment; quét mã không gọi Payment tự động.
- GET workspace trả paymentInfo cho tài khoản tài chính: bankName,accountNumber,accountName,qrImagePath; không có khi chưa cấu hình hoặc không đủ quyền.

Ví dụ ghi nhận chuyển khoản đã đối chiếu thực nhận:

```json
{"action":"payment","data":{"invoiceId":"INVOICE_OBJECT_ID","amount":100000,"method":"BANK_TRANSFER","receivedConfirmation":true,"note":"SPACARE INVOICE_OBJECT_ID"}}
```

## Hành động kế hoạch — 21/10/2026

Các action sau **chưa có trong code**; được ghi để theo dõi yêu cầu đã xác nhận. Không dùng cho client cho đến khi có phiên bản chính thức.

| Action dự kiến | Quyền | Mục đích |
|---|---|---|
| sellPackage | OWNER/thu ngân (dự kiến) | Tạo Invoice và Treatment trong cùng transaction; không cần tạo hóa đơn trước (BR-PKG-001) |

Lưu ý `rescheduleAppointment` hiện tại cập nhận bản ghi POSTPONED cùng chỗ. Theo yêu cầu mới (BR-TECH-008), luồng xếp lại lịch hoãn sẽ tạo Appointment mới thay vì cập nhận; thiết kế API cho luồng này chưa chốt.
Cập nhật tự tạo invoice: STAFF được phân công gọi completeAppointment với {id} cho dịch vụ lẻ. Backend tự lập invoice, nhưng STAFF không được chọn hóa đơn/hạn trả, truy cập tài chính hoặc nhận tiền. Quyền lập hóa đơn dịch vụ độc lập không gắn với lịch hẹn cho nhân viên vẫn chưa chốt (BR-OPEN-001). appointmentStatus COMPLETED cũng lập invoice dịch vụ lẻ để giữ tương thích. Response invoiceId chỉ làm tham chiếu; quyền xem/ghi tài chính không thay đổi.


## Cập nhật ưu tiên theo yêu cầu mới nhất — 21/10/2026

Menu phân cấp có thể thu gọn/mở rộng, dùng chung cấu hình cây trên desktop và mobile. Tổng quan tại `/`; mỗi mục hoạt động mở trang riêng `/workspace/{section}`, hỗ trợ tải lại và Back/Forward. Server kiểm tra phiên và quyền: services/staff/audit chỉ OWNER, days/reports OWNER hoặc thu ngân. Không thay đổi quyền ghi tài chính hay phạm vi dữ liệu API workspace.

Yêu cầu này thay thế mô tả trước về trang Lương/Hoa hồng hiển thị sản lượng: chỉ tạo trang hoạt động khi nghiệp vụ được xác định. Hiện hai mục chỉ ghi “Chưa triển khai”, không liên kết, không có trang hoạt động, schema hoặc API lương/hoa hồng. Không tạo kỳ lương giả hay suy ra hoa hồng từ người ghi buổi. Khi triển khai: backend lấy spaId/actorId từ phiên, STAFF chỉ xem của mình, OWNER xem toàn spa. BR-OPEN-011 (công thức/thời điểm hoa hồng), BR-OPEN-012 (quyền quản lý xem nhân viên khác), BR-OPEN-013 (quy chế và kỳ lương) giữ OPEN. Cấu hình route là thiết kế kỹ thuật; không chốt thêm chính sách tài chính.


## API vận hành cập nhật — 21/10/2026
Các mô tả cũ “sellPackage chưa có code”, “allocate chỉ OWNER” và “STAFF không thu tiền” được thay thế trong phạm vi sau. Mọi action giữ Origin, Idempotency-Key, session actor, transaction và audit.

| Action | Quyền và payload |
|---|---|
| sellPackage | OWNER/thu ngân; {customerId, serviceId, name, totalSessions:1..1000, total:integer VND dương, dueDate:YYYY-MM-DD}. Ngày hợp lệ, không trước ngày bán theo UTC+7; không tự chọn 7/14 ngày. Response {id:treatmentId,invoiceId,message}. Chưa tạo payment/cash. |
| rescheduleAppointment | Quyền cũ giữ nguyên; {id,staffId,startAt,reason}. POSTPONED tạo lịch mới, giữ lịch cũ; response thêm replacementAppointmentId. Mỗi lịch hoãn chỉ có một lịch kế tiếp, key mới lặp lại trả 409; cùng key/payload trả kết quả cũ. CONFIRMED vẫn dời tại chỗ. |
| payment | OWNER/thu ngân hoặc STAFF được giao lịch liên kết trực tiếp/gói; {invoiceId,amount,method,receivedConfirmation:true,note?,transferReference?}. BANK_TRANSFER bắt buộc note hoặc transferReference có ít nhất 3 ký tự, mô tả/tham chiếu ảnh gửi nhóm. CASH xác nhận đã đếm và nhận. Không vượt nợ, cần sổ hôm nay OPEN. |
| allocate | OWNER hoặc STAFF có lịch CONFIRMED/COMPLETED được giao liên kết hóa đơn trực tiếp/gói; {depositId,invoiceId,amount,reason}. Cùng khách/cùng spa, không vượt nợ/số dư. Không tạo khoản thu mới, không cần mở sổ cho phân bổ. Quyền reverseAllocation vẫn chỉ OWNER. |

GET workspace mở dữ liệu hóa đơn/cọc/phân bổ đúng phạm vi cho nhân viên phục vụ; invoice bổ sung canAllocate, treatment bổ sung paymentDueDate/paymentOverdue. Đọc không thay quyền ghi. STAFF không tự tạo hóa đơn dịch vụ độc lập hoặc bán gói. Không có API đổi gói/bảo lưu mới. Hạn quá hạn chỉ cảnh báo, không tự khóa gói (chế tài OPEN).


## API ký trực tiếp và bảo lưu — 21/10/2026 (ưu tiên hơn mô tả cũ)
POST /api/operations giữ Origin, phiên đang hoạt động, cùng spa, Idempotency-Key, transaction/audit. Giới hạn body65536ký tự; signature chỉ nhận vector giới hạn, không nhận SVG/HTML/base64/URL.
| Action | Payload và quyền |
|---|---|
| use | {treatmentId,signature:{version:1,strokes:[[[x,y],...],...]},remainingBefore}. STAFF/OWNER như quyền ghi buổi hiện hành. Nhân viên phiên là người thực hiện cho buổi không lịch. Chỉ ACTIVE/còn buổi. |
| completeTreatmentAppointment | {id,signature,remainingBefore}. OWNER/thu ngân/STAFF phụ trách lịch. Giữ kiểm tra lịch tới giờ, đúng khách/dịch vụ/gói. Hoàn thành lịch + ghi Use + trừ1 atomically. Lịch đã ghi dùng lại Use cũ. |
| pauseTreatment | Chỉ OWNER. {id,holdUntil:YYYY-MM-DD,reason}. Gói ACTIVE/còn buổi; ngày hợp lệ từ hôm nay; chuyển PAUSED, giữ remaining/hạn sử dụng. |
| extendTreatmentHold | Chỉ OWNER. {id,holdUntil,reason}. Gói PAUSED, ngày mới sau ngày bảo lưu cũ và không trước hôm nay; vẫn PAUSED, không đổi hạn sử dụng. |
| resumeTreatment | Chỉ OWNER. {id,reason,expiresOn?:YYYY-MM-DD}. Gói PAUSED/còn buổi. Bỏ expiresOn giữ nguyên hạn; nếu nhập phải hợp lệ, từ hôm nay và sau hạn cũ nếu có. Không tự cộng ngày. |
Payload method/evidenceReference cũ không thay thế chữ ký cho buổi mới. remainingBefore không khớp trả409, yêu cầu tải lại và ký lại; thiếu/trống/sai chữ ký trả400 và không đổi dữ liệu.
GET /api/treatment-uses/{id}: phiên active, cùng spa; OWNER hoặc actorId/staffId của buổi được xem. Response {signature,snapshot,performedAt,digest}, Cache-Control:no-store,private. STAFF khác403; spa khác404; chưa đăng nhập401. GET workspace giữ ẩn nét ký và snapshot, list chỉ có nhãn đã ký/sessionNumber.


## Xử lý mất kết nối DB - 21/10/2026

Thiết kế kỹ thuật PROPOSED: request không có cookie trả 401 trước khi kết nối DB; login kiểm tra Origin và payload trước khi kết nối. Lỗi kết nối DB trả 503, Cache-Control: no-store, với code cố định DB_CONFIG_MISSING, DB_CONFIG_INVALID, DB_AUTH_FAILED, DB_DNS_FAILED hoặc DB_CONNECTION_FAILED. Không trả URI, mật khẩu hoặc thông báo gốc từ driver. Các lỗi lập trình khác vẫn trả 500. Mã DB_DNS_FAILED xác định lỗi tra cứu DNS từ driver; DB_CONNECTION_FAILED cần đối chiếu runtime logs và cấu hình mạng, không mặc định kết luận IP allowlist. Không đổi quyền, schema hoặc nghiệp vụ.


## Tra cứu khách hàng toàn bộ - 22/10/2026

GET /api/customers?search=&page=1&pageSize=20 trả {customers,total,page,pageSize}. Cần session và user active; spaId lấy từ actor(), bỏ qua spaId client. search tối đa 100 ký tự, tìm literal không phân biệt hoa/thường trên tên, điện thoại, ghi chú hoặc ID đầy đủ; không tự bỏ dấu tiếng Việt. page nguyên 1..1000000, pageSize nguyên 1..100; sai trả 400. id tùy chọn phải là ObjectId hợp lệ và luôn kết hợp spaId; khác spa trả danh sách rỗng. Sắp createdAt giảm dần, _id giảm dần, page vượt cuối được đưa về trang cuối. Phản hồi no-store; không mutation. Chỉ trả trường khách được phép: _id, name, phone, notes, createdAt, updatedAt.

Trang Khách hàng và bộ chọn khách trong form dùng endpoint này, không còn trần 500. GET /api/workspace vẫn tải preview khách và bổ sung khách cũ được tham chiếu bởi các bản ghi đang hiển thị để giữ tên/điện thoại. Các danh sách khác giữ giới hạn trước đây.


## Workspace phân trang toàn bộ - 22/10/2026

Mục này thay thế mọi mô tả limit/tableLimit 500 trước đây. GET /api/workspace nhận section (mặc định overview), search (literal, tối đa 100), page (1..1000000), pageSize (1..100), allocationPage (trang lịch sử phân bổ riêng), from/to (YYYY-MM-DD, ngày Việt Nam), actor (ObjectId cho lọc audit), action (lọc audit). from phải không sau to; đầu vào sai trả 400; section không được quyền truy cập trả 403. spaId/actorId quyền lấy từ session, không tin query client.

Response bổ sung pages[collection]={rows,total,page,pageSize}; collection là services, staff, appointments, invoices, deposits, allocations, treatments, uses, days, audit hoặc customers theo section. page vượt cuối được đưa về trang cuối. Arrays cấp ngoài là dữ liệu tham chiếu/lựa chọn form, không dùng làm toàn bộ lịch sử. invoices rows có trạng thái tính từ số tiền và canAllocate; treatments rows có thông tin hạn thanh toán. Không có tableLimit. Lịch sử phân bổ có pagination độc lập với cọc. Các field nhạy cảm User và TreatmentUse tiếp tục loại khỏi response.

report={inflow,outflow,days} tính toàn bộ giao dịch trong from/to theo spa, chỉ OWNER/thu ngân. days gồm {_id:day,incoming,outgoing}; giao diện biểu đồ chỉ vẽ 14 ngày có giao dịch cuối, số tổng vẫn tính toàn khoảng. totals thêm treatments, remaining, activeTreatments, uses và bookings cho STAFF tính từ toàn bộ lịch CONFIRMED của chính mình trong ngày Việt Nam.

Tìm kiếm hỗ trợ tên/điện thoại khách liên quan, tên nhân viên, tên dịch vụ/gói trong các danh sách tương ứng; ID đầy đủ hoặc chuỗi hex ngắn tối thiểu 6 ký tự, chuỗi nghiệp vụ và số tiền nguyên ở các field được phép. Audit tìm theo mã/tên thao tác, người thực hiện, khách tham chiếu và các trường note/reason/name/description được hỗ trợ; không tìm trên bí mật hoặc nét ký. Mọi response no-store.


## API bán gói/hóa đơn — 22/10/2026 (thay thế payload cũ tương ứng)
Mọi mutation giữ Origin, session active, tenant scope, Idempotency-Key và transaction/audit.
- packageTemplate OWNER: {name,serviceId,totalSessions:1..1000,price:integer>0}. updatePackageTemplate thêm id; packageTemplateStatus {id,active}. Sửa mẫu không sửa dữ liệu đã bán.
- service/updateService thêm commission:integer>=0, mặc định0; không tự tính thanh toán hoa hồng.
- customer/updateCustomer thêm consultantId tùy chọn cùng spa và active; update bỏ trường để gỡ mặc định. GET customers bổ sung consultantId.
- sellPackage OWNER/thu ngân: {customerId,templateId,total?:giá bán thay thế dương,dueDate,consultantId?,promotion?,gifts?:[{templateId}]}. Tối đa20 quà; quà bắt buộc tên đợt promotion không rỗng, không nhận trường giá. Server lấy tên/số buổi/dịch vụ từ mẫu và cưỡng chế giá quà0. Response id=gói chính, invoiceId=hóa đơn mua. Client cũ nhập name/serviceId/totalSessions phải chuyển sang templateId.
- invoice OWNER/thu ngân: {customerId,serviceId,description?,total?,consultantId?,dueDate?,treatmentId?,signature?,remainingBefore?}. Mua lẻ cho sửa giá/nội dung, giá dương; không gửi giá dùng giá danh mục. Có treatmentId: đúng khách/dịch vụ/gói ACTIVE/còn buổi, chữ ký/remainingBefore bắt buộc, giá server luôn0 kể cả client gửi giá khác; ghi buổi và hóa đơn cùng transaction. Dùng buổi không trả nợ hóa đơn mua gói.
- use/completeTreatmentAppointment: payload giữ nguyên, tạo thêm SESSION invoice0 cùng transaction; response bổ sung invoiceId nếu có hóa đơn buổi. Retry lịch đã có Use dùng lại invoice tương ứng, không tự backfill buổi cũ.
- GET /api/invoices/{id}: hóa đơn đúng phạm vi tài chính, khách, quà tặng kèm, lịch sử thao tác và chữ ký buổi nếu OWNER/actor/staff được phép xem. Không tự mở quyền chữ ký cho thu ngân. no-store,private.
- GET /api/customers/{id}/history?page=1: khách cùng spa và danh sách hóa đơn người xem được phép đọc, tổng/page, mỗi trang10. Gồm mua lẻ/gói/quà/buổi0đ. Không trả toàn bộ tài chính spa cho STAFF.
- GET workspace thêm package_catalog (OWNER), pages.packageTemplates và packageTemplates cho form chọn gói; vẫn phân trang backend. Ẩn menu audit/treatment_uses không xóa API hay audit đã lưu.

Bổ sung: history nhận kind=invoices|appointments|treatments (mặc định invoices), trả rows/kind/total/page. Lịch hẹn STAFF chỉ lịch mình, gói giữ quyền đọc hiện hành cùng spa. completeAppointment cho OWNER/thu ngân nhập description/total/consultantId khi tạo hóa đơn mới; liên kết hóa đơn cũ giữ số liệu cũ. STAFF phụ trách vẫn hoàn thành theo giá danh mục, không tự sửa giá bằng endpoint này.

Bổ sung chữ ký hóa đơn 22/10/2026: GET invoices/{id}?signaturePage=1 trả signatures/signatureTotal/signaturePage (5 buổi mỗi trang). Hóa đơn mua gói gom chữ ký của gói và các gói tặng liên kết; hóa đơn từng buổi đọc Use trực tiếp hoặc appointmentId cho liên kết cũ. Giữ tenant/customer scope và quyền OWNER/actor/staff từng buổi, không tự cấp quyền chữ ký cho thu ngân. Không backfill hay tạo chữ ký giả; ghi rõ buổi lịch sử thiếu chữ ký.


## Trang Thu ngân — 22/10/2026
GET workspace nhận section=cashier, backend chỉ OWNER hoặc cashier=true. Trả catalogs và các lựa chọn vận hành theo API workspace hiện có; không có pages cho trang soạn hóa đơn. Không thêm action ghi mới: dùng customer, invoice, sellPackage và payment như đã mô tả. Session/tenant/quyền/transaction/idempotency không đổi. Route /workspace/cashier; ?mode=package mở mặc định Bán gói. Dịch vụ/gói được chọn trên trình duyệt chưa tạo nháp DB; Lưu mới gửi operation. GET chi tiết hóa đơn giữ kiểm tra quyền; nút thu tiền mở lại form payment hiện có, server kiểm tra quyền khi ghi.


## Bộ lọc và hồ sơ — 22/10/2026
GET workspace nhận thêm status (đúng danh sách; sai trả400), employee/customer (ObjectId hoặc rỗng), method CASH|BANK_TRANSFER, direction IN|OUT, category literal<=100, order asc|desc. Mọi lọc AND với scope gốc trước phân trang. Lịch dùng startAt và order, mặc địnhdesc; cash/days lọc day, các lịch sử khác lọc createdAt hoặc performedAt; từ00h ngày đầu đến trước00h ngày sau theo UTC+7. Catalog/nhân viên không lọc ngày. category cho services; package_catalog tra serviceId theo nhóm dịch vụ. Không nhận spaId/actorId quyền từ client.
Status invoices: DEBT,OVERDUE,UNPAID,PARTIALLY_PAID,PAID,SESSION,GIFT; packages ACTIVE,PAUSED,COMPLETED,GIFT; deposits AVAILABLE,EXHAUSTED; services/package_catalog/staff ACTIVE,INACTIVE; appointments CONFIRMED,POSTPONED,COMPLETED,CANCELLED; days OPEN,CLOSED. pages.cash.summary={incoming,outgoing} tính toàn bộ kết quả trong quyền, không chỉ trang.
GET customers bổ sung lastVisit (lịch COMPLETED gần nhất không ở tương lai), nextVisit (CONFIRMED tới đây); cả hai theo quyền lịch của phiên, truy vấn theo lô khách trên trang. Giữ consultantId và các trường cũ. service/updateService thêm category tùy chọn, trim<=100, giữ quyền OWNER.
GET customers/{id}/history bổ sung summary={invoices,debt,credit,appointments,activePackages,lastVisit}, customer.notes/consultantName và serviceName/staffName của các dòng. credit=null khi không có quyền xem cọc; nợ/hóa đơn/lịch giữ scope hiện tại.
GET /api/staff/{id}: OWNER và cùng spa; trả staff{name,email,role,cashier,active,createdAt} + summary{appointments,completed,sessions,customers}. STAFF/thu ngân403 trước truy vấn hồ sơ; không session401. no-store,private. Không có hành động lương/chấm công/hoa hồng mới.


## API lương/hoa hồng — 22/10/2026
GET /api/payroll?month=YYYY-MM&view=salary|commission&employee=&page=1. month hợp lệ2000..9998, page1..1000000; phân trang10. OWNER xem/chọn toàn spa. STAFF/thu ngân bị ép staffId=user.id; yêu cầu employee khác trả403 trước đọc dữ liệu lương. Vai trò khác403. no-store,private. Response people (name,active,role,baseSalary hoặc null), rows,total,page,summary{commission,sessions,unsettled,unsettledCount}. Summary commission là toàn tháng; unsettled gồm khoản chưa chốt đến hết tháng. Commission rows bổ sung payrollMonth/payrollStatus. people STAFF chỉ chứa chính mình; không trả hash/password/session. GET workspace nhận salary/commission để điều hướng, không trả bảng lương qua payload workspace chung.
Các action POST operations giữ Origin, phiên active, cùng spa, Idempotency-Key, transaction/audit:
- setStaffSalary OWNER: {staffId,baseSalary>=0}; cấu hình không sửa bảng đã lập.
- savePayroll OWNER: {id?:bảng đang sửa,staffId,month,baseSalary?,bonus>=0,deductions>=0,note?}. Mới lấy lương cấu hình nếu bỏ baseSalary; không có cấu hình phải nhập rõ. Bảng đã có yêu cầu đúng id và DRAFT. Điều chỉnh dương cần note. Tính hoa hồng còn chưa chốt trước đầu tháng sau, cộng tồn tháng trước; không tính lại ledger từ giá danh mục. Không lập tháng tương lai.
- approvePayroll OWNER: {id,expectedTotal}. Kiểm tra tập Commission và tổng so với nháp/expectedTotal; lệch409, chưa khóa/ghi chi. Thành công gắn payrollId và chuyển APPROVED. Retry giữ bảng cũ.
- payPayroll OWNER: {id,method:CASH|BANK_TRANSFER,receivedConfirmation:true,note?,transferReference?}. Số tiền server lấy từ bảng duyệt; không nhận amount/staffId để quyết định chi. BANK_TRANSFER cần note/reference>=3 ký tự. Khoản dương cần sổ hôm nay OPEN; ghi PAYROLL OUT + PAID atomically. Bảng PAID retry không ghi chi thêm. Khoản0 không tạo phiếu0. reverseCash từ chối PAYROLL.
- completeInvoiceService OWNER/thu ngân: {id,staffId}. Chỉ invoice dịch vụ lẻ, không Appointment/Treatment; nhân viên active cùng spa. Đánh dấu thực hiện và ghi Commission một lần, bất kể paid. Đã thực hiện khác người409. Invoice có lịch hoàn thành tại lịch; invoice đã thực hiện không gắn lịch mới.
- use thêm staffId tùy chọn; invoice có treatmentId thêm staffId tùy chọn cho buổi. Chỉ OWNER/thu ngân chỉ định người khác, STAFF chỉ mình. Signature snapshot và Commission gắn cùng staffId. completeTreatmentAppointment giữ nhân viên lịch.
Hoàn thành lịch lẻ, Use/lịch gói mới tự ghi Commission trong transaction. Hóa đơn0/gói tặng không chặn mức hoa hồng. Chưa có backfill, xóa/đảo hoa hồng hoặc mở lại bảng lương duyệt/chi.


## Cài hoa hồng theo dịch vụ — 22/10/2026
POST operations action=setServiceCommission {serviceId,commission}: OWNER, phiên active, same-spa Service, tiền nguyên VNĐ 0..1e12; giữ transaction, idempotency, audit before/after. Chỉ sửa commission, giữ tên/giá/thời lượng. GET /api/payroll view=commission trả thêm services {_id,name,active,commission} cùng spa cho OWNER; STAFF nhận danh sách rỗng.

## Danh mục sản phẩm - 22/10/2026
POST /api/operations action=product hoặc updateProduct: OWNER. Payload gồm name, sku, sizeMl (số nguyên 1..100000), price, groupId?, minStock?, description?, imageUrl?. API không nhận unit hoặc stock từ client; sản phẩm mới có đơn vị tồn mặc định `Sản phẩm`, stock vẫn chỉ đổi qua stockMovement. Danh sách sản phẩm trả sizeMl; sản phẩm cũ chưa được backfill.

## Cổng thông tin công khai và API Khách hàng - 22/10/2026
### POST /api/auth/register
- Quyền truy cập: Public. Kiểm tra `Origin`.
- Payload JSON: `name: String` (>=2 ký tự), `phone: String` (8..20 ký tự), `email: String` (email hợp lệ), `password: String` (>=6 ký tự).
- Logic: Tạo hoặc liên kết `Customer` cùng spa, tạo `User` với vai trò `CUSTOMER`, cấp phiên `Session` 8 giờ và gán cookie `spacare_session`.
- Trả về: `{ ok: true, role: 'CUSTOMER', name: String }`.

### POST /api/booking
- Quyền truy cập: Public hoặc Khách hàng đã đăng nhập.
- Payload JSON: `serviceId: ObjectId`, `startAt: ISO Date String` (tương lai), `name: String`, `phone: String`, `notes?: String`.
- Logic: Tìm dịch vụ `active=true`, kiểm tra xung đột lịch và tự động gán chuyên viên sẵn sàng `active=true` trong khung giờ. Tạo `Appointment` với trạng thái `CONFIRMED`.
- Trả về: `{ ok: true, appointmentId: ObjectId, serviceName: String, startAt: ISO String, duration: Number }`.

### Phân quyền các API quản trị đối với vai trò CUSTOMER
- Các endpoint quản trị nội bộ: `/api/workspace`, `/api/operations`, `/api/customers`, `/api/customers/[id]/history`, `/api/invoices/[id]`, `/api/payroll`, `/api/products`, `/api/staff/[id]`, `/api/treatment-uses/[id]`.
- Khi người dùng có vai trò `CUSTOMER` gọi vào các endpoint này: Server trả về HTTP 403 Forbidden ngay lập tức.

## Giờ hẹn
`appointment`, `rescheduleAppointment` và `POST /api/booking` kiểm tra giờ Việt Nam: thời điểm bắt đầu không trước 09:00, thời điểm kết thúc không sau 22:00 và cùng một ngày. Trang đặt lịch công khai hiển thị mốc bắt đầu mỗi 30 phút, lọc để dịch vụ kết thúc trước giờ đóng cửa.

## Chống đặt trùng trên web - 23/10/2026
POST /api/booking yêu cầu Origin khớp APP_ORIGIN và header Idempotency-Key dạng UUID. startAt phải là ISO có UTC offset; phone được chuẩn hóa +84 thành 0 và kiểm tra 10–11 chữ số. Không nhận spaId/staffId từ khách. Nếu tất cả nhân viên bận trong khoảng [startAt,endAt), trả HTTP 409 với error: “Khung giờ này đã có lịch, vui lòng chọn giờ khác”. Còn nhân viên rảnh vẫn nhận lịch. Gửi lại cùng key/nội dung trả kết quả đã lưu; key khác nội dung trả 409. Lịch, hồ sơ khách mới, audit và idempotency commit cùng transaction; xung đột không để lại bản ghi một phần.

## Đơn giản phiếu kho - 23/10/2026
stockMovement: {productId,direction,quantity,reason?}. reason không bắt buộc, mặc định chuỗi rỗng, tối đa 2000 ký tự. Backend giữ kiểm tra productId cùng spa và quyền OWNER, transaction/idempotency/audit.

## Ảnh và danh mục sản phẩm công khai - 23/10/2026
POST /api/product-images: OWNER, Origin hợp lệ, multipart image, <=5 MB, định dạng JPG/PNG/WebP kiểm tra bytes; 201 {imageUrl}. Request multipart bị giới hạn 5 MB +64 KB cả khi thiếu Content-Length. GET /api/product-images/[id]: công khai chỉ phục vụ file PRODUCT_IMAGE với MIME đã kiểm tra, nosniff, immutable cache. product/updateProduct chấp nhận imageUrl nội bộ hợp lệ và kiểm tra metadata.spaId từ phiên; URL cũ vẫn dùng được. GET /products: trang công khai danh mục active của spa MVP, tìm tên literal, 12 sản phẩm/trang; không dùng API sản phẩm nội bộ cho khách.


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

API bổ sung / mở rộng (spaId/actorId lấy từ phiên, luôn kiểm tra user active backend):
- POST /api/operations action recordStaffLeave {id?,staffId,startDay,endDay,period,type,paid?,note?}; day cũ vẫn nhận cho tương thích. OWNER hoặc STAFF chính mình, không cho STAFF chọn paid=true.
- reviewStaffLeave {id,status:APPROVED|REJECTED,paid?}: OWNER; recordWorkday {staffId,day,period,note?}, setSalaryPolicy {staffId,standardDays,paidLeaveDays,mode}: OWNER.
- sellPackage thêm sellerId tùy chọn (mặc định actor, không mặc định consultant), check nhân sự active cùng spa. payment/allocate/reversePayment qua reverseCash/reverseAllocation tự đồng bộ SaleCommission.
- refundPackage {invoiceId,amount,method,reason,receivedConfirmation:true,exceptionApproved:true,transferReference?}: OWNER, khoản còn được hoàn = paid-refunded; sổ hôm nay OPEN, kiểm tra bằng chứng chuyển khoản; REFUND OUT riêng.
- savePayroll thêm attendanceConfirmed:boolean, advance:number. readPayroll thêm salaryPolicy vào people, workdays/workSummary/workTotal/workPage, leaves và leaveSummary đếm theo đơn vị ngày (0.5), summary.serviceCommission/saleCommission; view=commission hợp nhất hai ledger trước phân trang và tổng hợp. Chặn STAFF xem nhân viên khác.
- Validation Zod trả {error,fields:{tenTruong:thongBaoTiengViet}} để hiển thị lỗi dưới trường; tiền gửi backend vẫn number.


## Notifications — 23/10/2026
GET /api/notifications: OWNER active, scope phiên; trả 30 items mới nhất (title/body/url/readAt/createdAt), unread toàn bộ và publicKey công khai hoặc null; no-store. POST cùng route kiểm tra origin và OWNER; action subscribe {subscription:{endpoint,keys:{p256dh,auth}}}, unsubscribe {endpoint}, read {id}, readAll. Không nhận spaId/userId từ client. read chỉ sửa bản ghi thuộc chính người nhận; unsubscribe chỉ thiết bị của mình. Subscribe chỉ HTTPS dịch vụ push được cho phép; không follow redirect. GET /api/notifications/dispatch: chỉ Bearer CRON_SECRET, xử lý outbox; 401 khi thiếu/sai secret. POST /api/booking thêm Notification trong transaction, gửi push sau commit, không thay response đặt lịch. Cấu hình/giới hạn: PUSH_NOTIFICATIONS.md.


## Nhân viên đăng nhập số điện thoại — 23/10/2026
POST operations user {name,phone,password,cashier?}; updateUser {id,name,phone,cashier}. OWNER/active/cùng spa như trước, backend chuẩn hóa phone và trả 409 khi trùng. Không bắt email, không thay mật khẩu khi sửa thông tin, giữ email cũ. POST /api/auth/login nhận {identifier,password}, identifier là phone hoặc email; giữ tương thích payload {email,password} và {phone,password}. Kiểm tra active/mật khẩu, throttle theo định danh đã chuẩn hóa, không nhận spaId/role từ client. Workspace STAFF list và staff detail của OWNER thêm phone; tìm nhân viên theo phone. Migration indexes: npm run db:staff-phone; chỉ cập nhật indexes, không seed.


## Bỏ ô tham chiếu ảnh chuyển khoản — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: bỏ trường nhập tham chiếu ảnh chuyển khoản trong form thu tiền hóa đơn; không bắt ghi chú thay thế. Quy tắc này thay yêu cầu ghi tham chiếu/ghi chú ảnh khi thu chuyển khoản trước đây. Vẫn bắt xác nhận đã kiểm tra tài khoản và thực nhận tiền, giữ quyền, trạng thái ngày, transaction, idempotency và audit. PROPOSED kỹ thuật: paymentEvidence dùng chung chỉ kiểm tra receivedConfirmation; transferReference vẫn là trường tùy chọn trong API/schema và giữ toàn bộ dữ liệu lịch sử. Không thay quy trình xác nhận buổi liệu trình/chữ ký; tham chiếu chi lương riêng không thuộc thay đổi này.


## Trạng thái sổ hôm nay và mở sổ lặp — 23/10/2026
PROPOSED kỹ thuật theo yêu cầu sửa lỗi danh sách trống nhưng mở sổ báo đã tồn tại: GET workspace thêm todayDay cho OWNER/thu ngân, query trực tiếp cùng spa/ngày Việt Nam và độc lập bộ lọc/phân trang. Trang days không áp dụng từ khóa search vì không có ô tìm kiếm; vẫn giữ lọc trạng thái/khoảng ngày. UI hiển thị rõ hôm nay chưa mở/đang mở/đã chốt; đã mở không hiện nút tạo thêm, đã chốt chỉ OWNER có Mở lại với lý do. openDay trên sổ OPEN trả sổ hiện có, không đổi tiền đầu ngày, không tạo sổ thứ hai; sổ CLOSED trả 409 và không tự mở lại. Giữ transaction, idempotency và audit snapshot thực tế. Không thay chính sách ai được mở/chốt/mở lại hoặc ghi đè dữ liệu lịch sử.


## Xuất PDF hóa đơn và hoa hồng - 23/10/2026
CONFIRMED: PDF để tải, in hoặc chia sẻ hóa đơn khách hàng và bảng kê hoa hồng theo nhân viên/tháng trên máy tính và điện thoại.
PROPOSED kỹ thuật: API chỉ đọc từ phiên active và cùng spa. OWNER xem phạm vi spa; STAFF giữ quyền đọc hóa đơn hiện có, chỉ xuất hoa hồng của mình. Không ghi tài chính hoặc xác nhận thu tiền/chi lương. Bảng kê lấy toàn bộ tháng theo giờ Việt Nam, tách dịch vụ/bán gói, giữ điều chỉnh âm.
GET /api/invoices/[id]/export; GET /api/payroll/export?month=YYYY-MM&employee=<id hoặc rỗng>: trả ExportDocument JSON, private/no-store. Browser tạo file PDF. 401 thiếu phiên, 403 vượt quyền, 404 không có bản ghi đúng phạm vi, 400 bộ lọc sai. Không nhận spaId/actorId từ client.
## Sửa kiểm tra hoa hồng 0đ - 23/10/2026
PROPOSED kỹ thuật, giữ cấu hình dịch vụ hiện có: hoàn thành lịch chấp nhận hoa hồng nguyên VNĐ bằng 0; vẫn từ chối số âm/sai kiểu/vượt giới hạn. Giữ transaction, idempotency, audit và unique nguồn phát sinh; không đổi schema hoặc quyền API. Integration kiểm tra hoàn thành lặp chỉ có một hoa hồng 0đ, không sửa dữ liệu lịch sử.



## Liệu trình theo số buổi hoặc thời gian — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: danh mục có hai loại lựa chọn: SESSIONS nhập số buổi, TIME nhập thời hạn và không giới hạn số lần làm (ví dụ triệt 24/36 tháng). Thay thế phần chỉ hỗ trợ số buổi trước đây và chốt BR-OPEN-007 trong phạm vi này. Cả hai loại vẫn ký, ghi lịch sử từng lần, hóa đơn buổi 0đ và hoa hồng thực hiện theo quy tắc hiện có; tài chính mua gói vẫn riêng.
PROPOSED kỹ thuật: PackageTemplate/Treatment bổ sung packageType, durationMonths (1–120); TIME không lưu totalSessions/remaining, Treatment snapshot startsOn/expiresOn YYYY-MM-DD và usedSessions. Mặc định dữ liệu cũ thiếu packageType là SESSIONS, không backfill hay thay quyền lợi gói đã bán. Mốc từ ngày mua hay lần đầu vẫn OPEN: khi bán TIME (kể cả quà) phải chọn startsOn theo thỏa thuận, không tự mặc định. Hạn tính cộng tháng lịch, chặn ngày không tồn tại, kẹp cuối tháng; bao gồm ngày đầu/cuối theo giờ Việt Nam.
API packageTemplate/updatePackageTemplate nhận packageType + totalSessions hoặc durationMonths, không cả hai; sellPackage thêm startsOn bắt buộc nếu gói chính/quà thuộc TIME. Tạo/gửi lại vẫn transaction + idempotency + audit và cùng spa. use/invoice/completeTreatmentAppointment giữ remainingBefore: số buổi còn với SESSIONS, bộ đếm usedSessions với TIME để bắt xung đột chữ ký (0 ở lần đầu). Ghi TIME tăng usedSessions, không giảm quota hoặc tự COMPLETED. Backend chặn chưa bắt đầu/hết hạn/bảo lưu khi ghi lần làm và kiểm tra ngày dự định khi tạo/dời lịch. Bảo lưu không tự cộng hạn; OWNER gia hạn riêng như hiện có.
Giao diện danh mục chọn loại rồi hiện đúng ô; bán gói chọn ngày bắt đầu và xem hạn. Danh sách/thu ngân/lịch sử/khách hàng hiển thị hạn và không giới hạn thay số buổi. Không đổi indexes, không chạy migration dữ liệu vận hành.


## Hoa hồng chủ spa và thông tin khách — 23/10/2026
CONFIRMED: chủ spa trực tiếp bán gói cũng được ghi nhận và hiển thị hoa hồng bán gói 5% như nhân viên theo tiền thực thu đủ điều kiện. Giữ quy tắc cũ về thời điểm hưởng, hoàn/đảo và chống trùng; không tự backfill người bán hoặc hoa hồng lịch sử. Trang Hoa hồng thêm bộ lọc nhanh Của tôi cho OWNER; danh sách người hưởng gồm OWNER/STAFF.
GET /api/payroll view=commission và PDF hoa hồng bổ sung customerName/customerPhone từ Customer cùng spa, chỉ truy vấn customerId có trong các khoản hoa hồng đã lọc theo quyền, tháng và trang (PDF toàn bộ phạm vi xuất). STAFF chỉ xem khoản của mình, không nhận danh sách khách toàn spa hay ghi chú khách. Dữ liệu thiếu khách hiển thị Chưa ghi nhận. Không thay schema/index, số tiền hoặc trạng thái bảng lương.


## Chủ spa không tham gia lương/chấm công — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: Lương, chính sách lương, ngày công và nghỉ phép chỉ áp dụng cho STAFF; loại OWNER khỏi lựa chọn, danh sách, tổng hợp và phân trang. Chủ spa vẫn quản lý/duyệt/ghi chi lương nhân viên. Hoa hồng giữ OWNER/STAFF, chủ spa bán gói vẫn hưởng và xem hoa hồng theo quy tắc thực thu hiện hành. Nội dung này thay phần trước cho phép OWNER là người nhận lương/chấm công.
PROPOSED kỹ thuật: GET /api/payroll view=salary giao scope được phép với IDs STAFF cùng spa trước mọi count/aggregate/page; view=commission giữ phạm vi cũ. Backend từ chối cấu hình/lập/duyệt/chi bảng lương, ghi công/nghỉ và duyệt nghỉ của OWNER; không chỉ ẩn trên UI. Không xóa hay sửa bảng lương/chấm công/hoa hồng lịch sử; bản OWNER cũ được giữ trong database nhưng không đưa vào danh sách/tổng lương hiện hành. Không thay schema/index hoặc tự chuyển khoản hoa hồng chủ spa thành chi lương.


## Chia hoa hồng bán gói cho nhiều người tư vấn — 23/10/2026
CONFIRMED: bán liệu trình có nút + Người cùng tư vấn; tổng quỹ hoa hồng vẫn 5% tiền thực thu đủ điều kiện, chia đều cho những người được chọn, không phải mỗi người 5%. OWNER vẫn được tham gia và hiện hoa hồng nhưng không thuộc lương/chấm công. Chỉ chia hoa hồng bán gói, không thay hoa hồng thực hiện dịch vụ.
PROPOSED kỹ thuật: sellPackage nhận participantIds? (1–20 IDs không trùng, gồm OWNER/STAFF active cùng spa); nếu thiếu giữ tương thích sellerId hoặc user phiên. sellerId truyền kèm phải khớp phần tử đầu. Snapshot Invoice.saleParticipants=[{staffId,staffName}], giữ sellerId/sellerName đầu danh sách cho tương thích; không có action sửa nhóm sau bán, không backfill nhóm hóa đơn cũ.
Gói một người giữ saleCommissionVersion=1/SaleCommission. Nhiều người dùng version=2 và SharedSaleCommission bổ sung: spaId,staffId,staffName,invoiceId,serviceId,serviceName,customerId,category=PACKAGE_SALE,sharedSale=true,sourceType/sourceId,shareCount,amount,earnedAt,payrollId. Unique (spaId,sourceType,sourceId,staffId), index (spaId,staffId,earnedAt desc). Không đổi/xóa unique index ledger cũ. Khởi tạo bổ sung bằng npm run db:commission-shares (hoặc db:setup với cấu hình seed cũ); không chạy vào DB vận hành trong phiên sửa code.
Quỹ cộng dồn = floor((paid-refunded)/20). Phân số nguyên đồng: chia thương và dư theo staffId chuẩn hóa tăng dần (không phụ thuộc thứ tự chọn); mỗi người ghi chênh lệch quyền hưởng cộng dồn trước/sau sự kiện. Vì vậy thu nhiều đợt/đảo/hoàn có tổng và phần từng người đúng như thu một lần, lệch tối đa 1đ ở quyền hưởng cộng dồn. Không đổi người hưởng khi họ đổi tên/ngừng hoạt động sau bán.
Payment/Allocation/refund/reversal giữ transaction tuần tự, Control guard, idempotency, audit; ledger share ghi cùng transaction và snapshot invoice tổng accrued. Không tăng 5% theo số người, quà 0đ/công nợ chưa thu không phát sinh. Khoản điều chỉnh âm vào phần chưa chốt, không sửa bảng đã duyệt/chi.
Đọc hoa hồng/PDF/báo cáo union cả hai ledger với cùng scope người dùng/spa/tháng; STAFF chỉ xem phần của mình. Payroll thêm sharedSaleCommissionIds; tổng bán gói gồm cũ và chia, duyệt khóa IDs cả hai ledger, không đưa khoản của OWNER vào lương STAFF. Giao diện hiển thị số người chia và phần tiền của từng người, giữ thông tin khách. Preview lúc bán chỉ là dự kiến khi thu đủ.


## Sửa rollback nhóm tư vấn — 23/10/2026
PROPOSED kỹ thuật: saleParticipants dùng child Schema tường minh với _id=false, versionKey=false, strict=throw như schema cha. Tránh Mongoose track __v mặc định trên subdocument khi khôi phục transaction, làm StrictModeError che lỗi gốc. Giữ nguyên test lỗi giả lập Treatment.create và kiểm tra rollback Invoice/Audit/Idempotency; không nới strict hay thay dữ liệu nghiệp vụ. Không đổi field/index hoặc cần migration dữ liệu.


## Một bảng tổng hợp lương và công/nghỉ — 23/10/2026
Theo yêu cầu mới nhất: trang Lương chỉ có một bảng chung theo nhân viên/tháng, đủ lương cơ bản, công/nghỉ, lương tính, hai loại hoa hồng, thưởng/phụ cấp, phạt/khấu trừ, tạm ứng, tổng thực nhận, trạng thái và thao tác. Bỏ các khối cài lương/công/nghỉ độc lập trên trang chính; Công/nghỉ mở hộp quản lý riêng cho người được chọn, Cài đặt và Tính lương nằm trên dòng. Phạt vẫn là khoản deductions nhập tay có lý do, không tự đặt mức phạt.
PROPOSED kỹ thuật: GET payroll view=salary phân trang theo STAFF trong phạm vi, trả một dòng mỗi nhân viên (kể cả chưa có Payroll); chưa lập dùng status=NOT_CREATED, _id uncreated-ID chỉ phục vụ hiển thị, không ghi Payroll giả. Tổng thực nhận/lương theo công/thưởng/phạt chưa tính hiển thị Chưa tính hoặc dấu gạch, không giả thành 0. Preview hoa hồng lấy toàn bộ khoản chưa chốt đến hết tháng giống savePayroll, gồm tồn kỳ trước. Các tổng salarySummary vẫn chỉ cộng bảng lương đã lưu. Mọi tham chiếu cùng spa/quyền như trước.
Rows thêm currentWorkdays/currentLeaveStats cho công/nghỉ thực tế, tách khỏi snapshot đã tính lương; không thay đổi snapshot APPROVED/PAID khi nguồn công/nghỉ/hoa hồng thay đổi. Bấm Tính lương vẫn dùng transaction/idempotency/audit savePayroll và kiểm tra dữ liệu công theo chính sách. Không tự duyệt/ghi chi. Không đổi schema/index.


## Sửa hóa đơn chưa giao dịch - 23/10/2026
CONFIRMED: chỉ OWNER sửa hóa đơn SERVICE/PACKAGE chưa thu tiền, chưa áp cọc, chưa dùng gói hoặc phát sinh hoa hồng. updateInvoice kiểm tra quyền active từ DB, cùng spa, mọi lịch sử thanh toán/phân bổ kể cả đã đảo; kiểm tra cả gói quà, lịch hẹn liên kết và ngày lập chưa chốt. Không hỗ trợ sửa PRODUCT/SESSION/GIFT hay hóa đơn đã thực hiện.
API POST operations action updateInvoice: id, expectedUpdatedAt (ISO), description, total (>0), dueDate?, reason bắt buộc; PACKAGE thêm packageName, packageType và totalSessions hoặc durationMonths+startsOn. Giao diện sửa thông số theo loại gói hiện tại. Giữ khách/dịch vụ/người hưởng và quà tặng; thay tên/quyền lợi gói chính cập nhật Treatment cùng transaction, bỏ templateId vì quyền lợi đã tùy chỉnh. Không thay danh mục. Không thay schema/index. Control guard, idempotency, audit trước/sau hóa đơn và liệu trình; dữ liệu cũ trả 409. Không ghi thu chi.


## Khởi tạo chủ spa bằng số điện thoại — 23/10/2026
CONFIRMED theo yêu cầu người dùng: tài khoản chủ spa mới đăng nhập bằng số điện thoại và mật khẩu; cấu hình bằng SEED_OWNER_PHONE và SEED_OWNER_PASSWORD trong .env.local rồi chạy npm run db:setup.
PROPOSED kỹ thuật: dùng chuẩn hóa/validation số điện thoại hiện có, mật khẩu 12–128 ký tự và scrypt có salt. SEED_OWNER_EMAIL tùy chọn, giữ tương thích seed email cũ. Setup không cập nhật tài khoản có sẵn, không reset mật khẩu, không gắn thêm danh tính. Danh tính phải cùng khớp một OWNER active; trùng nhiều tài khoản/sai vai trò/ngừng hoạt động thì dừng. Không khớp danh tính nhưng database đã có User cũng dừng, tránh tạo thêm spa ngoài ý muốn. Tạo Spa/Control/User mới trong transaction tuần tự; chạy lại giữ nguyên tài khoản. Không thay schema/index, quyền API, session hoặc dữ liệu production. POST /api/auth/login đã nhận số điện thoại/email, không thay payload.


## Nhập danh mục thật và lịch chỉ ghi giờ đến — 24/10/2026
CONFIRMED: người dùng yêu cầu nhập danh mục Excel và chọn “Chỉ ghi giờ đến”. Không bắt thời lượng dịch vụ; lịch mới/dời lịch chỉ có startAt trong 09:00–22:00 giờ Việt Nam, không suy giờ kết thúc hay chặn nhân viên theo khoảng thời gian. Spa tự cân đối ca; cho phép nhiều lượt đến cùng giờ. Thay yêu cầu trước về chống chồng lịch/kín lịch bằng thời lượng. Giữ idempotency, quyền cùng spa, transaction, audit và lịch hoãn tạo bản mới. duration/endAt cũ giữ để tra lịch sử; dời lịch CONFIRMED bỏ endAt sau khi audit before, lịch POSTPONED cũ không đổi.
CONFIRMED: dịch vụ có hoa hồng cố định mỗi lần; triệt lông trong bảng có cả giá lẻ và gói TIME 36 tháng không giới hạn lượt, bắt đầu ngày mua (kể cả gói tặng cùng loại). Backend sellPackage dùng ngày Việt Nam tại giao dịch khi service.category=TRIỆT LÔNG và template TIME/36; không lấy startsOn do client gửi cho nhóm này. Gói khác giữ ngày thỏa thuận. Không backfill gói cũ.
PROPOSED kỹ thuật: đặt online tạm giao OWNER active đầu tiên, fallback nhân viên đầu tiên theo _id để spa sắp xếp lại; không coi đó là nhân viên đang rảnh. Timeline ô một mốc cho lịch mới, không biểu thị thời lượng; phản hồi đặt online không trả duration. Service create/update không bắt duration; trường legacy nếu gửi vẫn kiểm tra 5–480. Không đổi schema/index.
PROPOSED kỹ thuật: npm run db:import-catalog đọc XLSX trên Windows, tối đa 10 MB/1000 dòng, sheet đầu, không công thức; mặc định chỉ xem trước, không kết nối DB. --write yêu cầu --database khớp URI, chủ active xác thực lại bằng mật khẩu từ env (công cụ vận hành cục bộ, không phải endpoint công khai; không nhận spaId từ file). Không tạo session web mới; scope lấy từ User trong transaction. Một transaction cho toàn file, Control guard tuần tự, audit từng dòng và Idempotency catalog-v1 theo tên/nhóm chuẩn hóa. Chạy lại cùng nội dung bỏ qua; khác nội dung/trùng danh mục đang có thì dừng, không ghi đè. Không tạo hóa đơn/thu chi/công nợ hay khoản hoa hồng phát sinh.
Giá theo khoảng: thêm cột Giá mặc định (VNĐ), hoặc người chạy chủ động chọn --use-min-price. Đây là giá mặc định kỹ thuật, không chốt giá khách; khoảng gốc/ghi chú lưu trong Audit.details.source, chưa có field khoảng giá trong Service/UI. Triệt lông tạo Service giá lẻ từ cột Giá lẻ (VNĐ) hoặc ghi chú “Giá lẻ: ... đ/lần”, và PackageTemplate TIME/36 giá gói từ cột Giá từ/Giá đến. Hoa hồng 0 được giữ. Không nhập thời lượng giả. CLI không xóa/reset dữ liệu. Hướng dẫn: IMPORT_CATALOG.md.


## Chặn liên kết khách chưa xác minh — 24/10/2026
CONFIRMED: yêu cầu sửa lỗ hổng không cho nhận hồ sơ khách khác bằng tên/số điện thoại tự khai. PROPOSED kỹ thuật đang áp dụng: tạm đóng tự đăng ký (POST /api/auth/register trả 403 trước khi đọc body/kết nối DB/tạo session); /register hiển thị thông báo thay form. /customer chỉ hiển thị thông báo cho CUSTOMER, không truy vấn hoặc trả lịch sử kể cả có customerId cũ; OWNER/STAFF chuyển /workspace, chưa đăng nhập chuyển /login. Đây là biện pháp containment thay thế tạm thời dashboard CUSTOMER trong BR-CUSTOMER-001, không phải triển khai OTP. Không tự liên kết bằng tên/điện thoại, không tin các liên kết cũ là đã xác minh. Không xóa/sửa User, Customer, Session hoặc dữ liệu tài chính hiện tại; không đổi schema/index. Chủ spa vẫn nhập khách qua workspace. Muốn mở lại phải triển khai và kiểm thử quy trình xác minh/liên kết được duyệt, rà soát tài khoản cũ và các đường truy cập. Không rollback về bản có lỗ hổng; nếu rollback ứng dụng khác phải giữ bản vá này. Bản vá chỉ có hiệu lực trên web production sau khi được deploy.

Bản vá cũng từ chối đặt lịch bằng phiên CUSTOMER (403 trước khi mở transaction), tránh tiếp tục dùng customerId cũ chưa xác minh. Đặt lịch khách vãng lai và quản lý nội bộ giữ luồng hiện tại; không coi số điện thoại khách vãng lai là bằng chứng sở hữu hồ sơ.


## BR-CARD-001 — Thẻ tiền mặt khách hàng — 24/10/2026
CONFIRMED theo yêu cầu người dùng: khách mua riêng thẻ (ví dụ 800.000đ), phải thực trả đủ mới phát hành/dùng; dùng cho dịch vụ lẻ (ví dụ 400.000đ còn 400.000đ), không dùng mua gói hoặc sản phẩm. Thiếu số dư được thu thêm tiền mặt/chuyển khoản. Cả thẻ mua và thẻ tặng không hết hạn, không hoàn hoặc đổi tiền mặt. Khi bán gói có thể tặng thẻ với mệnh giá nhập riêng (ví dụ gói 3.000.000đ tặng thẻ 800.000đ); thẻ tặng không làm tăng tiền thực thu. Không đồng nhất thẻ với tiền cọc.
PROPOSED kỹ thuật: OWNER/STAFF có cashier được bán thẻ và phát hành quà cùng sellPackage; nhập đợt khuyến mãi khi tặng. Quà phát hành ngay trong transaction bán gói; chưa chốt quy chế riêng cho gói chưa thu đủ hoặc ngừng/hoàn gói có quà thẻ, nên không tự suy cách thu hồi/đổi giá trị. Bản đầu chặn refundPackage và updateInvoice khi đã phát hành thẻ tặng, để tránh mất đối chiếu; cần spa quyết định workflow xử lý ngoại lệ trước khi hỗ trợ. Bán thẻ chưa sinh hoa hồng bán gói 5%; hoa hồng dịch vụ giữ quy tắc thực hiện hiện hành. Không tự chốt doanh thu kế toán BR-OPEN-006.
PROPOSED kỹ thuật: dùng thẻ theo quyền thu tiền hóa đơn hiện có (OWNER/thu ngân hoặc STAFF phụ trách lịch); cùng spa và cùng khách, chỉ SERVICE hoặc hóa đơn legacy có serviceId và không có liên kết liệu trình. Nhân viên chọn thẻ, số tiền trừ và phần thu thêm, xác nhận trước lưu; không tự trừ chỉ vì mở hóa đơn. Mỗi lần dùng yêu cầu sổ hôm nay đang mở, transaction snapshot/majority với Control guard + Idempotency + Audit. Không âm số dư, không trả vượt công nợ, không dùng thẻ người khác, không ghi CashEntry cho phần trừ thẻ. Quy trình chuyển thẻ, nạp thêm, đảo sử dụng và sửa sai tiền mua thẻ còn OPEN; không triển khai hoàn bằng reverseCash.

POST /api/operations (phiên active, origin, Idempotency-Key) thêm sellCashCard {customerId,amount,method CASH|BANK_TRANSFER,receivedConfirmation:true,note?}; mệnh giá bằng tiền thực nhận, không hỗ trợ trả thiếu. redeemCashCard {cardId,invoiceId,amount,additionalAmount?:0,method?,receivedConfirmation?}; khi additionalAmount>0 bắt method và xác nhận true. Giảm balance và tăng invoice.paid/cardPaid, ghi CashCardUse và Payment/CashEntry phần thu thêm cùng transaction. SellPackage thêm giftCashCardAmount?:0; dương phải có promotion. Không có API xóa/hoàn/chuyển/nạp thẻ. GET /api/cash-cards?customerId=&invoiceId?=&page=1&usePage=1: phân trang độc lập 10 thẻ/lịch sử; OWNER/thu ngân xem cùng spa, STAFF thường bắt invoiceId trong phạm vi và cùng khách, chỉ thấy lịch sử dùng của hóa đơn đó. CUSTOMER/MANAGER 403. No-store/private. GET invoice thêm giftCards và invoice.cardPaid; PDF giải thích dùng thẻ không phải thu mới.


## Trang thẻ tiền mặt tham khảo EasySalon — 24/10/2026
CONFIRMED: người dùng yêu cầu tham khảo https://my.easysalon.vn/cashcard để tổ chức giao diện thẻ. Đã quan sát trang danh sách rỗng, tìm theo tên/SĐT, cột mã/trạng thái/khách/số dư/hạn/thời gian và hộp Tạo mới. Chỉ mở/xem rồi hủy form, không tạo thẻ hay sửa dữ liệu ở hệ thống tham khảo. Yêu cầu mới thay thiết kế trước chỉ đặt thẻ trong hồ sơ khách bằng mục riêng Tài chính → Thẻ tiền mặt (/workspace/cash_cards). Giữ cả lối vào hồ sơ khách và thanh toán từ hóa đơn dịch vụ lẻ.
PROPOSED kỹ thuật: OWNER/thu ngân được mở danh sách toàn spa và tạo thẻ trả đủ qua action sellCashCard hiện có. STAFF thường không xem danh sách toàn spa, giữ quyền dùng thẻ theo hóa đơn được giao. Bảng gồm mã tự sinh từ ID (TM-ID), trạng thái theo số dư, tên/SĐT khách, mệnh giá, số tiền hiện tại, nguồn mua/tặng, Không thời hạn và ngày tạo theo giờ Việt Nam; tìm theo mã hoặc tên/SĐT, lọc nguồn/số dư, phân trang 10 dòng ở backend, chi tiết thẻ chỉ hiện lịch sử đúng cardId. Bộ lọc/trang lưu trên URL cardSearch/cardStatus/cardOrigin/cardPage. Mobile cuộn trong bảng, không tràn toàn trang.
Không suy chính sách mới từ EasySalon: không tự thêm hết hạn, bảo lưu, đồng sở hữu, nạp thêm, hoàn/đổi tiền; không tạo thẻ 0đ ngoài luồng quà bán gói. API GET /api/cash-cards thêm view=list&search=&status=AVAILABLE|EXHAUSTED&origin=PURCHASE|GIFT&page=1; bắt OWNER/STAFF cashier ở backend, spaId lấy từ phiên, lookup khách cùng spa chỉ trong trang kết quả, regex tìm kiếm được escape. GET hiện tại thêm cardId? để giới hạn thẻ và ledger cùng khách/spa; không thay quyền STAFF. Không thay schema/index/transaction hay dữ liệu đang dùng. Rollback UI/API list không xóa thẻ hoặc số dư và phải giữ các guard tài chính hiện có.


## Nhóm dịch vụ và chọn dịch vụ cho gói — 24/10/2026
CONFIRMED theo yêu cầu người dùng: form thêm/sửa dịch vụ chọn nhóm có sẵn, có tạo nhóm riêng; form tạo gói mẫu phải chọn dịch vụ đã khai báo. Form hóa đơn/bán gói có lọc nhóm, gói hiển thị tên dịch vụ đi kèm. PROPOSED kỹ thuật: ServiceGroup {spaId,name,nameKey,actorId,timestamps}, unique (spaId,nameKey); nameKey chuẩn hóa NFC/khoảng trắng/chữ thường, giữ dấu tiếng Việt. OWNER tạo nhóm qua operations action serviceGroup {name}, xác thực lại active/role DB, scope từ phiên, Control guard/transaction/idempotency/audit; kiểm tra trùng cả registry và category legacy. Không tự thêm quyền cho MANAGER/STAFF. Chưa có sửa/xóa nhóm.
Service.category vẫn là chuỗi, không đổi schema dịch vụ hoặc chuyển dữ liệu cũ. Danh sách chọn nhóm hợp nhất ServiceGroup.name và Service.category cũ cùng spa; nhóm chưa có dịch vụ vẫn được lưu. Nhập nhóm mới trong form dịch vụ lưu category khi lưu dịch vụ; lần sau có thể chọn lại từ category này. Không tự sao chép danh mục spacare_live sang spacare_dev. Form Thêm gói mẫu dùng select nhóm option theo dịch vụ active; nếu danh mục dev trống hiển thị hướng dẫn thêm dịch vụ trước và chặn lưu form rỗng. Sửa gói cũ vẫn hiển thị dịch vụ ngừng đã gắn, backend giữ kiểm tra active hiện có.
GET workspace thêm serviceGroups [{_id,name}] cho OWNER tại services/package_catalog; truy vấn cùng spa. Bổ sung script db:service-groups chỉ tạo collection/index mới trong spacare_dev/spacare_test, từ chối production/Vercel production; không chạy trong phiên sửa code. Production cần duyệt bước tạo index riêng, không chạy db:setup để cập nhật tính năng. Rollback không xóa category/nhóm/dịch vụ; không cần backfill.


## Áp thẻ ngay khi tạo hóa đơn — 24/10/2026
CONFIRMED theo yêu cầu người dùng: khi tạo hóa đơn dịch vụ lẻ có thể chọn thẻ tiền mặt hiện có của đúng khách và áp dụng ngay. Giữ giới hạn chỉ dịch vụ lẻ, không áp cho mua gói/sản phẩm/buổi liệu trình. Chọn thẻ là tùy chọn, không tự trừ chỉ vì khách có thẻ.
PROPOSED kỹ thuật: invoice nhận cashCard? {cardId,amount,additionalAmount?,method?,receivedConfirmation?}; tạo Invoice và gọi cùng logic redeemCashCard tuần tự trong một transaction với Control guard, idempotency và audit hiện có. Số dư/khách/spa/công nợ/quyền/sổ ngày được kiểm tra lại ở backend; lỗi bất kỳ rollback cả hóa đơn, số dư, ledger và phần thu thêm. Phần thẻ chỉ tăng paid/cardPaid, không tạo dòng tiền; chỉ phần thu thêm tạo Payment/CashEntry và phải xác nhận thực nhận. UI Thu ngân và form Tạo hóa đơn dùng danh sách thẻ phân trang của khách, không mặc định chọn, hiện số dư/công nợ sau thanh toán. Đổi khách/dịch vụ/giá hoặc dùng liệu trình bỏ lựa chọn cũ. Không đổi schema/index, không migration hay sửa dữ liệu cũ/production. Rollback giao diện không xóa ledger, phải giữ backend hiểu paid/cardPaid và guard CARD_SALE.


## Nhập số dư lịch sử — 24/10/2026
CONFIRMED: người dùng cung cấp bảng khách, xác nhận thêm 0 đầu SĐT, tiền ghi thiếu 000 được hiểu theo nghìn đồng, các dòng trống thuộc khách ngay phía trên; Gđ là Gội đầu, Cơ bản là Mặt cơ bản, dương sinh là dưỡng sinh. Số buổi là còn lại; các liệu trình đã trả đủ. 23 khách, 29 liệu trình/107 buổi, 4 thẻ còn 12.950.000đ, riêng nợ mỹ phẩm 7.000.000đ. Dữ liệu cá nhân nguồn chỉ lưu imports/ bị Git bỏ qua. Người dùng yêu cầu hoàn thiện công cụ rồi nhập live; chưa ghi production trong phiên.
PROPOSED kỹ thuật: CLI import-opening-balances mặc định preview ngoại tuyến. --check chỉ đọc DB với OWNER active xác thực lại; so sánh cùng spa, khớp tên dịch vụ NFC/khoảng trắng/chữ thường còn dấu hoặc mapping ID được duyệt. Không tự tạo dịch vụ thiếu, không gộp hồ sơ khác tên cùng SĐT, không cộng đè quyền lợi/thẻ/công nợ có sẵn. --write cần database khớp URI và dữ liệu nguồn, mã đợt ổn định, --approve hash báo cáo đối chiếu và --app-ready xác nhận code tương thích đã deploy; Control guard/transaction snapshot+majority tuần tự, batch Idempotency unique, audit ID các bản mới. Kiểm tra collection/index trước nhập, không tự setup/index vào production. Chỉ cho spacare_live/dev/test, không đổi URI.
Schema bổ sung không backfill/index mới: Invoice.openingBalance/openingDate; Treatment.openingBalance/openingRemaining; CashCard.origin thêm OPENING, openingDate/sourceLabel. Gói nguồn tạo chứng từ liên kết PACKAGE tổng=paid=0/status PAID với nhãn đã trả đủ trước chuyển đổi, không coi 0 là giá mua gốc hay quà tặng. Treatment chỉ remaining/openingRemaining, không bịa totalSessions, startsOn giữ ngày nguồn, chưa có expiresOn; báo cáo duyệt cảnh báo gói được dùng theo số buổi, chưa xác định hạn gốc. Số buổi mới đánh từ 1 kể từ chuyển đổi bằng usedSessions; không tái tạo buổi/chữ ký/hoa hồng cũ. Thẻ OPENING amount=balance=số dư chuyển, không phải mệnh giá gốc hoặc khoản thu mới; không tự tách phần mua/quà. Nợ cũ chứng từ PRODUCT không productId, không xuất kho, total=số còn nợ/paid=0; thu sau bằng payment hiện hành và không có hoa hồng bán gói. Không tạo CashEntry/Payment/Commission/SaleCommission lúc chuyển số dư; buổi thực hiện sau chuyển đổi vẫn hưởng theo quy tắc hiện hành.
UI/PDF ghi rõ chứng từ chuyển số dư, tổng gốc chưa có, 0 chỉ nghĩa không thu thêm; không hiển thị tiến độ dựa trên tổng buổi chưa biết. updateInvoice/refundPackage chặn chứng từ chuyển số dư. API operations không mở action import công khai; CLI xác thực OWNER từ DB. Rollback trước commit tự động toàn đợt; sau commit dùng báo cáo IDs/audit đối soát và kế hoạch sửa được chủ duyệt, không xóa/reset/restore tự động. Không quay về code không hiểu openingBalance/OPENING sau có dữ liệu; giữ patch tương thích hoặc khóa ghi. Backup và kiểm tra deploy trước ghi thật.


## Gộp bảng mặt và gội — xác nhận 24/10/2026
CONFIRMED: Yến Thương giữ 1 buổi Mặt cơ bản và 11 buổi Gội đầu dưỡng sinh 1; dòng GD 11 trong bảng gội là cùng quyền lợi, không cộng lần hai. Ng T Lệ Quyên còn 1 buổi Gội đầu cấp collagen và được tặng 1 buổi Laser Carbon. Khách thiếu SĐT giữ trống, không tự tạo số giả hoặc nhận SĐT khách phía trước.
PROPOSED kỹ thuật: openingInput.phone cho phép thiếu/null/chuỗi rỗng và chuẩn hóa thành undefined; duplicate detection chỉ kiểm số có thật. Khách thiếu SĐT không tự gộp với bất kỳ hồ sơ thiếu số khác, cùng tên có sẵn hoặc trùng tên trong nguồn phải đối chiếu riêng; tạo Customer không có field phone. Mã batch vẫn bảo vệ retry. Treatment input thêm gift/benefitNote tùy chọn, giữ quyền lợi mặt nạ thêm kèm trong tên liệu trình/chứng từ và audit, không cộng thành buổi gội hay tự đặt giá. Gói GD+CVG giữ nhãn kết hợp và phải ánh xạ với danh mục thực tế trước ghi. Gộp ngoại tuyến ra imports/opening-combined.review.json: 84 khách, 93 dòng quyền lợi/319 buổi, 6 thẻ số dư 14.310.000đ, riêng nợ mỹ phẩm 7.000.000đ; 3 khách chưa có số. Loại 3 dòng quyền lợi lặp và 1 thẻ lặp; lưu provenance hai nguồn trong file review bị Git bỏ qua. Chưa đối chiếu/ghi live.


Workspace performance (2026-10-25): GET /api/workspace?section=customers returns a lightweight shell (user, date, scoped staff choices, empty operational collections). Customer rows and visit history remain in the authenticated, paginated GET /api/customers endpoint. Other section contracts and backend permissions are unchanged.


## Optional appointment performer (2026-10-25)
CONFIRMED user request: appointment creation permits omitted staffId (unassigned); a supplied staffId must reference active OWNER/STAFF in the authenticated spa. Appointment.staffId is optional. CompleteAppointment and completeTreatmentAppointment accept optional staffId to assign an unassigned visit before recording performance, commission or signed treatment use, in the existing transaction with idempotency and audit. Existing assigned visits retain their performer. PROPOSED technical handling: unassigned visits remain visible/manageable to owner/cashier under existing scope; ordinary staff scope is unchanged. Rescheduling still requires an assigned performer.


Performance follow-up (2026-10-25, PROPOSED technical design): salary, commission, products, product_groups, inventory and cash_cards also use lightweight workspace shells because their panels own authenticated APIs. Soft navigation mounts those panels directly. Dashboard finance totals are computed only for overview; treatment-use totals only for treatment_uses. Other response totals default to zero and are not dashboard values. Independent search reference reads run concurrently outside transactions. GET /api/workspace and /api/customers expose Server-Timing auth/data durations without request values or secrets. No cross-request account cache or authorization relaxation.


Measured production follow-up (2026-10-25): authenticated read samples: customers 1316ms (auth 412.5ms, data 619.9ms), invoices 2795ms (auth 422.7ms, data 1888.1ms), appointments 5401ms (auth 2148.2ms, data 2955.4ms). Single samples, not an SLA. Response routing reported hkg1::iad1; Atlas region is unverified. PROPOSED technical optimization: read page/catalogs concurrently; read package invoice metadata/customer references concurrently; customer count/rows concurrently with last-page fallback retained. Reads only; backend account/spa checks and transaction writes unchanged. Re-measure after deployment; select compute region after verifying database region.


## Multi-service cashier invoice (2026-10-25)
CONFIRMED user request: checkout can select multiple standalone services in one invoice.
`serviceInvoice` (OWNER/cashier only): customerId, staffId, items [{serviceId,total?}], dueDate?, cashCard?. Backend validates the current account and every reference against the authenticated spa, rejects inactive services/performers, duplicate services, empty lists, more than 30 lines, nonpositive prices and aggregate money overflow. Prices default to the current service price. No packages, products, or treatment sessions are combined by this action.
Invoice.serviceItems stores immutable serviceId/name/total/fixed-commission snapshots. Invoice total and commission are computed by the backend. A multi-service invoice omits top-level serviceId; a single-line invoice retains it for compatibility. Both are kind SERVICE. Existing invoices remain readable without migration.
PROPOSED technical handling: one selected performer completes all selected services. One Commission record per invoice holds the summed fixed commission and combined service names (serviceId optional for bundles); item-level amounts remain in Invoice.serviceItems. Checkout records performedBy/performedAt immediately, following the completed-service cashier flow. No package sales commission is generated.
The existing transaction commits invoice, commission, optional cash-card debit/additional payment, audit and idempotency together. All transaction writes remain sequential. Cash cards may pay standalone serviceItems; existing package/product/session exclusions remain. Standard payment/deposit operations apply to the combined invoice balance. Detail and PDF show each service/amount separately. Completed invoices retain existing edit restrictions.


## Product origin and dates (2026-10-25)
User request: product create/edit includes origin, manufacturedOn and expiresOn. All three fields are optional for existing/unknown metadata. Origin is trimmed text up to 200 characters; dates are real calendar YYYY-MM-DD strings, and expiry cannot precede manufacture when both are provided (technical validation). Product schema, product/updateProduct actions and product list expose these values under existing owner edit permissions and spa scope. Empty form values clear metadata. Dates currently describe the catalog product, not individual inventory batches. No automatic expiry-based stock changes, sales restriction or expiry alerts are introduced.


## Public multi-service booking and free minute arrival (2026-10-25)
CONFIRMED user request: public booking allows multiple services and choosing arrival hour/minute rather than 30-minute presets. The form uses checkbox selections, a combined estimated total and a native time input with 60-second steps. Opening hours remain 09:00-22:00 Vietnam time; past/out-of-hours requests remain invalid. Arrival time does not reserve a duration or imply staff capacity.
POST /api/booking accepts serviceIds (1-30 unique service IDs), or legacy serviceId, but not both. The first service identifies the spa; every subsequent service must be active and in that same spa. Client spaId/staffId/price are never trusted. One Appointment is created with requestedServices [{serviceId,name}] snapshots and legacy primary serviceId. One owner notification contains all requested names. All writes and idempotency remain in the existing transaction.
Internal list, timeline and customer history display all requested names. Postponed replacement appointments copy requestedServices. Completing a multi-service visit creates one SERVICE invoice with serviceItems, current catalog prices and the sum of fixed service commissions; one performer and one commission entry cover the visit, as in cashier bundles. The multi-service completion form does not offer a single-service price override or unrelated invoice linkage. Legacy single-service completion is unchanged. No new invoice is generated while the client is only booking.


## Notification expansion (2026-10-25)
CONFIRMED user request supersedes owner-only booking notification behavior:
- Push carries the saved title/body (guest, phone, selected services and arrival time for online bookings), with a bounded preview and a link to full details.
- New online bookings notify all active OWNER/STAFF in the same spa. STAFF may read public booking records through bookingSource=PUBLIC_WEB, in addition to their own appointments. This does not grant completion, reschedule, cancellation, invoice or financial rights over another staff member's work. Rescheduled replacement public bookings retain bookingSource.
- Newly created invoices from operational actions notify active owners only. The notification contains customer, invoice description/total, creator and invoice link. Queuing is atomic with invoice/commission/payment/audit/idempotency. Imports of opening balances do not produce a new-sale notification. Retries do not duplicate committed events.
- Daily closing reminders target owners at 22:00 Vietnam time if that day's Day is missing or not CLOSED. They do not open/close a book automatically. They are deduplicated per spa/owner/day under the shared Control transaction guard. A fresh closed-day check suppresses unsent reminders; closeDay marks outstanding reminders read/sent within the closing transaction.
PROPOSED technical storage: Notification retains legacy booking notifications and indexes; ActivityNotification is a separate generalized outbox for INVOICE_CREATED and DAY_CLOSE, with userId, eventKey, kind, optional invoiceId/day, title/body/url, readAt, pushState, nextAttemptAt and attempts. Unique index (spaId,userId,eventKey), inbox index (spaId,userId,createdAt), dispatch index (pushState,nextAttemptAt). Additive setup through npm run push:db creates the new collection/indexes; no history deletion or legacy index replacement.
GET/POST /api/notifications authenticate active OWNER/STAFF and scope every inbox/device read/write to the current spa/user. STAFF only read booking notifications; owner inbox merges booking and financial/reminder events. Device subscriptions still require explicit browser permission. Invalid/expired subscriptions are removed; transient push failures retain the lease/backoff queue. Background sending uses after() once operational writes commit.
GET /api/notifications/daily-close is protected by constant-time CRON_SECRET Bearer authentication, uses no-store, enqueues missing reminders and dispatches pending pushes. vercel.json schedules 0 15 * * * (UTC), which is 22:00 Vietnam time. Requires CRON_SECRET in the Vercel production environment and a new production deployment. Vercel Hobby does not guarantee minute precision: delivery invocation can be 22:00-22:59; exact scheduled-minute execution requires a suitable scheduler/plan. External schedulers can call this same authenticated endpoint. Reference: https://vercel.com/docs/cron-jobs/usage-and-pricing .


## Ten-minute reminders and readable invoice codes (2026-10-25)
CONFIRMED user request: notify ahead of appointments by ten minutes; emphasize invoice service/payment/status text and amounts; show invoice codes as HD plus digits.
Appointment reminders: ActivityNotification adds APPOINTMENT_REMINDER, appointmentId and appointmentStartAt. The scheduler scans CONFIRMED appointments where now < startAt <= now+10min, rechecks inside the spa Control transaction, and deduplicates eventKey appointment:<id>:<startAt ISO> per recipient. Public visits notify all active owners/staff of that spa; internal visits notify owners and assigned staff only. A new start time can produce a new reminder, but canceled/postponed/completed/expired or reassigned visits are checked again before push. Reminder TTL is capped at arrival (at most 600 seconds). If booked less than ten minutes ahead, notify on the next check rather than invent a full ten-minute interval.
GET /api/notifications/dispatch now queues due appointment reminders before sending; it still requires CRON_SECRET Bearer authentication. Call it once per minute from an external scheduler or configure a suitable Vercel plan. Default vercel.json keeps its Hobby-compatible daily closing job; it does not enable a per-minute cron that would break Hobby deployments. Inbox polling and booking/operation callbacks also check nearby appointments, but cannot guarantee background reminders when no client is open. No external scheduler has been provisioned by this code change. STAFF inbox now includes only booking notifications and APPOINTMENT_REMINDER activity events; invoice/closing activity remains owner-only, including read/readAll operations.
PROPOSED technical code scheme: Invoice.code (HD plus a per-spa sequence padded to six digits), unique partial index (spaId,code). Control.invoiceSequence increments inside the existing invoice transaction, rolls back on failure and is not incremented on idempotent replay. MongoDB ObjectIds remain unchanged in URLs and references. Old invoice metadata is backfilled using npm run db:invoice-codes, which creates indexes and serializes each spa migration under Control; it preserves existing codes and financial values, and resumes after the greatest assigned sequence. Until backfill, a deterministic full numeric ObjectId fallback is displayed without truncation. No live backfill has been run by these source changes. Invoice lists, detail, PDF and new invoice notifications use the shared display formatter; code is searchable in invoice lists.


## Hủy hóa đơn chưa thanh toán — 25/10/2026
CONFIRMED theo yêu cầu người dùng: OWNER được hủy hóa đơn nhập sai chưa thanh toán để không cộng công nợ; giữ chức năng sửa hóa đơn chưa giao dịch. Không xóa cứng lịch sử.
PROPOSED kỹ thuật: cancelInvoice {id, expectedUpdatedAt, reason} dùng phiên active/cùng spa, quyền OWNER, transaction Control guard, idempotency và audit before/after. Dùng cùng điều kiện an toàn với updateInvoice: chỉ SERVICE/legacy/PACKAGE chưa thực hiện, chưa liên kết lịch/buổi, không phải quà hay chứng từ mở đầu; không có lịch sử Payment/Allocation/CashCardUse/hoa hồng, hoàn tiền hoặc thẻ tặng; gói và quà chưa dùng/chưa có lịch, ngày lập chưa chốt. Sai phiên bản trả 409. Hủy cả họ hóa đơn/quà và liệu trình liên quan trong transaction tuần tự. Invoice.status=CANCELLED, cancelledTotal giữ giá trị trước hủy, total=0/paid=0 để mọi tổng hợp công nợ và giá trị hóa đơn hiện tại không tính khoản đã hủy; cancelledAt/cancelledBy/cancelReason lưu dấu vết. Giá trị trước hủy chỉ để đối chiếu, không phải tiền đã thu/hoàn. Treatment.status bổ sung CANCELLED; không xóa số buổi lịch sử. Không tạo dòng tiền hay hoàn tiền. Mọi thao tác ghi tham chiếu hóa đơn hủy bị backend từ chối. Không migration/index hoặc ghi dữ liệu vận hành trong phiên triển khai. Hóa đơn đã thực hiện/hoa hồng hoặc xuất kho dù chưa thu tiền vẫn cần quy trình xử lý riêng, chưa hỗ trợ hủy trực tiếp.


## Sửa/hủy dịch vụ đã thực hiện nhưng chưa thanh toán — 25/10/2026
CONFIRMED theo yêu cầu mới nhất: chỉ OWNER được sửa/hủy hóa đơn dịch vụ chưa thanh toán kể cả đã ghi nhận thực hiện/hoa hồng; thay hạn chế trước về performedAt/appointmentId đối với dịch vụ lẻ. STAFF kể cả cashier bị từ chối tại backend. Giữ chặn lịch sử tiền/cọc/thẻ, chứng từ mở đầu, buổi liệu trình và hóa đơn gói đã dùng. Không thay quyền các nghiệp vụ khác.
PROPOSED kỹ thuật: updateInvoice sửa nội dung, tổng tiền dương, hạn trả; giữ khách, dịch vụ, người thực hiện và hoa hồng cố định. serviceItems phân bổ tổng giá mới theo tỷ lệ giá snapshot với số nguyên/BigInt, phần lẻ chia theo thứ tự dòng, không dùng giá danh mục hôm nay. Không hỗ trợ đổi danh mục dịch vụ/nhân viên qua form này. cancelInvoice đưa Commission chưa gắn payrollId về 0, giữ bản ghi và snapshot trước hủy trong Audit; nếu hoa hồng đã thuộc bảng lương duyệt/chi thì chặn hủy với lý do rõ ràng, không sửa bảng lương đã khóa. Sửa giá không thay hoa hồng cố định kể cả đã chốt lương. Giữ lịch hẹn/thời điểm thực hiện để đối chiếu; hủy hóa đơn không tự hủy lịch hay tạo lượt phục vụ mới. Không migration/index hoặc ghi dữ liệu vận hành. Mọi cập nhật trong transaction tuần tự, kiểm tra phiên bản và idempotency hiện có.

Bổ sung theo xác nhận tiếp theo: hủy phải loại hoa hồng và số liệu khách tương ứng; sửa tự cập nhật số liệu. updateInvoice nhận items? [{serviceId,total}] (1–30, không trùng, active/cùng spa, tổng khớp total). Form sửa dịch vụ chọn lại dịch vụ và giá từng dòng, backend tự kiểm tra tổng; giữ người thực hiện. Đổi dịch vụ cập nhật tên/snapshot và hoa hồng cố định từ danh mục cho dịch vụ mới, dịch vụ không đổi giữ mức snapshot cũ. Chỉ đổi giá không đổi hoa hồng cố định. Hoa hồng đã chốt lương không được đổi giá trị; trả 409 nếu thay dịch vụ làm đổi hoa hồng. Commission.cancelledAt mới đánh dấu bản ghi hủy, amount=0; danh sách/thống kê hoa hồng và tập lấy vào bảng lương loại cancelledAt, không xóa cứng. Hồ sơ khách giữ lịch sử hóa đơn hủy nhưng không tính số hóa đơn hiệu lực/công nợ; gói hủy không tính gói đang dùng. Lịch sử lịch hẹn vẫn giữ sự kiện khách đã đến, không tự xóa lần đến. Không thêm index/backfill.


## Xóa vĩnh viễn hóa đơn nhập nhầm chưa phát sinh — 25/10/2026
CONFIRMED theo yêu cầu mới nhất: chỉ OWNER được xóa hẳn hóa đơn nhập nhầm đã hủy, chưa thanh toán/áp cọc/thẻ, chưa phát sinh hoa hồng, thực hiện, lượt dùng hoặc liên kết vận hành. Ngoại lệ này thay quy tắc giữ mọi hóa đơn hủy trước đó; không cho xóa lịch sử tài chính hoặc dữ liệu đang được tham chiếu. Hồ sơ khách giữ nguyên.
PROPOSED kỹ thuật: deleteInvoice {id,expectedUpdatedAt,reason,confirmDelete:true}. Backend xác thực active OWNER/cùng spa, trạng thái CANCELLED, phiên bản mới nhất. Chặn openingBalance; paid/cardPaid/refunded/saleCommissionAccrued; performedAt/performedBy; appointmentId/treatmentId/treatmentUseId/giftOfInvoiceId/productId; kind PRODUCT/SESSION/GIFT. Kiểm tra Payment, Allocation, CashCardUse, Commission (kể cả đã hủy/0đ), SaleCommission, SharedSaleCommission, StockMovement, Treatment theo invoiceId/giftOfInvoiceId, hóa đơn quà và CashCard nguồn. Bất kỳ tham chiếu nào đều chặn 409, không cascade. Ngày lập đã chốt phải mở lại. Xóa Invoice và thông báo INVOICE_CREATED tuần tự trong transaction Control snapshot/majority; giữ audit/idempotency và nhật ký cũ, không sao chép thêm hóa đơn. Retry cùng khóa không xóa lại. Không tái dùng mã/giảm sequence. UI OWNER có Xóa vĩnh viễn ở danh sách/chi tiết hóa đơn hủy; bắt lý do và tích xác nhận không thể khôi phục. Không schema/index/migration mới; không xóa dữ liệu vận hành trong phiên triển khai.


## Xem trước đối chiếu chốt sổ — 25/10/2026
CONFIRMED theo yêu cầu người dùng: tiền mặt kỳ vọng hiện khi sổ OPEN; nhập tiền kiểm đếm được xem trước thừa/thiếu trước khi xác nhận chốt. Không tự tạo khoản cân sổ, không thay quyền mở/chốt/mở lại.
PROPOSED kỹ thuật: GET workspace section=days bổ sung liveExpected,cashIn,cashOut,liveBankNet cho từng ngày OPEN trong trang bằng aggregate toàn bộ CashEntry cùng spa/ngày, không dùng danh sách giao dịch đã phân trang hoặc bộ lọc thu chi khác. Đảo sai sót tính cả gốc và bút toán đối ứng, không bỏ gốc reversed. CLOSED giữ snapshot đã chốt. OPEN/reopened không hiển thị counted/difference cũ như số mới. Không ghi Day khi xem. Form closeDay xem đầu ngày/thu/chi/kỳ vọng, nhập counted và hiển thị chênh lệch; submit gửi expectedPreview? (số nguyên, tùy chọn tương thích client cũ). Backend tính lại trong transaction và trả 409 nếu khác expectedPreview, trước khi lưu/audit/đánh dấu thông báo; client tải lại, yêu cầu mở lại đối chiếu. Giữ idempotency và audit hiện có. Không schema/index/migration hay ghi dữ liệu vận hành trong phiên triển khai. Số tạm tính phản ánh lúc tải, không cam kết realtime; đóng sổ vẫn kiểm tra lại ở backend.


## Xóa hóa đơn đã thu, nhập ngày hóa đơn, lịch gói và dịch vụ thêm — 25/10/2026
CONFIRMED yêu cầu mới nhất thay giới hạn chỉ xóa hóa đơn hủy chưa thanh toán: OWNER được xóa hóa đơn nhập sai đã thu và trừ số liệu liên quan. Hóa đơn có ngày tùy chọn, mặc định hiện tại; dùng gói 0đ có thể thêm dịch vụ lẻ phải trả trong cùng hóa đơn. Khi đặt lịch, chọn khách thấy các gói khả dụng của khách và chọn gói tự chọn dịch vụ; dịch vụ chọn bằng ô lớn.
PROPOSED kỹ thuật: deleteInvoice giữ active OWNER/phiên bản/idempotency/transaction; xử lý cả invoice và họ quà. Khoản Payment chưa đảo được đánh dấu reversed và có CashEntry REVERSAL OUT ngày hiện tại với originalId unique (không ghi là hoàn tiền thực tế); cần sổ hiện tại OPEN nếu có tiền. Allocation chưa đảo trả balance cọc; CashCardUse chưa đảo trả balance thẻ và lưu reversedAt; hoa hồng chưa gắn payrollId đưa về 0, Commission đánh dấu cancelledAt. Phiếu xuất bán được bù phiếu nhập MANUAL có audit; gói chưa dùng chuyển CANCELLED, thẻ tặng chưa dùng về 0. Xóa bản ghi hóa đơn chính, giữ lịch sử tiền/kho/audit/idempotency; thông báo tạo hóa đơn được gỡ. Hóa đơn quà giữ CANCELLED/0đ. Chặn chứng từ mở đầu, buổi đã ký, gói có lượt ký, gói còn lịch chờ, thẻ tặng đã dùng, hóa đơn đã hoàn và hoa hồng đã chốt/chi lương; không xóa dây chuyền các bằng chứng đó. Đây là giới hạn triển khai hiện tại, chưa phải hỗ trợ mọi ngoại lệ. Không reset dữ liệu thật.
issuedOn? YYYY-MM-DD chỉ nhận ở invoice/serviceInvoice/sellPackage/sellProduct; backend kiểm ngày thật/không tương lai. Khi có ngày, Invoice.createdAt dùng 12:00 giờ Việt Nam của ngày chọn để tra/báo cáo theo ngày; recordedAt giữ thời điểm nhập thật. Không có ngày giữ thời gian hiện tại. Thu tiền/cọc vẫn theo ngày thực ghi hiện tại, không backdate tiền. Gói triệt 36 tháng tính ngày mua đã chọn. Không tự backdate chữ ký/thực hiện/hoa hồng lịch sử.
invoice thêm additionalServices? [{serviceId,total}] tối đa 30, không trùng, dịch vụ active/cùng spa, giá dương. Nhánh treatmentId ghi buổi có chữ ký như cũ rồi trong cùng transaction thêm serviceItems (dòng gói 0đ + dòng lẻ), tổng phần lẻ và công nợ, cộng hoa hồng cố định vào Commission lần thực hiện cho cùng nhân viên. Hóa đơn kind SESSION có tổng dương khi có phần lẻ; không áp thẻ cho hóa đơn hỗn hợp trong phiên bản này. Lỗi rollback cả buổi/chữ ký/quyền lợi/hóa đơn/hoa hồng. Cashier cho chọn thêm ô dịch vụ lẻ và giá từng dòng trong Dùng gói. Gói khả dụng vẫn chịu điều kiện ngày/quyền lợi/bảo lưu tại backend. Không thêm indexes hoặc migration; schema mới Invoice.recordedAt, CashCardUse.reversedAt.


## Giữ giỏ liệu trình khi chuyển danh mục — 25/10/2026
CONFIRMED người dùng: khách dùng gói đã mua phải có thể thêm dịch vụ lẻ và sản phẩm trong cùng một lần thu ngân; chuyển tab không được thay thao tác làm mất gói đang chọn.
PROPOSED kỹ thuật: tách browseMode danh mục khỏi mode hóa đơn. Khi đã chọn gói, tab dịch vụ/sản phẩm thêm hoặc bỏ dòng trong giỏ, giữ gói/người thực hiện/chữ ký. Đổi khách xóa toàn bộ giỏ. Bán gói mới vẫn là luồng riêng (chọn tab này xóa giỏ hiện tại). Nhánh invoice có treatmentId thêm additionalProducts? [{productId,quantity,unitPrice}] tối đa 30, không trùng ID, giá/số lượng nguyên dương; kiểm product active/cùng spa/tồn kho và tổng tiền ở backend. Tạo Invoice.productItems snapshot tên/đơn vị/giá/số lượng/tổng; tổng hóa đơn = phần dịch vụ lẻ + sản phẩm, buổi gói vẫn 0đ. Không sinh hoa hồng bán sản phẩm. StockMovement.checkoutInvoiceId lưu tham chiếu hóa đơn hỗn hợp, không tái dùng invoiceId vì index unique cũ chỉ cho một phiếu/hoá đơn; không thay index đang vận hành. Xuất kho tuần tự cùng transaction ghi buổi/chữ ký/hoa hồng/hóa đơn, lỗi bất kỳ rollback cả lượt dùng và tất cả sản phẩm; idempotency giữ một lần trừ kho. API đọc/PDF hiển thị sản phẩm riêng. Không áp thẻ tiền cho hóa đơn hỗn hợp; không mở xóa hóa đơn đã có chữ ký. Không migration hay ghi dữ liệu vận hành trong phiên này.


## Chọn nhiều liệu trình — 25/10/2026
CONFIRMED phạm vi: một lần đặt lịch/thu ngân có nhiều liệu trình của cùng khách.
PROPOSED kỹ thuật, POST /api/operations giữ xác thực/quyền/idempotency/transaction:
- appointment thêm treatmentIds?: string[] (1–30 ID không trùng), hoặc treatmentId cũ; không gửi cả hai. serviceId là dịch vụ của gói đầu. Backend kiểm mọi gói cùng spa/khách và dùng được tại ngày hẹn; chưa ghi buổi.
- invoice thêm treatments?: [{treatmentId,signature,remainingBefore}] (1–30, không trùng), hoặc treatmentId/signature/remainingBefore cũ; không gửi cả hai kiểu. serviceId là dịch vụ đầu, staffId chỉ nhân viên active OWNER/STAFF. Các dòng additionalServices/additionalProducts vẫn dùng; cashCard bị chặn cho hóa đơn có liệu trình. Mỗi gói có chữ ký/token riêng, trả invoiceId chung.
- completeTreatmentAppointment nhận treatments với đúng tập ID đã đặt, chữ ký/token từng gói; client cũ vẫn gửi signature/remainingBefore khi lịch chỉ có 1 gói. Chỉ chủ/thu ngân/nhân viên được giao hoàn thành. Thiếu một xác nhận hoặc một token cũ rollback tất cả; lịch chưa COMPLETED. Retry đã hoàn thành không trừ buổi lại.
- rescheduleAppointment kiểm tất cả gói khả dụng ngày mới, giữ treatmentIds/requestedServices khi tạo lịch thay thế.
GET invoice detail trả đủ signatures có quyền đọc của mọi buổi trên hóa đơn chung, phân trang như trước; serviceItems/PDF có từng dòng gói 0đ. Không thêm endpoint/import hoặc thay chính sách tiền.


## Nhắc kiểm kê tiền/chốt sổ từ 22h — 25/10/2026
CONFIRMED: nhắc chủ spa kiểm đếm tiền, đối chiếu thu chi và chốt sổ lúc 22:00 giờ Việt Nam khi sổ hôm nay chưa CLOSED.
PROPOSED kỹ thuật bổ sung: GET /api/notifications của OWNER gọi queueClosingReminders trước khi đọc inbox, chỉ trong spaId từ phiên active; STAFF không kích hoạt nhắc chủ spa. Client đang hiển thị kiểm tra mỗi 30 giây và tải ngay khi quay lại tab. Trước 22h không truy vấn/ghi nhắc; sau 22h giữ Control transaction và unique eventKey theo spa/người/ngày, không tạo trùng hoặc tự mở/chốt sổ. Lỗi tạo nhắc không chặn đọc inbox. Thông báo ghi rõ kiểm đếm tiền thực tế.
Endpoint CRON_SECRET /api/notifications/dispatch bổ sung queueClosingReminders cùng nhắc lịch và dispatch, dynamic/no-store; scheduler ngoài gọi endpoint này cũng có thể tạo nhắc chốt sổ. /daily-close và cron 0 15 * * * (UTC) giữ nguyên. Polling là dự phòng khi mở ứng dụng, không bảo đảm gửi nền nếu đóng app. Vercel Hobby có thể gọi trong 22:00–22:59; gửi nền sát 22:00 cần scheduler phù hợp đã được cấu hình. Production cần CRON_SECRET, collections/indexes push và VAPID/thiết bị đã cấp quyền để nhận push; chưa xác minh cấu hình/log production trong phiên này. Không schema/index/migration hay thao tác dữ liệu thật.


## Một chữ ký tùy chọn cho hóa đơn — 25/10/2026 (ưu tiên mới nhất)
CONFIRMED theo yêu cầu mới nhất: mỗi hóa đơn chỉ ký một lần và chữ ký không bắt buộc. Yêu cầu này thay quy tắc phải ký từng liệu trình/phải có chữ ký mới ghi buổi trước đây. Hóa đơn có nhiều liệu trình vẫn ghi nhận từng lượt dùng và trừ đúng quyền lợi dù không ký; không thay kiểm tra quyền, spa/khách, trạng thái, remainingBefore, transaction, idempotency hoặc audit.

PROPOSED kỹ thuật: Thu ngân, form hóa đơn và hoàn thành lịch nhiều liệu trình dùng một SignaturePad chung, có thể để trống. Ghi buổi không đặt lịch cũng có chữ ký tùy chọn. UI chỉ gửi signature nếu đã vẽ; chữ ký gửi lên nhưng sai định dạng vẫn bị từ chối (xóa nét ký để bỏ qua). invoice/completeTreatmentAppointment nhận signature? chung và treatments [{treatmentId,remainingBefore}]; use.signature cũng optional. Tương thích client cũ: chữ ký từng dòng được nhận nếu đồng nhất với chữ ký chung/nhau; gửi nhiều chữ ký khác nhau bị từ chối, không âm thầm bỏ bằng chứng.

TreatmentUse.confirmationUseId? (ObjectId) liên kết các lượt sau với lượt đầu cùng hóa đơn; chỉ lượt đầu lưu nét ký. Có ký: lượt đầu method DRAWN_SIGNATURE, các lượt dùng chung method INVOICE_SIGNATURE, giữ digest/snapshot và tham chiếu xác nhận. Không ký: method STAFF_RECORDED, không tạo signature/signatureDigest giả; snapshot ghi rõ nhân viên ghi nhận, không có chữ ký khách hàng. Các lượt sau vẫn liên kết lượt đầu để xem hóa đơn không lặp xác nhận. Audit không lưu nét ký, chỉ digest nếu có và evidenceRecorded phản ánh thực tế.
Đọc chữ ký dùng chung kiểm quyền trên cả lượt hiện tại và nguồn, nguồn phải cùng spa/customer/checkoutInvoiceId, không theo chuỗi tham chiếu. Chi tiết hóa đơn dùng buổi chỉ hiển thị một xác nhận; lịch sử gói vẫn tra được chữ ký chung của buổi tương ứng. Dữ liệu/chữ ký cũ giữ nguyên. Không thêm indexes/migration/backfill, không sửa dữ liệu thật. Giữ hạn chế sửa/xóa lịch sử đã có lượt dùng, kể cả lượt không ký.


## Giỏ nhiều loại và lịch kết hợp dịch vụ/gói — 25/10/2026
CONFIRMED: một lịch hẹn có thể chọn nhiều dịch vụ lẻ cùng nhiều liệu trình khách đã mua. Tìm kiếm/nhóm chỉ lọc dịch vụ lẻ; liệu trình nằm riêng bên dưới, không bị lọc và không bị mất khi chọn dịch vụ. Thu ngân cho tích nhiều gói mới/nhiều sản phẩm; giữ mọi loại mục khi chuyển danh mục.

PROPOSED kỹ thuật:
- Appointment.serviceIds? lưu riêng các dịch vụ lẻ; treatmentIds giữ các gói dùng. requestedServices chứa tên cả hai để hiển thị/nhắc lịch. serviceId và treatmentId đầu vẫn tương thích dữ liệu cũ. appointment nhận serviceIds? (1–30 không trùng) và treatmentIds? (1–30); mọi tham chiếu active/cùng spa, gói đúng khách/ngày. Đặt lịch không ghi tiền/trừ buổi. Dời/xếp lại giữ cả danh sách; hoàn thành lịch gói tính thêm đúng các serviceIds với giá/hoa hồng danh mục tại lúc hoàn thành, giữ một hóa đơn SESSION và một chữ ký tùy chọn. Gói 0đ không bị cộng giá bán lại. Lịch chỉ có dịch vụ lẻ dùng luồng completeAppointment nhiều dòng hiện có.
- Thu ngân giữ bốn danh sách giỏ độc lập. Giá/số lượng/khuyến mãi/gói tặng/thẻ tặng theo từng gói mới; danh sách người tư vấn và hạn trả chung áp dụng từng hóa đơn gói. Đổi khách/xóa giỏ mới xóa các mục. Không tự áp thẻ hoặc tự xác nhận đã thu tiền.
- productInvoice {customerId,dueDate?,items:[{productId,quantity,unitPrice}]} OWNER/cashier: một hóa đơn PRODUCT có productItems snapshots, nhiều StockMovement.checkoutInvoiceId để giữ unique invoiceId index cũ. Trừ kho tuần tự, kiểm tồn/active/cùng spa và tiền nguyên/tổng giới hạn. serviceInvoice bổ sung additionalProducts để gộp dịch vụ lẻ và sản phẩm; invoice có liệu trình vẫn gộp dịch vụ/sản phẩm như trước. Không hoa hồng sản phẩm; thẻ tiền bị chặn trên hóa đơn có productItems ở cả lúc tạo và dùng thẻ sau. PDF không lặp dòng tổng cho hóa đơn sản phẩm; kho mở đúng hóa đơn qua checkoutInvoiceId. Xóa sai sót theo quyền/quy trình hiện có bù kho cả phiếu invoiceId và checkoutInvoiceId; sửa/hủy từng dòng hóa đơn có sản phẩm chưa hỗ trợ để tránh lệch giá/kho.
- checkout {customerId,issuedOn?,actions:[{action,data}]} chỉ OWNER/cashier. Whitelist invoice/serviceInvoice/productInvoice (tối đa một hóa đơn phần đã làm/sản phẩm) và sellPackage (tối đa 30 gói mẫu khác nhau). Mỗi gói mới giữ hóa đơn/liệu trình riêng theo unique Treatment.invoiceId hiện hành để quản lý công nợ/hoa hồng/hoàn gói; không tự gộp công nợ hay đổi quy tắc 5%. Một lần lưu giỏ có thể sinh nhiều hóa đơn; UI nói rõ và chuyển tới danh sách khi có nhiều hóa đơn.
- Tất cả action của checkout cùng spa/khách, một phiên active, một Control transaction snapshot/majority, một khóa idempotency/fingerprint; thực thi/audit/notifications tuần tự, lỗi bất kỳ rollback toàn bộ (gồm xuất kho, gói/quà và buổi đã ghi trước lỗi). Retry không tạo trùng hóa đơn/gói/kho/thông báo. Audit con có checkoutKey digest; không ghi nét ký/mật khẩu vào log. Kết quả trả invoiceIds/invoices/total để đối chiếu giỏ. issuedOn chung vẫn không backdate tiền hoặc thực hiện.
Không thêm indexes, migration/backfill hoặc ghi dữ liệu vận hành trong phiên triển khai.
