# Mức độ sẵn sàng của index InvoiceLineCommission

Collection `InvoiceLineCommission` được bổ sung thêm. Quy trình này không thay đổi collection `Commission` kiểu cũ hoặc index `invoiceId` duy nhất của collection đó.

Danh sách khai báo trong repo là [invoice-line-commission-index-manifest.json](../scripts/invoice-line-commission-index-manifest.json). Tệp này định nghĩa collection `invoicelinecommissions` và đúng ba index ứng dụng: hai index duy nhất và một index tra cứu theo nhân viên/thời điểm ghi nhận.

## Chỉ dùng cho cơ sở dữ liệu kiểm thử local

Mặc định script local chỉ đọc và chỉ chấp nhận:

`mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true`

Chạy thử:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true'
$env:SPACARE_ENV='test'
npx.cmd tsx scripts/index-readiness.ts
```

Chỉ được áp dụng lên đúng cơ sở dữ liệu kiểm thử local nói trên và phải truyền rõ cả hai cờ cho phép:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true'
$env:SPACARE_ENV='test'; $env:SPACARE_INDEX_READINESS_APPROVAL='LOCAL_TEST_ONLY'
npx.cmd tsx scripts/index-readiness.ts --apply --approve-index-readiness
```

Script local không bao giờ xóa index. Nếu index còn thiếu, script sẽ tạo; nếu index hiện có có cấu hình duy nhất không khớp, script sẽ dừng với lỗi nghiêm trọng. Chạy áp dụng lại không tạo tác dụng lặp. Có biến Atlas, máy chủ khác, cơ sở dữ liệu khác hoặc thiếu biến phê duyệt đều khiến thao tác bị từ chối.

## Kiểm tra trước và áp dụng trên Production

Production dùng một trình bao riêng. Tuyệt đối không trỏ script chỉ dành cho local ở trên vào Production. [index-readiness-production.ts](../scripts/index-readiness-production.ts) mặc định chạy thử và không in URI. Script yêu cầu người vận hành cung cấp dấu ghim SHA-256 của chính xác URI, tên máy chủ/tên cơ sở dữ liệu đã duyệt và `SPACARE_ENV=production`.

Chỉ đặt các giá trị này trong shell vận hành đã được phê duyệt; không ghi vào mã nguồn hoặc log:

```powershell
$env:SPACARE_ENV='production'
$env:MONGODB_URI='<approved target URI from the secret store>'
$env:SPACARE_APPROVED_URI_SHA256='<64 lowercase hex characters from the change ticket>'
$env:SPACARE_APPROVED_HOST='<approved production hostname>'
$env:SPACARE_APPROVED_DB_NAME='<approved production database name>'
$env:SPACARE_APPROVED_REPLICA_SET='<approved replica-set name>'
npx.cmd tsx scripts/index-readiness-production.ts
```

Chạy thử phải có kết quả **NO-GO** nếu bất kỳ kiểm tra nào sau đây không đạt: dấu băm đích, máy chủ, cơ sở dữ liệu, tình trạng replica set, quyền, định nghĩa index hiện có hoặc quét khóa trùng. Báo cáo chỉ chứa dấu băm đích, tên cơ sở dữ liệu, metadata index và số lượng; không in URI hay dữ liệu tài liệu.

Ngoài bằng chứng chạy thử, áp dụng cần đủ tất cả mục sau: phiếu thay đổi, bản sao lưu đã xác minh, diễn tập khôi phục hoàn tất, cờ phê duyệt tường minh và dấu xác nhận phê duyệt.

```powershell
$env:SPACARE_CHANGE_TICKET='<approved ticket id>'
$env:SPACARE_BACKUP_VERIFIED='YES'
$env:SPACARE_RESTORE_REHEARSAL='YES'
$env:SPACARE_INDEX_READINESS_APPROVAL='PRODUCTION_APPROVED'
npx.cmd tsx scripts/index-readiness-production.ts --apply --approve-index-readiness
```

Trình bao chỉ tạo collection/index trong danh sách khai báo; không xóa hoặc ghi đè dữ liệu. Trình bao từ chối tùy chọn không khớp và dừng trước khi áp dụng nếu phát hiện khóa trùng hoặc thiếu quyền. Không thay đổi collection `Commission`.

## Quy trình vận hành Production

