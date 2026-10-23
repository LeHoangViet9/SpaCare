# SpaCare — Data Model

Cập nhật: 20/10/2026. Mô tả code `src/lib/models.ts` và `src/lib/operations.ts` hiện tại; không phải bằng chứng chính sách đã được spa duyệt.

## Quy ước

- MongoDB/Mongoose; `_id` là ObjectId. Tham chiếu cũng là ObjectId, không có foreign key tự động.
- Ngoại trừ Spa, LoginAttempt, Migration, các model bên dưới có `spaId: ObjectId` bắt buộc, `createdAt/updatedAt: Date`; strict schema, không có versionKey.
- Tiền: Number nguyên an toàn, không âm, tối đa 1.000.000.000.000 VNĐ. API yêu cầu khoản thu/chi/phân bổ lớn hơn 0.
- Number thời lượng tính phút; ngày sổ là chuỗi YYYY-MM-DD theo UTC+7; thời điểm là Date.
- Bảng ghi tên model; Mongoose tự suy tên collection. Nguồn chính xác cho trường/default/index là models.ts; không tự đặt index dựa trên tài liệu.

## Models

| Model | Trường chính và kiểu | Index khai báo ngoài _id |
|---|---|---|
| Spa | name: String; timezone: String, mặc định Asia/Ho_Chi_Minh | Không |
| User | name, email, passwordHash: String; role: OWNER/STAFF; cashier: Boolean=false; active: Boolean=true | email unique toàn hệ thống |
| Session | userId: ObjectId; tokenHash: String; expiresAt: Date | tokenHash unique; expiresAt TTL 0 |
| LoginAttempt | key: String; count: Number; expiresAt: Date; không có spaId/timestamps chung | key unique; expiresAt TTL 0 |
| Control | revision: Number=0 | spaId unique |
| Customer | name: String bắt buộc; phone, notes: String | spaId + phone, **không unique** |
| Service | name: String; price: tiền; duration: Number; active: Boolean=true | Không |
| Appointment | customerId, serviceId, staffId: ObjectId; startAt/endAt: Date; notes: String; status: CONFIRMED/COMPLETED/CANCELLED | spaId + staffId + startAt + endAt |
| Invoice | customerId: ObjectId; serviceId: ObjectId tùy chọn; description: String; total/paid: tiền; dueDate: String; status: OPEN/PARTIALLY_PAID/PAID | Không |
| Deposit | customerId: ObjectId; amount/balance: tiền; note: String; receiptId: ObjectId tùy chọn | Không |
| Allocation | depositId, invoiceId, approvedBy: ObjectId; amount: tiền; reason: String; reversed: Boolean=false | Không |
| Payment | invoiceId, receiptId: ObjectId; amount: tiền; reversed: Boolean=false | Không |
| CashEntry | amount: tiền; direction: IN/OUT; method: CASH/BANK_TRANSFER; kind: DEPOSIT/PAYMENT/INCOME/EXPENSE/REVERSAL; day/note: String; actorId: ObjectId; customerId/originalId: ObjectId tùy chọn; reversed: Boolean=false | spaId + day + method; spaId + originalId unique khi originalId tồn tại |
| Treatment | customerId, invoiceId: ObjectId; name: String; totalSessions/remaining: Number; status: ACTIVE/COMPLETED | spaId + invoiceId unique |
| TreatmentUse | treatmentId, actorId: ObjectId; method/reason/evidenceReference/snapshot/digest: String; performedAt: Date | Không |
| Day | day: String; opening: tiền; revision: Number=0; status: OPEN/CLOSED; expected/counted/difference/bankNet: Number; note: String; closedBy: ObjectId tùy chọn; closedAt: Date | spaId + day unique |
| Audit | actorId: ObjectId; action: String; targetId: ObjectId tùy chọn; details: Mixed | Không |
| Idempotency | userId: ObjectId; key/fingerprint: String; result: Mixed | spaId + key unique |
| Migration | version: Number; appliedAt: Date; không có spaId/timestamps chung | version unique |

