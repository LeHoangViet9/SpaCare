# SpaCare — Chạy dữ liệu demo

## Chạy nhanh

Dùng Node.js 24 và MongoDB replica set của compose hiện có. Dừng server npm run dev cũ bằng Ctrl+C trước khi mở demo để giải phóng cổng 3000.

```powershell
docker compose up -d
npm run db:demo
npm run dev:demo
```

Mở http://localhost:3000. Script mặc định dùng database **spacare_demo** tại 127.0.0.1:27017, replicaSet=rs0, directConnection=true. Không cần sửa .env.local hoặc chạy db:setup trước. Script tự tạo collections/indexes và tài khoản mẫu.

Nếu lỗi kết nối Docker, mở Docker Desktop, chờ engine hoạt động và replica set có primary rồi chạy lại. Không chạy docker compose down -v để sửa lỗi vì lệnh đó có thể xóa dữ liệu lưu trong volume.

## Tài khoản mẫu

Mật khẩu khởi tạo chung: **SpaCareDemo@2026**. Đây là thông tin đăng nhập công khai cho dữ liệu giả local, không dùng cho vận hành thật.

| Email | Quyền |
|---|---|
| owner@demo.spacare.test | Chủ spa |
| cashier@demo.spacare.test | Nhân viên có quyền thu ngân |
| lan@demo.spacare.test | Kỹ thuật viên Lan |
| hoa@demo.spacare.test | Kỹ thuật viên Hoa |

Đăng xuất phiên cũ nếu đang đăng nhập tài khoản của database khác. Sau khi chuyển database, cookie cũ không tương ứng session trong demo.

## Dữ liệu có sẵn ở lần khởi tạo đầu

| Loại | Số lượng / tình huống |
|---|---|
| Spa / tài khoản | 1 spa demo / 4 tài khoản |
| Khách hàng / dịch vụ | 8 khách giả / 6 dịch vụ |
| Lịch hẹn | 13 lịch: 7 hoàn thành, 4 xác nhận (1 đã tới giờ), 1 hoãn, 1 hủy |
| Hóa đơn | 6: 4 đã thanh toán, 1 trả một phần, 1 chưa thanh toán |
| Gói | Thu: 10 buổi còn 7; Trang: 5 buổi còn 5 |
| Buổi có xác nhận | 3 buổi mẫu của gói Thu, tham chiếu phiếu DEMO-PHIEU-* |
| Cọc | Mai cọc 500k đã áp 350k, dư 150k; Hạnh cọc 200k chưa áp |
| Thu/chi | 8 bút toán tiền mặt/chuyển khoản, có Payment và Allocation liên quan |
| Sổ ngày | Hôm nay OPEN đầu quỹ 1 triệu; hôm qua CLOSED thiếu 20k |
| Audit | Sự kiện demo_seed ghi rõ dữ liệu giả; các thao tác bạn thử tiếp sẽ có audit bình thường |

Tất cả số điện thoại và tên trong bộ mẫu chỉ để thực hành, không dùng để liên hệ người thật. Không có cấu hình ngân hàng, QR hay giao dịch ngân hàng thật.

## Đối chiếu khi chưa thao tác thêm

- Tổng công nợ: **850.000đ** (Linh 400k, Hạnh 450k).
- Cọc còn dùng: **350.000đ** (Mai 150k + Hạnh 200k).
- Tổng thực thu hôm nay: **4.750.000đ**; chi **150.000đ**.
- Thu tiền mặt: **2.250.000đ**, chi tiền mặt **150.000đ**, đầu quỹ **1.000.000đ** → quỹ dự kiến **3.100.000đ**.
- Tổng nhận chuyển khoản: **2.500.000đ**; không cộng vào quỹ tiền mặt.
- Tổng số buổi gói còn lại: **12**.

Các con số này áp dụng ngay sau seed lần đầu, không còn là expected nếu bạn đã thử thu tiền, áp cọc, dùng buổi hoặc chốt ngày.

## Thử ngay

1. Đăng nhập owner → Lịch hẹn → tìm Hoàng Thanh Hà với ghi chú “Có thể bấm hoàn thành ngay”. Hoàn thành để thử sinh hóa đơn dịch vụ 350k.
2. Hóa đơn → Linh → còn nợ 400k → nhận một phần tiền mặt. Tick thực nhận chỉ cho khoản dữ liệu giả bạn đang mô phỏng.
3. Tiền cọc → Hạnh → áp 200k vào invoice Hạnh 450k → nợ còn 250k; không có khoản thu mới.
4. Đặt lịch → khách Phạm Minh Thu → dịch vụ Gói chăm sóc da 10 buổi → gợi ý gói còn 7. Đặt giờ gần nhất trong tương lai và đợi tới giờ để hoàn thành/xác nhận, còn 6 buổi.
5. Lịch hoãn → xếp giờ mới; thử dời vào giờ nhân viên đang bận để kiểm tra từ chối.
6. Cuối lượt thử mới chốt sổ; không chốt trước khi kiểm tra các ca ghi tiền khác.

## Chạy lại và đổi cấu hình

- Seed một lần trong một transaction; marker Idempotency ngăn chèn lại. Chạy lại không xóa dữ liệu, đặt lại mật khẩu, mở lại sổ đã chốt hoặc khôi phục buổi đã dùng.
- Ngày/giờ mẫu lấy tại lần seed thành công đầu tiên. Chạy lại vào ngày khác không tự dời lịch/mở sổ mới; dùng giao diện để thêm lịch và mở sổ ngày hiện tại.
- Nếu seed bị gián đoạn trước commit, dữ liệu fixture được rollback; collections/indexes tạo trước transaction có thể vẫn tồn tại. Có thể chạy lại.
- Dữ liệu fixture cố định để tái tạo quan hệ; không tự gộp hay ghi đè document xung đột nếu bạn nhập tay.
- Seed là dữ liệu tổng hợp trực tiếp qua Mongoose để có lịch quá khứ và đủ trạng thái; không chứng minh các use case vận hành đã chạy đúng. Audit đánh dấu synthetic=true.
- Script chỉ chấp nhận tên database spacare_demo, không có tùy chọn force/reset/drop.

Có thể tạo cấu hình demo riêng nếu cần đổi host:

```powershell
Copy-Item .env.demo.example .env.demo.local
```

Chỉnh host trong MONGODB_URI nhưng giữ tên database spacare_demo. npm run db:demo và npm run dev:demo cùng đọc file này; dev:demo đặt env trước khi Next đọc .env.local nên không mở nhầm database vận hành. Port demo cố định 3000. Để trở về app thường: Ctrl+C rồi npm run dev; .env.local vẫn giữ nguyên.

## Kiểm tra trước khi ghi database

```powershell
npm run db:demo:check
npm run typecheck
```

Check chỉ dựng và validate schema các bản ghi, không kết nối/ghi MongoDB. Không thay thế kiểm tra unique index, transaction hoặc nghiệm thu trên database. Muốn xác minh seed chạy lại không trùng, ghi lại count theo spa trước/sau lần chạy thứ hai trên spacare_demo.
