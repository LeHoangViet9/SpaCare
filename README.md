# SpaCare — Next.js + MongoDB

Bộ source MVP mới, chuyển thiết kế từ BRD SpaCare v1.1 sang Next.js App Router + TypeScript + Mongoose. Đây không phải bản chuyển tự động mã Spring Boot: đầu vào chỉ có BRD và README migration, chưa có source V1 hoặc dữ liệu PostgreSQL.

## Chạy trên Windows

Cần Node.js 24, npm và Docker Desktop. Giao diện dùng CSS thuần, không phụ thuộc font từ Internet.

```powershell
Copy-Item .env.example .env.local
```

Điền `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` (ít nhất 12 ký tự) trong `.env.local`. Không dùng thông tin đăng nhập cá nhân ở dịch vụ khác.

```powershell
npm install
docker compose up -d
docker compose logs mongo-init
docker compose exec mongo mongosh --quiet --eval "rs.status().ok"
```

Kết quả replica set phải là `1`. Nếu vừa khởi tạo, chờ bầu primary rồi kiểm tra lại. MongoDB chỉ publish cổng trên `127.0.0.1`; compose này dành cho phát triển, chưa bật xác thực cơ sở dữ liệu.

```powershell
npm run db:setup
npm run dev
```

Mở http://localhost:3000 và đăng nhập bằng tài khoản đã đặt trong `.env.local`.

Nếu dùng Atlas, thay `MONGODB_URI` bằng URI được Atlas cấp và cấu hình network access. Ứng dụng dùng transaction nhiều document nên cần replica set hoặc Atlas, không dùng MongoDB standalone.

## Quy trình thử đầu tiên

1. Chủ spa tạo dịch vụ, khách hàng và tài khoản nhân viên. Tick quyền thu ngân nếu cần.
2. Mở sổ hôm nay, nhập tiền mặt đầu ngày thực tế.
3. Đặt lịch theo dịch vụ và nhân viên; thời lượng lấy từ dịch vụ. Lịch giao nhau của cùng nhân viên bị từ chối, hai lịch nối tiếp được phép.
4. Nhận cọc 500.000đ; tạo hóa đơn dịch vụ 350.000đ; chủ spa phân bổ cọc 350.000đ. Cọc còn 150.000đ và sổ chỉ ghi thu 500.000đ.
5. Với hóa đơn trả sau, chọn **Thu tiền** để giảm công nợ. Không ghi tiền này vào **Thu khác**.
6. Với gói nhiều buổi, tạo gói từ hóa đơn. Khi thực hiện, ghi một buổi cùng tham chiếu phiếu giấy/bằng chứng; xác nhận thay thế phải có lý do.
7. Cuối ngày đếm tiền mặt, chốt sổ và xem chênh lệch. Chủ spa mở lại với lý do khi cần.

## Đã có trong source

- Đăng nhập session cookie HttpOnly 8 giờ; scrypt + salt; giới hạn số lần đăng nhập theo email và khoảng 15 phút; kiểm tra Origin cho request ghi.
- OWNER/STAFF, quyền `cashier` riêng. Kiểm tra quyền tại backend; mọi dữ liệu vận hành truy vấn theo `spaId`.
- Tạo và tìm khách, tạo dịch vụ, tạo nhân viên; đặt lịch, hoàn thành/hủy lịch.
- Hóa đơn một dịch vụ, hạn nợ, thu từng phần; tiền nguyên VNĐ.
- Nhận cọc, chủ spa phê duyệt phân bổ, giữ dư; đảo phân bổ và đảo giao dịch sai giữ lịch sử.
- Liệu trình nhiều buổi; ghi buổi và tham chiếu bằng chứng cùng transaction; snapshot/digest bất biến qua API hiện tại.
- Sổ thu chi, mở/chốt/mở lại ngày; báo cáo dòng tiền, công nợ, cọc còn lại; audit.
- Idempotency cho mọi mutation; cùng key + cùng payload trả lại kết quả, payload khác bị từ chối. Client giữ key khi lỗi mạng và thử lại cùng nội dung trong phiên hiện tại.

## Phạm vi và giới hạn