## Quan hệ và snapshot

- Customer có nhiều Appointment, Invoice, Deposit, Treatment.
- Appointment tham chiếu Service và User (staff); giữ endAt tính khi đặt, sửa duration không tự đổi lịch cũ.
- Invoice giữ description/total từ Service lúc tạo; sửa danh mục không đổi snapshot hóa đơn.
- Deposit và Invoice liên kết nhiều-nhiều qua Allocation. Allocation tăng paid, giảm balance, không tạo khoản thu mới.
- Nhận Deposit tạo CashEntry; mỗi Payment tham chiếu CashEntry nhận tiền. CashEntry đảo tham chiếu originalId, giữ bản ghi gốc.
- Invoice có tối đa một Treatment qua unique index; Treatment có nhiều TreatmentUse.
- Use lưu snapshot JSON và digest cùng tham chiếu xác nhận; API chưa cho sửa/xóa. Digest không được coi là chữ ký số.
- Audit ghi actor/action/target/details, có snapshot chốt/mở lại; không lưu password trong details.

## Bất biến và giới hạn

`0 <= paid <= total`, `0 <= balance <= amount`, số buổi không âm. Operations kiểm tra tham chiếu cùng spa và quyền, cập nhật projection/sự kiện/audit/idempotency trong transaction có Control write guard. Cần MongoDB replica set/Atlas.

Email được trim/lowercase trong operations; unique index không tự chuẩn hóa dữ liệu nhập trực tiếp. Phone chuẩn hóa và kiểm tra trùng ở operations theo spa, **chưa có unique index**. Dữ liệu cũ trùng không được tự xóa/gộp; muốn thêm unique index phải đối chiếu, làm sạch và migration riêng.

Ngừng Service/User đặt active=false, không xóa document; lịch sử còn tham chiếu và hiển thị. Chặn ngừng nếu còn lịch CONFIRMED. Không có thao tác xóa Customer hiện tại.

Session TTL chỉ dọn dữ liệu; auth vẫn kiểm tra hạn và User.active. Không dựa riêng vào TTL để cấp quyền.

## Khởi tạo và thay đổi schema

`scripts/setup.ts` tạo collections/indexes, seed owner và ghi Migration. Không phải Flyway và không nhập SQL cũ. Thay index phải xét dữ liệu đang tồn tại; không tự chạy syncIndexes/xóa dữ liệu vận hành. Thay schema, validation hoặc quyền cần cập nhật tài liệu và kiểm thử liên quan.

## Cập nhật đổi lịch — 20/10/2026

Appointment.status bổ sung POSTPONED; changeReason: String lưu lý do thay đổi gần nhất. startAt/endAt ở lịch hoãn là giờ cũ để tham khảo, không giữ slot. Index hiện tại giữ nguyên, không cần migration dữ liệu cũ; khởi động lại app để nạp schema mới nếu Mongoose đang cache model.

Audit của appointmentStatus/rescheduleAppointment có details.before và details.after gồm giờ, nhân viên, trạng thái trước/sau. Giữ lịch sử nhiều lần đổi trong Audit; changeReason chỉ là giá trị gần nhất. Reschedule giữ độ dài khoảng endAt-startAt cũ. Tổng lịch hôm nay chỉ tính CONFIRMED/COMPLETED, không tính POSTPONED/CANCELLED.

## Liên kết Invoice–Appointment — 20/10/2026

Invoice bổ sung appointmentId: ObjectId tùy chọn. Index {spaId:1, appointmentId:1}, unique=true, partialFilterExpression={appointmentId:{$exists:true}}. Một lịch tối đa một hóa đơn liên kết; hóa đơn không có lịch vẫn hợp lệ. Không thêm appointment.invoiceId để tránh hai nguồn liên kết khác nhau; UI tra Invoice.appointmentId.

