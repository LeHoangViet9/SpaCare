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


## Thông báo — 23/10/2026 (PROPOSED kỹ thuật)
Notification: spaId, userId, appointmentId, title/body/url, readAt, pushState PENDING|SENT, nextAttemptAt, attempts, timestamps. Unique (spaId,userId,appointmentId); index (spaId,userId,createdAt desc) và (pushState,nextAttemptAt). Lưu cùng transaction booking. PushDevice: spaId/userId, endpoint, keys.p256dh/auth, timestamps; endpoint unique, index (spaId,userId). Endpoint/keys là dữ liệu nhạy cảm, không trả trong danh sách/log. allModels bổ sung hai collections/indexes, không reset/backfill. Xem PUSH_NOTIFICATIONS.md.


## User.phone — 23/10/2026
User thêm phone tùy chọn ở schema để giữ tài khoản legacy; actions tạo/sửa STAFF bắt buộc phone đã chuẩn hóa. Email ở schema trở thành tùy chọn; OWNER seed và CUSTOMER register vẫn yêu cầu email như cũ. Unique partial indexes user_phone_present {phone:1} với phone kiểu string và user_email_present {email:1} với email kiểu string. Chạy npm run db:staff-phone trước dùng bản mới trên DB cũ: tạo indexes thay thế thành công rồi mới gỡ unique email toàn bộ tài liệu cũ; không sửa/xóa tài khoản. Script chưa chạy trong phiên này; không dùng syncIndexes/dropDatabase. setup.ts cũng gọi migration này. Nếu tạo index lỗi, giữ index cũ và dừng, xử lý trùng thủ công có đối chiếu.


## Bỏ ô tham chiếu ảnh chuyển khoản — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: bỏ trường nhập tham chiếu ảnh chuyển khoản trong form thu tiền hóa đơn; không bắt ghi chú thay thế. Quy tắc này thay yêu cầu ghi tham chiếu/ghi chú ảnh khi thu chuyển khoản trước đây. Vẫn bắt xác nhận đã kiểm tra tài khoản và thực nhận tiền, giữ quyền, trạng thái ngày, transaction, idempotency và audit. PROPOSED kỹ thuật: paymentEvidence dùng chung chỉ kiểm tra receivedConfirmation; transferReference vẫn là trường tùy chọn trong API/schema và giữ toàn bộ dữ liệu lịch sử. Không thay quy trình xác nhận buổi liệu trình/chữ ký; tham chiếu chi lương riêng không thuộc thay đổi này.


## Trạng thái sổ hôm nay và mở sổ lặp — 23/10/2026
PROPOSED kỹ thuật theo yêu cầu sửa lỗi danh sách trống nhưng mở sổ báo đã tồn tại: GET workspace thêm todayDay cho OWNER/thu ngân, query trực tiếp cùng spa/ngày Việt Nam và độc lập bộ lọc/phân trang. Trang days không áp dụng từ khóa search vì không có ô tìm kiếm; vẫn giữ lọc trạng thái/khoảng ngày. UI hiển thị rõ hôm nay chưa mở/đang mở/đã chốt; đã mở không hiện nút tạo thêm, đã chốt chỉ OWNER có Mở lại với lý do. openDay trên sổ OPEN trả sổ hiện có, không đổi tiền đầu ngày, không tạo sổ thứ hai; sổ CLOSED trả 409 và không tự mở lại. Giữ transaction, idempotency và audit snapshot thực tế. Không thay chính sách ai được mở/chốt/mở lại hoặc ghi đè dữ liệu lịch sử.


## Xuất PDF hóa đơn và hoa hồng - 23/10/2026
CONFIRMED: PDF để tải, in hoặc chia sẻ hóa đơn khách hàng và bảng kê hoa hồng theo nhân viên/tháng trên máy tính và điện thoại.
PROPOSED kỹ thuật: API chỉ đọc từ phiên active và cùng spa. OWNER xem phạm vi spa; STAFF giữ quyền đọc hóa đơn hiện có, chỉ xuất hoa hồng của mình. Không ghi tài chính hoặc xác nhận thu tiền/chi lương. Bảng kê lấy toàn bộ tháng theo giờ Việt Nam, tách dịch vụ/bán gói, giữ điều chỉnh âm.
Không thêm schema/index; ExportDocument là DTO tạm thời, không lưu PDF vào database.
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


