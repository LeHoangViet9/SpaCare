# Nhập quyền lợi, số dư thẻ và nợ từ sổ cũ

Đây là công cụ chuyển số dư, không phải seed/demo hay nhập danh mục. Không chạy db:setup/seed vào live. File dữ liệu và báo cáo trong imports/ không được đưa lên Git.

## Đối chiếu ngoại tuyến

```powershell
npm run db:opening:preview -- --file imports/legacy-opening-balances.review.json
```

Không kết nối database. Ngày nguồn là yyyy-mm-dd; tiền nguyên VNĐ; không dùng tổng buổi, giá hoặc ngày hết hạn tự suy đoán. Kiểm tra số dư nguồn tại thời điểm chuyển; tạm dừng ghi sổ cũ/nhập tay cùng bộ khách để tránh trùng.

## Chuẩn bị live

.env.live.local là file bí mật bị Git bỏ qua, tạo riêng, không sửa .env.local dùng dev. Điền MONGODB_URI thực tế đúng spacare_live và tài khoản Atlas có quyền đúng DB. Điền SEED_OWNER_PHONE/SEED_OWNER_PASSWORD của OWNER có sẵn trên live (không phải mật khẩu Atlas). Nếu owner cũ dùng email, cấu hình SEED_OWNER_EMAIL thay số điện thoại. Không gửi bí mật qua chat hoặc ảnh. Không tự đổi database trong URI.

Deploy và kiểm tra code tương thích openingBalance, origin OPENING, đánh số buổi từ chuyển đổi, chặn sửa/hoàn chứng từ nguồn. Đối chiếu bản backup khả dụng theo cấu hình hiện có trước ghi; không tự restore. CLI không tạo collection hoặc index; nếu thiếu, dừng để review bước khởi tạo riêng. Không tự dùng setup production.

## Đối chiếu chỉ đọc

```powershell
npm run db:opening:live -- --file imports/legacy-opening-balances.review.json --database spacare_live --batch face-opening-20261024 --check
```

Báo cáo imports/opening-live-check.json gồm hồ sơ dùng lại/tạo mới, dịch vụ đã khớp, cảnh báo và hash duyệt. Thiếu/trùng dịch vụ thì tạo imports/opening-service-map.json dạng {"Tên dịch vụ nguồn":"ID cùng spa đã được đối chiếu"}; chạy lại với --mapping imports/opening-service-map.json. Không tự gán dịch vụ gần giống hoặc tự tạo giá/hoa hồng. Khách cùng SĐT khác tên hoặc đã có liệu trình/thẻ/nợ thì phải đối soát; CLI không gộp/ghi đè.

Chủ spa duyệt cả cảnh báo chưa biết hạn gốc (không tự đặt hạn; gói hiện được dùng theo số buổi còn), chưa biết tổng buổi/giá gốc và số dư thẻ gồm tiền mua+quà chưa tách. Chứng từ gói 0đ chỉ là cầu nối quyền lợi đã thanh toán, không tái tạo doanh thu hoặc chứng minh giá mua gốc.

## Chỉ ghi sau khi đã duyệt báo cáo, backup và deploy

```powershell
npm run db:opening:live -- --file imports/legacy-opening-balances.review.json --database spacare_live --batch face-opening-20261024 --write --app-ready --approve HASH_TRONG_BAO_CAO
```

Giữ nguyên --mapping nếu đã dùng. --app-ready là xác nhận vận hành đã triển khai bản tương thích, không tự deploy. Mã duyệt đổi khi nội dung, hồ sơ hoặc ánh xạ thay đổi. Không ghi nếu còn lỗi. Mã đợt giữ nguyên khi retry: cùng nội dung trả lại kết quả, khác nội dung từ chối. Không đổi batch để né lỗi trùng.

Sau ghi đối chiếu khách mới/dùng lại, tổng quyền lợi, thẻ và khoản nợ. Audit lưu IDs được tạo; không có CashEntry/Payment/hoa hồng lịch sử mới. Nếu lỗi trong transaction, toàn đợt rollback. Sau commit không có lệnh xóa hoặc restore tự động: tạm dừng ghi, dùng IDs/báo cáo để chủ spa duyệt cách sửa; không quay về bản không hiểu dữ liệu chuyển đổi.