completeAppointment ghi Invoice và Appointment.COMPLETED trong transaction cùng Audit/Idempotency. Kết quả có invoiceId; audit có before/after của lịch và invoiceId. Invoice giữ snapshot giá/tên lúc tạo; liên kết hóa đơn cũ giữ total/paid/status. Không tạo CashEntry/Payment/Allocation/TreatmentUse.

Triển khai trên database có sẵn: khởi động lại app để nạp model mới, chạy npm run db:setup để tạo index bổ sung. Setup không đặt lại mật khẩu hay xóa lịch sử; giữ đúng SEED_OWNER_EMAIL cũ tránh seed thêm spa ngoài ý muốn. Chưa chạy setup trên database vận hành trong phiên này. Các invoice cũ không có appointmentId không cần sửa; không tự backfill. Nếu đã có appointmentId trùng hoặc null do nhập tay, đối chiếu trước khi tạo index; không tự xóa dữ liệu.

## Lịch gói và trạng thái thanh toán — 20/10/2026

- Appointment.treatmentId: ObjectId tùy chọn; không có nghĩa là một buổi đã được sử dụng. Lịch không có treatmentId là dịch vụ lẻ.
- Treatment.serviceId: ObjectId tùy chọn cho dữ liệu cũ; khi tạo mới lấy từ invoice. Workspace bổ sung serviceId của gói cũ bằng truy vấn hóa đơn cùng spa nhưng không trả dữ liệu tài chính cho STAFF.
- TreatmentUse.appointmentId: ObjectId tùy chọn; unique partial index {spaId:1,appointmentId:1} khi trường tồn tại. Một lịch chỉ có tối đa một Use; Use thủ công không liên kết lịch vẫn được giữ cho lượt ghi độc lập.
- completeTreatmentAppointment dùng cùng logic xác nhận, snapshot/digest như action use; transaction ghi Use, giảm remaining và hoàn thành Appointment, audit chỉ giữ mã Use và snapshot lịch, không lặp nội dung bằng chứng.
- Invoice.status bổ sung PARTIALLY_PAID; invoiceState(total,paid) là nguồn tính trạng thái cho cập nhật tiền và response workspace. Invoice cũ status=OPEN nhưng paid>0 được hiển thị PARTIALLY_PAID, không tự sửa database khi GET.
- Biến BANK_NAME/BANK_ACCOUNT_NUMBER/BANK_ACCOUNT_NAME/BANK_QR_IMAGE_PATH chỉ là thông tin nhận tiền, không lưu khóa ngân hàng. Ảnh QR đặt dưới public, đường dẫn cùng website (không URL bên thứ ba); QR tĩnh không tự điền số tiền hoặc nội dung hóa đơn.
- Khởi động lại app và chạy db:setup với seed cũ để tạo index bổ sung; không cần xóa/backfill dữ liệu cũ. Không tự gắn gói cho các lịch cũ vì không biết ý định mua lẻ hay dùng gói.

## Dữ liệu demo

scripts/seed-demo.ts tạo fixture tổng hợp chỉ trong spacare_demo, toàn bộ fixture trong một transaction, có marker Idempotency để bỏ qua khi chạy lại. Không có reset/drop/delete hay ghi đè mật khẩu; ngày mẫu neo vào lần seed thành công đầu tiên. Dữ liệu tổng hợp không thay nghiệm thu operations. scripts/dev-demo.ts đặt env demo trước khi Next đọc .env.local, cố định port 3000. Xem DEMO_DATABASE.md.

## Thay đổi kế hoạch — 21/10/2026

Các trường và action dưới đây **chưa có trong code**; được ghi để theo dõi yêu cầu đã xác nhận và thiết kế kế hoạch.