- Thanh toán là ghi nhận **tiền mặt/chuyển khoản thủ công**. Chưa có cổng thanh toán, QR động, webhook, đối soát sao kê hoặc xác minh ngân hàng.
- Chưa tải ảnh, thu chữ ký điện tử hoặc lưu tệp bằng chứng. Chỉ lưu mã tham chiếu; không nhập URL công khai chứa dữ liệu cá nhân. Cách xác nhận thay thế phải được spa duyệt trước pilot.
- Chưa có thao tác đóng/bảo lưu liệu trình, tự động hoàn tiền, hết hạn cọc, no-show, phòng/giường, ca làm hoặc đặt lịch công khai. Không đặt giả định thành chính sách đã chốt.
- Một hóa đơn chứa một dịch vụ; một hóa đơn liên kết tối đa một gói. Tạo nhiều hóa đơn nếu cần nhiều dịch vụ/gói.
- Tạo danh mục và nhân viên; chưa làm sửa/xóa danh mục, reset mật khẩu hay khóa tài khoản trên UI. Chưa có phân trang; danh sách và báo cáo khoảng ngày đọc 500 bản ghi gần nhất, có ghi rõ trên màn hình. Tổng quan công nợ/cọc và thực thu hôm nay tổng hợp toàn bộ.
- Biểu đồ là **dòng tiền**, chưa được coi là doanh thu kế toán. Ngày dùng múi giờ Việt Nam; chưa cấu hình múi giờ khác.
- Số dư đầu ngày nhập thủ công; không tự lấy lại từ sổ hôm trước. Mở lại ngày cũ không cho phép backdate giao dịch: sửa sai tạo bút toán ngày hiện tại. Các số chốt trước đó còn trong audit.
- Đảo sai sót kế toán khác quy trình hoàn tiền khách; chưa có workflow hoàn tiền/ngoại lệ. Không dùng nút đảo để xử lý hoàn tiền chưa được phê duyệt.
- Chưa nhập dữ liệu Spring Boot/PostgreSQL, chưa thay đổi database cũ. `db:setup` chỉ tạo cấu trúc MongoDB và seed ban đầu.
- Chạy thử nội bộ trước; chưa có kiểm tra đồng thời trên MongoDB thật, kiểm tra phục hồi backup, rà soát bảo mật vận hành hoặc pilot 14 ngày.

## Cấu trúc

```text
src/app/                 Trang chính, giao diện và Route Handlers
src/components/          Giao diện quản trị responsive
src/lib/models.ts        Schemas/indexes MongoDB
src/lib/operations.ts    Use cases, transaction, phân quyền, audit
src/lib/rules.ts         Các quy tắc tính tiền/ngày/xác nhận
src/lib/auth.ts          Session cookie, kiểm tra Origin
scripts/setup.ts         Khởi tạo collections/indexes/owner
tests/                   Kiểm thử thuần chạy không cần MongoDB
docs/                    Thiết kế chuyển đổi, API, checklist pilot
```

## Kiểm tra và build

```powershell
npm test
npm run typecheck
npm run build
npm start
```

`npm test` chỉ kiểm tra quy tắc thuần và password; không chứng minh transaction/permission hoạt động trên database. Xem `docs/VALIDATION.md` cho trạng thái kiểm tra thực tế và các ca integration phải chạy.

Trong môi trường tạo source, npm không phân giải được `registry.npmjs.org`, nên chưa cài được dependencies và chưa chạy được build/typecheck hoặc trình duyệt. Vì vậy chưa có lockfile. Khi có Internet, chạy `npm install`, giữ `package-lock.json` tạo ra và thực hiện các bước kiểm tra trên trước triển khai.

Để deploy, dùng môi trường Node.js chạy Next.js và MongoDB Atlas/replica set; cấu hình `APP_ORIGIN` đúng HTTPS origin và giữ bí mật `MONGODB_URI`. Bản chạy production dùng cookie Secure, cần truy cập HTTPS. Không đóng gói `.env.local` vào source công khai.

## Tài liệu kỹ thuật tham chiếu

- https://nextjs.org/docs/app/api-reference/file-conventions/route
- https://nextjs.org/docs/app/api-reference/functions/cookies
- https://mongoosejs.com/docs/transactions.html
- https://www.mongodb.com/docs/manual/core/transactions/

## Tài liệu và chức năng cập nhật 20/10/2026

Trước khi sửa nghiệp vụ, đọc `AGENTS.md`, `docs/BRD.md`, `docs/BUSINESS_RULES.md` và `docs/DATA_MODEL.md`. Các cập nhật trong mục này thay thế mô tả cũ mâu thuẫn ở trên.

Đã bổ sung sửa khách hàng/dịch vụ/nhân viên, ngừng hoạt động/mở lại dịch vụ và STAFF; chưa có xóa khách hoặc reset mật khẩu. Có kiểm tra trùng email/SĐT ở backend và chuẩn hóa định danh. Ngừng hoạt động giữ lịch sử, chặn khi còn lịch CONFIRMED.

Dependencies đã được cài và package-lock.json đã có. Typecheck đạt, 8/8 test thuần đạt; build và MongoDB integration còn bị chặn quyền môi trường. Xem `docs/VALIDATION.md`.

## Hướng dẫn test theo SWT

Xem [TESTING.md](docs/TESTING.md): công cụ, chuẩn bị môi trường, luồng test từng bước, Postman, unit/integration, kỹ thuật thiết kế test, test cases và mẫu báo lỗi/kết quả.

Cập nhật lịch–hóa đơn: OWNER/thu ngân có nút **Hoàn thành & lập hóa đơn**; chọn hóa đơn cũ nếu đã lập hoặc để trống tạo mới. Sau xác nhận chuyển sang hóa đơn để thu tiền riêng. STAFF thường chỉ hoàn thành lịch; chủ spa/thu ngân có thể lập/liên kết sau. Cần khởi động lại app và chạy `npm run db:setup` với cấu hình seed hiện có để tạo unique index liên kết, không xóa dữ liệu cũ. Xem BR-APT-002 và mục 14 của docs/TESTING.md.

