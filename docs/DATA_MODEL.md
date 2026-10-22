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