### Treatment — trường bổ sung dự kiến
- `expiresAt: Date` (ngày hết hạn gói) — đã biết khoảng thời hạn theo loại dịch vụ (mặt 1–2 năm, triệt lông 2–5 năm theo BR-PKG-003); cần xác định thời hạn cụ thể từng gói (BR-OPEN-002) và thời điểm bắt đầu tính từ ngày mua hay ngày dùng đầu tiên (BR-OPEN-009).
- `paymentDueDate: String YYYY-MM-DD` (hạn thanh toán gói) — đã biết khách có thể dùng gói trước và trả trong 1–2 tuần (BR-PKG-002); cần xác định số ngày chính xác và thời điểm bắt đầu tính (BR-OPEN-010).
- `pausedUntil: Date` (bảo lưu đến ngày) — spa có thể cho bảo lưu nếu có lý do hợp lý (BR-PKG-004); cần tiêu chí lý do hợp lý và người có quyền duyệt bảo lưu (BR-OPEN-002).
- Khi bổ sung cần cập nhật schema, index nếu có, và chạy db:setup. Dữ liệu gói cũ không tự backfill.

### Action `sellPackage` — dự kiến (chưa thiết kế chính thức)
Tạo Invoice và Treatment trong cùng transaction; không yêu cầu tạo hóa đơn trước. Tên action, payload và phân quyền chưa chốt (BR-PKG-001). Action hiện tại `invoice` rồi `treatment` riêng vẫn giữ cho dữ liệu cũ. Việc nhân viên có được lập hóa đơn dịch vụ độc lập không gắn với lịch hẹn hay không vẫn đang mở (BR-OPEN-001).

### Phân quyền `payment` và `allocate` — mở rộng dự kiến
Theo BR-ACCESS-002: nhân viên phục vụ (được phân công trên lịch hẹn) sẽ được gọi `payment` và `allocate` cho hóa đơn liên quan. Cách xác định “nhân viên phụ trách” trong code (tra lịch hẹn có cùng customerId, sói kiểm tra phạm vi) chưa thiết kế. Code hiện tại: `payment` yêu cầu OWNER/cashier; `allocate` chỉ OWNER.

### Lịch hẹn — luồng xếp lại sau hoãn
Theo BR-TECH-008 cập nhật: khi xếp lại lịch hoãn cần tạo Appointment mới (CONFIRMED) thay vì cập nhận bản ghi POSTPONED cũ. Bản ghi POSTPONED giữ nguyên làm lịch sử. Không thêm trường liên kết giữa POSTPONED và lịch mới nếu chưa có yêu cầu tra cứu chéo.

### Xác nhận buổi liệu trình (TreatmentUse)
Nhân viên cho khách xác nhận buổi liệu trình trên app (BR-TRT-001). Khi không thể xác nhận trên app, phương án thay thế còn mở (BR-OPEN-003); chưa được tự kết luận ảnh chụp gửi nhóm chat là đủ điều kiện làm bằng chứng thay thế.


## Cập nhật ưu tiên theo yêu cầu mới nhất — 21/10/2026

Menu phân cấp có thể thu gọn/mở rộng, dùng chung cấu hình cây trên desktop và mobile. Tổng quan tại `/`; mỗi mục hoạt động mở trang riêng `/workspace/{section}`, hỗ trợ tải lại và Back/Forward. Server kiểm tra phiên và quyền: services/staff/audit chỉ OWNER, days/reports OWNER hoặc thu ngân. Không thay đổi quyền ghi tài chính hay phạm vi dữ liệu API workspace.

Yêu cầu này thay thế mô tả trước về trang Lương/Hoa hồng hiển thị sản lượng: chỉ tạo trang hoạt động khi nghiệp vụ được xác định. Hiện hai mục chỉ ghi “Chưa triển khai”, không liên kết, không có trang hoạt động, schema hoặc API lương/hoa hồng. Không tạo kỳ lương giả hay suy ra hoa hồng từ người ghi buổi. Khi triển khai: backend lấy spaId/actorId từ phiên, STAFF chỉ xem của mình, OWNER xem toàn spa. BR-OPEN-011 (công thức/thời điểm hoa hồng), BR-OPEN-012 (quyền quản lý xem nhân viên khác), BR-OPEN-013 (quy chế và kỳ lương) giữ OPEN. Cấu hình route là thiết kế kỹ thuật; không chốt thêm chính sách tài chính.