## Dùng gói khi đặt lịch và nhận tiền

Chọn khách + dịch vụ khi đặt lịch: gói phù hợp còn buổi được gợi ý. Chọn gói để dùng buổi đã mua hoặc để trống mua dịch vụ lẻ. Hoàn thành gói cần mã phiếu/xác nhận, giảm đúng một buổi; không tạo hóa đơn mới. Gói đã hết tại lúc hoàn thành sẽ báo lỗi để đối chiếu, không tự tính phí dịch vụ lẻ.

Ở hóa đơn có trạng thái Chưa thanh toán / Thanh toán một phần / Đã thanh toán và nút Tiền mặt / Chuyển khoản–QR. Chỉ xác nhận sau khi nhận tiền thật. Chuyển khoản hiện đối chiếu thủ công, không tự xác minh ngân hàng.

Để hiện thông tin ngân hàng, thêm BANK_NAME, BANK_ACCOUNT_NUMBER, BANK_ACCOUNT_NAME vào .env.local. Nếu có ảnh QR chính thức của tài khoản spa, đặt public/payment-qr.png và BANK_QR_IMAGE_PATH=/payment-qr.png rồi khởi động lại app. QR tài khoản không tự điền số tiền/nội dung hóa đơn; khách nhập theo thông tin trên màn hình. Chưa cấu hình thì màn hình thông báo rõ; không có mã QR giả mặc định. Giữ seed owner cũ khi chạy lại db:setup tạo index TreatmentUse.appointmentId.

Cập nhật tự tạo hóa đơn theo yêu cầu mới: nhân viên phụ trách hoàn thành lịch dịch vụ lẻ cũng làm hệ thống tự lập hóa đơn; nhân viên thường không được chọn hóa đơn cũ/hạn trả hoặc xem/thu tiền. OWNER/thu ngân xem hóa đơn và nhận tiền. Các mô tả cũ “nhân viên hoàn thành rồi chờ lập hóa đơn” được thay bằng luồng tự tạo này.

## Database mẫu chạy nhanh

```powershell
docker compose up -d
npm run db:demo
npm run dev:demo
```

Dùng database riêng spacare_demo, không sửa .env.local. Đăng nhập owner@demo.spacare.test / SpaCareDemo@2026. Dừng server dev cũ trước khi dùng cổng 3000. Có 8 khách, 6 dịch vụ, 13 lịch, 6 hóa đơn, 2 gói và dữ liệu cọc/thu chi. Xem [DEMO_DATABASE.md](docs/DEMO_DATABASE.md) để biết tài khoản nhân viên, số liệu đối chiếu và cách chạy lại. `npm run db:demo:check` validate schema trước khi ghi; script không xóa hoặc reset dữ liệu khi chạy lại.

## Giao diện điện thoại

Màn hình <=700px dùng menu chọn mục ở đầu, thanh truy cập nhanh phía dưới, danh sách dạng thẻ có nhãn thay cho bảng kéo ngang, nút chạm tối thiểu 46px và ô nhập chữ 16px. Form mở dạng bottom sheet có vùng cuộn và nút lưu ở cuối. Desktop vẫn giữ sidebar và bảng. Có hỗ trợ safe-area trên điện thoại và không tắt khả năng zoom. Checklist kiểm tra thực tế ở mục 16 docs/TESTING.md.

Danh sách đã có phân trang giao diện: desktop mặc định 10 dòng, điện thoại 5 thẻ, tùy chọn 5/10/20/50. Phân trang/tìm kiếm vẫn áp dụng trên cửa sổ tối đa 500 bản ghi đã tải; chưa phải phân trang backend cho toàn bộ database.


## Chẩn đoán đăng nhập trên Vercel

- MONGODB_URI phải được cấu hình tại môi trường Production của dự án Vercel, trỏ tới Atlas/replica set truy cập được từ máy chủ Vercel. File .env.local trên máy cá nhân không tự trở thành cấu hình production. Không dùng địa chỉ localhost của máy cá nhân cho Vercel.
- APP_ORIGIN phải là HTTPS origin chính xác của website. Sau thay đổi biến môi trường, redeploy để áp dụng.
- Xem Vercel Runtime Logs của POST /api/auth/login: DB_CONFIG_MISSING = thiếu URI; DB_CONFIG_INVALID = URI không hợp lệ; DB_AUTH_FAILED = xác thực MongoDB thất bại; DB_DNS_FAILED = tra cứu DNS SRV/TXT thất bại; DB_CONNECTION_FAILED = lỗi kết nối khác, cần kiểm tra host, TLS và Atlas Network Access. Không mở rộng quyền truy cập mạng nếu chưa xác định đúng nguyên nhân.
- Bản sửa xử lý kết nối không tự khắc phục DNS, tài khoản Atlas hoặc cấu hình mạng bên ngoài. Không gửi URI/mật khẩu trong ảnh/log khi nhờ kiểm tra.