## BR-CARD-001 — Thẻ tiền mặt khách hàng — 24/10/2026
CONFIRMED theo yêu cầu người dùng: khách mua riêng thẻ (ví dụ 800.000đ), phải thực trả đủ mới phát hành/dùng; dùng cho dịch vụ lẻ (ví dụ 400.000đ còn 400.000đ), không dùng mua gói hoặc sản phẩm. Thiếu số dư được thu thêm tiền mặt/chuyển khoản. Cả thẻ mua và thẻ tặng không hết hạn, không hoàn hoặc đổi tiền mặt. Khi bán gói có thể tặng thẻ với mệnh giá nhập riêng (ví dụ gói 3.000.000đ tặng thẻ 800.000đ); thẻ tặng không làm tăng tiền thực thu. Không đồng nhất thẻ với tiền cọc.
PROPOSED kỹ thuật: OWNER/STAFF có cashier được bán thẻ và phát hành quà cùng sellPackage; nhập đợt khuyến mãi khi tặng. Quà phát hành ngay trong transaction bán gói; chưa chốt quy chế riêng cho gói chưa thu đủ hoặc ngừng/hoàn gói có quà thẻ, nên không tự suy cách thu hồi/đổi giá trị. Bản đầu chặn refundPackage và updateInvoice khi đã phát hành thẻ tặng, để tránh mất đối chiếu; cần spa quyết định workflow xử lý ngoại lệ trước khi hỗ trợ. Bán thẻ chưa sinh hoa hồng bán gói 5%; hoa hồng dịch vụ giữ quy tắc thực hiện hiện hành. Không tự chốt doanh thu kế toán BR-OPEN-006.
PROPOSED kỹ thuật: dùng thẻ theo quyền thu tiền hóa đơn hiện có (OWNER/thu ngân hoặc STAFF phụ trách lịch); cùng spa và cùng khách, chỉ SERVICE hoặc hóa đơn legacy có serviceId và không có liên kết liệu trình. Nhân viên chọn thẻ, số tiền trừ và phần thu thêm, xác nhận trước lưu; không tự trừ chỉ vì mở hóa đơn. Mỗi lần dùng yêu cầu sổ hôm nay đang mở, transaction snapshot/majority với Control guard + Idempotency + Audit. Không âm số dư, không trả vượt công nợ, không dùng thẻ người khác, không ghi CashEntry cho phần trừ thẻ. Quy trình chuyển thẻ, nạp thêm, đảo sử dụng và sửa sai tiền mua thẻ còn OPEN; không triển khai hoàn bằng reverseCash.

PROPOSED schemas bổ sung: CashCard {spaId,customerId,amount,balance,origin PURCHASE|GIFT,receiptId?,sourceInvoiceId?,promotion?,actorId,timestamps}; unique partial (spaId,receiptId), (spaId,sourceInvoiceId), index (spaId,customerId,createdAt desc). CashCardUse {spaId,cardId,customerId,invoiceId,amount,balanceBefore,balanceAfter,actorId,timestamps}, indexes (spaId,customerId,createdAt desc), (spaId,invoiceId), (spaId,cardId,createdAt desc). Ledger không sửa/xóa; không có expires/refund fields. Invoice.cardPaid là phần thanh toán bằng thẻ đã bao gồm trong paid; Invoice.giftCashCardAmount là snapshot mệnh giá quà trên lần bán gói. CashEntry.kind thêm CARD_SALE cho thu mua thẻ; Payment chỉ ghi phần tiền mới thực thu. Không backfill dữ liệu cũ.


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


## Optional appointment performer (2026-10-25)
CONFIRMED user request: appointment creation permits omitted staffId (unassigned); a supplied staffId must reference active OWNER/STAFF in the authenticated spa. Appointment.staffId is optional. CompleteAppointment and completeTreatmentAppointment accept optional staffId to assign an unassigned visit before recording performance, commission or signed treatment use, in the existing transaction with idempotency and audit. Existing assigned visits retain their performer. PROPOSED technical handling: unassigned visits remain visible/manageable to owner/cashier under existing scope; ordinary staff scope is unchanged. Rescheduling still requires an assigned performer.


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