## Schema và phạm vi dữ liệu vận hành — 21/10/2026
- Appointment.rescheduledFromId: ObjectId tùy chọn, chỉ gắn cho lịch mới được xếp lại từ POSTPONED. Unique partial index {spaId:1,rescheduledFromId:1} khi trường tồn tại ngăn một lịch hoãn tạo nhiều lịch kế tiếp. Giữ customerId/serviceId/treatmentId/notes và thời lượng lịch cũ; không sửa startAt/endAt/status của lịch cũ khi xếp lại. Lịch CONFIRMED dời giờ vẫn cập nhật tại chỗ như trước.
- sellPackage tạo Invoice (description snapshot tên gói và dịch vụ, total giá bán toàn gói, paid=0, dueDate bắt buộc) và Treatment (invoiceId, customerId, serviceId, name, totalSessions, remaining=totalSessions) cùng transaction. Không thêm hạn trùng lặp trên Treatment: nguồn duy nhất là Invoice.dueDate.
- Payment.transferReference: String tùy chọn, receivedConfirmation: Boolean cho giao dịch mới. CashEntry.transferReference: String tùy chọn để tra sổ. BANK_TRANSFER yêu cầu ghi chú hoặc tham chiếu ảnh đã gửi nhóm; không tải ảnh/base64 hoặc tự xác minh ngân hàng. Audit lưu actor, dữ liệu yêu cầu và liên kết; receivedConfirmation luôn true cho payment mới.
- Allocation.approvedBy giờ có thể là nhân viên được phân công đã thực hiện; không còn hàm ý luôn OWNER. Số dư chỉ giảm đúng số phân bổ; không tạo CashEntry.
- Workspace STAFF thông thường trả các hóa đơn gắn lịch CONFIRMED/COMPLETED của mình (bao gồm hóa đơn gói), cọc của khách các hóa đơn đó và phân bổ cho các hóa đơn đó. Truy vấn quyền không phụ thuộc giới hạn hiển thị 500. canAllocate được server tính cho từng invoice; backend vẫn kiểm tra lại khi ghi. OWNER/thu ngân giữ phạm vi đọc tài chính hiện có. Gói trả thêm paymentDueDate/paymentOverdue từ Invoice, không tự đổi dữ liệu.
Triển khai: khởi động lại app để nạp schema; chạy db:setup trên đúng database cấu hình để tạo index bổ sung sau khi đối chiếu dữ liệu. Không chạy setup lên dữ liệu vận hành trong phiên sửa code. Không xóa/backfill lịch cũ, không ghi đè hạn thanh toán gói cũ.

Sổ thu chi của STAFF thông thường chỉ trả CashEntry có actorId là user phiên hiện tại; không trả dòng tiền toàn spa.


## Schema ký buổi và bảo lưu — 21/10/2026
- Treatment.status thêm PAUSED. holdUntil YYYY-MM-DD, holdReason, heldAt/heldBy ghi lần duyệt/gia hạn gần nhất; resumedAt/resumedBy ghi mở lại; expiresOn tùy chọn lưu ngày sử dụng mới do OWNER duyệt khi mở lại. remaining không đổi bởi các action này. Audit giữ before/after và lý do cho toàn lịch sử các lần bảo lưu/mở lại. Không backfill hạn cho gói cũ; không tự đổi trạng thái theo thời gian.
- TreatmentUse mới: method=DRAWN_SIGNATURE; signature={version:1,strokes:Array<Array<[x,y]>>}, tọa độ chuẩn hóa0..1, tối đa30nét/1000điểm, ít nhất3điểm và có độ dài nét. signature mặc định select:false. signatureDigest SHA-256; sessionNumber; customerId/staffId; snapshot gồm tên khách/gói/người thực hiện, actor, số buổi trước khi ghi, số thứ tự buổi, performedAt và signatureDigest; digest băm snapshot. appointmentId giữ unique partial index cũ.
- Ghi Use, giảm remaining, cập nhật lịch nếu có, Audit và Idempotency cùng transaction. Không ghi bản sao nét ký vào audit/list response. Bản ghi cũ giữ method/reference/snapshot cũ; không migration dữ liệu, không giả tạo chữ ký. Khởi động lại app để nạp schema mới; không cần index mới cho thay đổi này.


