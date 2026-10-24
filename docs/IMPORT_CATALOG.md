# Nhập danh mục dịch vụ từ Excel

Chạy trong terminal IntelliJ tại thư mục dự án trên Windows. Script dùng Node.js 24 và PowerShell có sẵn, không cần cài Excel/Python hay thêm thư viện. Không thay Execution Policy của Windows. File nhập nằm trong `imports/` (đã bỏ qua bởi Git); không thêm dữ liệu vận hành vào repository.

## 1. Chuẩn bị

Tải file Excel đã đối chiếu, đặt tại `imports/Danh_muc_dich_vu_SpaCare.xlsx` (tự tạo thư mục imports nếu chưa có).

Giữ sheet đầu với các cột: `Nhóm dịch vụ`, `Tên dịch vụ`, `Giá từ (VNĐ)`, `Giá đến (VNĐ)`, `Hoa hồng (VNĐ)`, `Bảo hành`, `Ghi chú`. Cột phụ được bỏ qua. Tiền là số nguyên VNĐ đầy đủ, không phải nghìn đồng. Không dùng công thức; nếu có, copy và Paste Values trước. File tối đa 10 MB/1000 dòng; không cần thời lượng.

- Dịch vụ thường: nhập giá và hoa hồng cố định (0 được chấp nhận).
- Giá theo khoảng: thêm cột `Giá mặc định (VNĐ)` và chọn giá trong khoảng; hoặc dùng cờ `--use-min-price` để chủ động lấy giá từ. Giá mặc định không bắt giá trên hóa đơn: nhân viên nhập giá thực tế. Khoảng gốc/ghi chú lưu audit, chưa hiển thị thành khoảng giá trên danh mục.
- TRIỆT LÔNG: cột giá là giá cả gói, Bảo hành phải là `3 năm từ ngày mua`; thêm `Giá lẻ (VNĐ)` hoặc giữ ghi chú `Giá lẻ: 100,000 đ/lần`. Script tạo dịch vụ tính theo lần và gói 36 tháng riêng. Không tạo gói cho khách/hoá đơn bán lúc nhập danh mục.

## 2. Xem trước (không kết nối/ghi DB)

```powershell
npm run db:import-catalog -- --file "imports/Danh_muc_dich_vu_SpaCare.xlsx" --use-min-price
```

Đối chiếu tên, nhóm, giá lẻ, hoa hồng, giá gói và số lượng. Có lỗi thì sửa file và xem trước lại; chưa ghi dòng nào. Bỏ `--use-min-price` nếu đã có cột Giá mặc định. Script không tự sửa dữ liệu cũ khi file thay đổi.

## 3. Nhập thật sau khi đối chiếu

`.env.local` phải dùng URI Atlas đúng database đích và `SEED_OWNER_PHONE`, `SEED_OWNER_PASSWORD` của tài khoản chủ đã được tạo. Đây là mật khẩu đăng nhập SpaCare, không phải mật khẩu database user Atlas. Không đổi mật khẩu seed để đặt lại tài khoản cũ. Script xác thực mật khẩu và role/active tại database trước khi ghi.

```powershell
npm run db:import-catalog -- --file "imports/Danh_muc_dich_vu_SpaCare.xlsx" --use-min-price --write --database spacare_live --dns 1.1.1.1,8.8.8.8
```

Đổi `spacare_live` nếu URI dùng tên khác. `--database` phải khớp hoàn toàn với tên trong URI; không tự chuyển database. `--dns` chỉ dành cho lỗi DNS trên máy đã gặp; không thay DNS toàn Windows. Không thêm URI/mật khẩu vào lệnh hoặc ảnh chụp.

Toàn file cùng transaction: lỗi bất kỳ dòng nào thì rollback toàn lần chạy. Chạy lại cùng dữ liệu không tạo trùng; danh mục cũ khác giá/quyền lợi/ngừng hoạt động báo lỗi thay vì ghi đè. Cần DB replica set/Atlas và indexes đã khởi tạo bằng db:setup. Không xóa dữ liệu để xử lý lỗi.

## Sau khi nhập

Tải lại Danh mục dịch vụ và Danh mục liệu trình để đối chiếu. Nếu Vercel cùng database Atlas, dữ liệu hiện ngay, không cần deploy chỉ để cập nhật dữ liệu. Tuy nhiên phải deploy bản code mới trước khi dùng lịch không thời lượng và ngày mua cho triệt 36 tháng.

Lịch mới chỉ ghi giờ đến 09:00–22:00, cho phép nhiều khách cùng giờ và không tự xác định kín lịch. Spa cân đối/điều phối nhân viên. Khi bán gói triệt 36 tháng, backend tính từ ngày mua theo giờ Việt Nam, không nhận ngày khác từ client; hạn cộng 36 tháng theo quy tắc lịch hiện có. Gói cũ giữ nguyên, gia hạn/bảo lưu theo quy trình cũ.
