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