## Đọc khách hàng theo trang - 22/10/2026

Không đổi Customer schema/index hay dữ liệu. Endpoint đọc phân trang dùng spaId từ session, sắp createdAt/_id giảm dần để thứ tự ổn định khi cùng thời điểm tạo. Tìm kiếm regex đã escape từ chuỗi literal tối đa 100 ký tự. Count đếm toàn bộ kết quả cùng scope, không đếm trên preview 500 khách. Thiết kế kỹ thuật PROPOSED; đánh giá thêm index theo truy vấn thực tế khi số khách tăng.


## Đọc workspace theo trang - 22/10/2026

Không đổi schema/index. Thay các truy vấn history limit 500 bằng count + skip/limit theo trang; mỗi truy vấn giữ spaId từ session, kèm phạm vi người dùng khi cần. Sắp createdAt/_id giảm dần, lịch sắp startAt/_id. Nạp tham chiếu của trang và các lựa chọn danh mục, hóa đơn còn nợ, cọc còn dư, gói còn dùng được; không nạp toàn bộ lịch sử để phân trang trên điện thoại. Phạm vi cọc/phân bổ STAFF dựa trên toàn bộ hóa đơn được phép, không dựa trên trang hiện tại. Báo cáo group CashEntry theo ngày ở DB trên toàn khoảng lọc; tổng quan/metric không phụ thuộc trang. Audit loại chữ ký, snapshot/digest buổi khỏi list uses. Thiết kế đọc là PROPOSED kỹ thuật.


## Schema thương mại — 22/10/2026
- PackageTemplate (mới, cùng spa/timestamps): name, serviceId, totalSessions 1..1000, price, active. OWNER tạo/sửa/ngừng bán; không xóa cứng hay sửa gói đã gán.
- Customer.consultantId tùy chọn tham chiếu User cùng spa, active khi gán.
- Service.commission: tiền cố định không âm, default0. Invoice.commission tùy chọn snapshot cấu hình, không phải khoản hoa hồng đã được hưởng/trả.
- Invoice thêm createdBy/creatorName, consultantId/consultantName, kind SERVICE/PACKAGE/SESSION/GIFT, promotion, giftOfInvoiceId, treatmentId/treatmentUseId. Các trường mới tùy chọn để giữ hóa đơn cũ. Unique partial {spaId,treatmentUseId} khi treatmentUseId tồn tại; giữ unique appointmentId. Không backfill người tạo/chữ ký hay tạo hóa đơn 0đ cho lịch sử cũ tự động.
- Treatment thêm templateId, giftOfInvoiceId, promotion; giữ một hóa đơn mua riêng mỗi gói qua unique invoiceId hiện có. SESSION invoice tham chiếu Treatment/Use, không tạo Treatment thứ hai.
- Một sale transaction ghi hóa đơn mua + gói chính + từng hóa đơn/gói tặng + audit/idempotency. Mỗi buổi mới ghi Use + invoice0 + trừ buổi + lịch nếu có trong transaction. Không Promise.all ghi trong transaction.
- GET chi tiết mới không trả nét ký nếu không có quyền; không ghi signature vào audit. Lịch sử khách phân trang10, scope từ phiên.
Triển khai: khởi động lại ứng dụng để nạp schema. Chạy db:setup để tạo collection/index bổ sung trên database được cấu hình sau khi đối chiếu; không syncIndexes/drop/backfill, không chạy trên dữ liệu vận hành trong phiên này. Giữ đúng cấu hình seed owner cũ. Chưa thực thi migration trên production.