1. Xác nhận bản sao lưu hiện tại đã được kiểm chứng, đã diễn tập khôi phục, có người phụ trách hoàn tác, khung giờ bảo trì và tài khoản cơ sở dữ liệu theo nguyên tắc quyền tối thiểu.
2. Chạy thử trên Production; xác nhận dấu ghim đích chính xác, replica set khỏe, write concern, quyền, số khóa trùng bằng 0 và không có tùy chọn index xung đột.
3. Xác nhận danh sách index `Commission` hiện có không đổi và lưu trữ báo cáo kiểm tra trước.
4. Nhận phê duyệt tường minh rồi chạy lệnh áp dụng có chốt ở trên. Tạo collection trước, sau đó tạo ba index trong danh sách; tuyệt đối không xóa hoặc sửa index của `Commission`.
5. Chạy lại trình bao ở chế độ thử và lưu kết quả kiểm tra sau. Xác minh mọi tùy chọn trong danh sách khai báo và bảo đảm index cũ không đổi.
6. Chỉ triển khai/điều hướng lưu lượng sau khi lưu bằng chứng kiểm tra sau. Ứng dụng dùng `autoIndex:false`, nên không thể tự động bảo đảm index đã sẵn sàng; nếu bỏ qua chốt này, ứng dụng có thể ghi hoa hồng theo dòng trước khi tạo index duy nhất.
7. Nếu áp dụng thất bại, dừng phát hành và giữ lại log, bằng chứng sao lưu cùng định nghĩa index. Nếu cần hoàn tác ứng dụng, giữ collection/index bổ sung và đối soát các dòng sổ chi tiết trước khi bật lại phiên bản mới. Không bao giờ xóa lịch sử tài chính hoặc sửa index duy nhất cũ của `Commission` để chữa cháy.

Thiếu xác minh sao lưu, xác minh đích, bằng chứng quyền, quét khóa trùng hoặc đối chiếu danh sách sau áp dụng đều là **NO-GO**.

## Kiểm tra tăng cường và giới hạn bằng chứng

Trình bao chỉ ghi mã lỗi cố định, không ghi thông báo từ driver hoặc metadata index thô. Quyền được kiểm tra trên cơ sở dữ liệu đã ghim và từng collection (bao gồm quyền `find` để quét khóa trùng); `getDefaultRWConcern` cần quyền ở cấp cluster. Chạy thử không cần quyền tạo. Quyền không thể chứng minh được sẽ khiến thao tác bị từ chối.

Chính sách phát hành thận trọng yêu cầu read concern mặc định tường minh là `majority` và write concern mặc định là `{w:'majority',j:true}`, kèm kết quả lệnh thành công. Đây là chốt phát hành vận hành, không phải yêu cầu thay đổi mặc định của cơ sở dữ liệu. Thiếu cấu hình, cấu hình ngầm, yếu hơn hoặc không truy cập được đều chặn phát hành. Chính sách này vẫn cần người vận hành phê duyệt.

Tất cả định nghĩa index cũ được chuẩn hóa trước khi áp dụng và đọc lại sau đó, kể cả khi thao tác thất bại. Thứ tự danh sách index và thứ tự tùy chọn trong object được chuẩn hóa; thứ tự khóa compound và mọi tùy chọn được trả về vẫn phải khớp. Sai khác hoặc không đọc được dữ liệu hậu kiểm sẽ chặn phát hành. Không tự sửa index cũ. `autoCreate:false` ngăn quá trình khởi tạo model tạo collection khi chạy thử.

Các cờ sao lưu là xác nhận do người vận hành khai báo, không phải bằng chứng tự động rằng bản sao lưu hợp lệ. Lưu ID bản sao lưu, bằng chứng diễn tập khôi phục, phê duyệt đích và bằng chứng quyền trong phiếu thay đổi. Không chuyển lưu lượng ứng dụng trước khi hậu kiểm đạt.

Kiểm thử hồi quy chính sách offline: `node --test tests/index-readiness-policy.test.mjs`. Các kiểm thử này dùng đối tượng tổng hợp, không kết nối cơ sở dữ liệu; chúng không xác nhận quyền Production hoặc mức sẵn sàng của bản sao lưu.

Bằng chứng build phải được lưu ngoài cây mã nguồn này: HEAD, danh sách đầy đủ các tệp ứng viên (kể cả tệp chưa được Git theo dõi), SHA-256 trước/sau, dấu thời gian UTC, lệnh chính xác `npm run build`, mã thoát và log build. Danh sách ứng viên hiện gồm mô-đun chính sách và kiểm thử hồi quy: 18 tệp thay vì 16. Đối chiếu mọi hash mã nguồn và danh sách ứng viên trước khi chấp nhận log. Chỉ có BUILD_ID hoặc dấu thời gian là chưa đủ. Không sửa ACL hoặc xóa `.next` để tạo bằng chứng này.
