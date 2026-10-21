# API nội bộ

API dùng cookie session cùng origin. Phải đăng nhập, không chấp nhận `spaId` hay `actorId` do client gửi để quyết định quyền.

| Endpoint | Nội dung |
|---|---|
| POST /api/auth/login | `{email,password}` → set cookie |
| POST /api/auth/logout | Thu hồi session hiện tại |
| GET /api/workspace | Dữ liệu theo spa/quyền, tối đa 500 mỗi danh sách; số tổng quan aggregate toàn bộ |
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