## Nhóm dịch vụ và dữ liệu tra cứu — 22/10/2026
Service.category: String tùy chọn, backend trim/max100; dữ liệu cũ không nhóm vẫn giữ, không backfill. Không thêm indexes trong thay đổi này; khởi động lại để nạp schema mới. Nhóm gói là nhóm Service liên kết, không thêm nguồn category thứ hai vào PackageTemplate.
Các bộ lọc workspace và số liệu hồ sơ không ghi thêm document. CashEntry.aggregate đếm toàn bộ tập đã lọc cùng scope; ép ObjectId qua cast model trước aggregate. Customer listing tra lastVisit COMPLETED và nextVisit CONFIRMED theo lô trên khách của trang và quyền lịch. Hồ sơ nhân viên không trả password/session. Không xóa hoặc cập nhật lịch sử khi đổi bố cục.


## Schema lương và hoa hồng — 22/10/2026
- User.baseSalary tùy chọn, tiền nguyên không âm, select:false. Chỉ endpoint payroll riêng được select thêm, owner toàn spa/staff chính mình. Workspace/staff/auth không trả lương cơ bản.
- Commission mới: spaId, staffId/staffName, serviceId/serviceName, customerId, invoiceId; sourceType APPOINTMENT|TREATMENT_USE|INVOICE và sourceId; amount snapshot, earnedAt; payrollId tùy chọn chỉ gắn khi duyệt. Unique {spaId,sourceType,sourceId}; unique {spaId,invoiceId}; index {spaId,staffId,earnedAt:-1}. Snapshot tiền không sửa; không xóa, không tự backfill.
- Payroll mới: staffId/staffName, month YYYY-MM, baseSalary, commissionTotal/count, carryoverCount, commissionIds; bonus,deductions,total,note; status DRAFT|APPROVED|PAID; approvedBy/At,paidBy/At,receiptId. Unique {spaId,staffId,month}. Danh sách API không trả commissionIds. Các lần đổi/duyệt/chi có before/after tài chính trong Audit, nguồn Commission giữ liên kết payrollId.
- Invoice.performedBy/performedAt cho thực hiện dịch vụ, không phải người tạo hoặc tư vấn. Ca lịch gói Commission lấy Use làm source duy nhất, các invoice SESSION vẫn0đ. Ghi Commission, snapshot người thực hiện, Use/lịch, Audit và Idempotency cùng transaction.
- CashEntry.kind thêm PAYROLL, payrollId/employeeId tùy chọn. Unique partial {spaId,payrollId} khi payrollId tồn tại. Payroll.receiptId trỏ phiếu OUT thực chi. Không tự chuyển khoản ngân hàng hoặc dùng payment khách để trả lương.
- Duyệt chọn/gắn Commission và khóa Payroll cùng transaction/Control guard; ghi chi cập nhật Payroll + CashEntry + Audit/Idempotency cùng transaction, không ghi song song. Đọc aggregate cast ObjectId đúng spa/người dùng.
Triển khai: khởi động lại để nạp schema, chạy db:setup đúng database để tạo collections/indexes mới sau khi đối chiếu, giữ seed owner cũ. Không syncIndexes/drop/backfill hay chạy setup lên database vận hành trong phiên này.


## Cài hoa hồng theo dịch vụ — 22/10/2026
Không thêm schema. Nút Tạo hoa hồng cập nhật Service.commission hiện có; mỗi dịch vụ một mức, không tạo bản ghi Commission thu nhập trước khi thực hiện. Commission.amount và Invoice.commission đã snapshot không bị cập nhật theo cấu hình.

## Dung tích sản phẩm - 22/10/2026
Product thêm `sizeMl: Number` (số nguyên 1..100000) để lưu dung tích một sản phẩm. Form danh mục bắt buộc nhập dung tích ml; `unit` vẫn giữ trong Product/Invoice/StockMovement cho các bản ghi cũ và phiếu kho, sản phẩm mới dùng đơn vị tồn mặc định `Sản phẩm`. Không đổi stock, giá, lịch sử hóa đơn hay phiếu kho. Dữ liệu Product cũ có thể chưa có sizeMl; không backfill giá trị suy đoán.

## Cổng thông tin công khai và tài khoản khách hàng - 22/10/2026
- `User.role` mở rộng enum: `['OWNER', 'STAFF', 'CUSTOMER']`.
- `User.customerId: optionalId` liên kết tùy chọn với tài liệu `Customer` cùng spa.
- Tách bạch dữ liệu công khai: API và Server Component công khai chỉ chiếu các trường `_id`, `name`, `category`, `price`, `duration` của `Service`, tuyệt đối không trả trường nội bộ `commission`.
- Luồng đặt lịch công khai: tạo `Customer` (nếu chưa có) và ghi nhận `Appointment` trạng thái `CONFIRMED` gán nhân viên phục vụ không bị trùng ca.
- Tài khoản CUSTOMER chỉ được xem dữ liệu của chính mình (lịch hẹn, gói liệu trình, hóa đơn) theo `customerId` gắn với tài khoản. Không có quyền truy cập không gian làm việc hoặc các API quản trị nội bộ.

## Đặt lịch web chống trùng - 23/10/2026
Không thêm schema. Public booking dùng Control.revision cùng spa để tuần tự hóa với operations. Customer, Appointment, Audit, Idempotency được ghi tuần tự cùng transaction. Idempotency.key dùng UUID, fingerprint gồm payload chuẩn hóa và ID phiên nếu có. PROPOSED: với khách chưa đăng nhập, Audit.actorId/Idempotency.userId tham chiếu Customer; Audit.details.actorKind=GUEST_CUSTOMER phân biệt với USER. Không suy ra khách vãng lai là nhân viên. Tài khoản đăng nhập được nạp lại active và kiểm tra Customer cùng spa.

## Đơn giản phiếu kho - 23/10/2026
StockMovement.reason giữ kiểu String và lịch sử cũ; phiếu thủ công mới có thể lưu chuỗi rỗng khi không gửi lý do. Không thêm schema hay thay đổi số lượng, snapshot hoặc audit hiện có.

## Ảnh và danh mục sản phẩm công khai - 23/10/2026
PROPOSED kỹ thuật: GridFS bucket product_images gồm product_images.files/chunks, metadata {kind:PRODUCT_IMAGE,spaId,uploadedBy,contentType}. Product.imageUrl dùng /api/product-images/{ObjectId}; backend kiểm tra file cùng spa khi tạo/sửa sản phẩm trong transaction hiện có. Không lưu blob vào Product, không dùng filesystem tạm. Ảnh cũ và ảnh đã tải nhưng chưa gắn vẫn giữ; chưa có cơ chế tự dọn ảnh. Xóa ảnh khỏi form chỉ bỏ tham chiếu khi lưu sản phẩm, không xóa file lịch sử.


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

Schema: User.salaryPolicy select:false; Invoice.sellerId/sellerName/saleCommissionVersion/saleCommissionAccrued/refunded; SaleCommission(spaId,staffId,staffName,serviceId,serviceName,invoiceId,customerId,sourceType,sourceId,amount có thể âm,earnedAt,payrollId); Workday(spaId,staffId,day,period,note,actorId), unique spa/staff/day. StaffLeave giữ day cũ và thêm startDay/endDay/period/paid/status/reviewedBy/reviewedAt. Payroll thêm earnedBase/leaveDeduction/workdays/leaveStats/salaryPolicy/attendanceDigest/attendanceConfirmed/advance/serviceCommissionTotal/saleCommissionTotal/saleCommissionIds, commissionTotal cho phép âm còn total không âm.
Chạy db:setup có kiểm soát khi triển khai để tạo collections/indexes mới. Nó tạo index nghỉ spa/staff/day/period rồi chỉ bỏ unique index cũ chính xác spa/staff/day, không xóa/chỉnh document. Interval uniqueness do Control transaction bảo vệ, để vẫn nộp lại bản từng bị từ chối. Không tự chạy migration lên dữ liệu vận hành trong phiên phát triển. Commission unique invoice cũ giữ nguyên; không có backfill tiền hoặc nhân sự.
