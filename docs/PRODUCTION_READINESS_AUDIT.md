# Audit chuẩn bị vận hành dữ liệu thật — 24/10/2026

Trạng thái: CHƯA SẴN SÀNG để xác nhận an toàn cho dữ liệu thật. Đây là audit tĩnh code/cấu hình cục bộ; chưa xác minh dashboard Vercel, Atlas, database users, backup, network access hoặc branch protection trên GitHub. Không kết nối database để audit; không sửa URI, dữ liệu, indexes, quyền cloud, deploy hoặc commit. Các thay đổi có sẵn trong working tree được giữ nguyên. Báo cáo này là thay đổi tài liệu duy nhất của lượt audit.

## Môi trường quan sát được (không chứa credentials)

| Nguồn | Database | Ghi chú |
| --- | --- | --- |
| .env.local | spacare_live (Atlas) | npm run dev và nhiều scripts ghi dùng nguồn này; không có APP_ORIGIN trong file. Biến shell/Vercel có thể khác. |
| .env.atlas.local | spacare (Atlas) | Cấu hình cũ chưa xác định mục đích. |
| .env.test.local | spacare_test (local) | Đúng tên dành cho integration. |
| .env.demo.local | spacare_demo (local) | Demo được kiểm tra đúng tên. |
| .env.example | spacare (local) | Chưa theo quy ước môi trường mới. |

Không có APP_ENV/SPACARE_ENV trong các file đã kiểm tra. Chưa chứng minh database mà deployment production đang sử dụng. Không suy rằng spacare_live có hay không có dữ liệu thật từ tên database.

Mục tiêu CONFIRMED theo yêu cầu người dùng: production spacare_prod; development spacare_dev; test spacare_test; demo spacare_demo là sandbox riêng, không thuộc production. Việc chuyển từ spacare_live/spacare sang spacare_prod cần kế hoạch và xác nhận riêng; không phải đổi chuỗi URI rồi coi dữ liệu đã được chuyển.

## Phát hiện ưu tiên

1. CRITICAL — local có thể ghi Atlas đang vận hành. src/lib/db.ts chỉ nhận MONGODB_URI, không kiểm tra môi trường/database. npm run dev, db:setup, db:staff-phone, db:commission-shares, push:db, db:import-catalog dùng .env.local hoặc môi trường kế thừa. Chưa có chốt chung từ chối production trong dev/test/scripts.
2. CRITICAL — src/app/api/auth/register/route.ts tìm Customer theo số điện thoại người đăng ký tự nhập rồi gắn customerId, không xác minh số điện thoại hay chủ spa duyệt. Người biết số khách có thể tạo tài khoản với email khác và đọc lịch/hóa đơn/gói qua /customer. Đây là kết luận từ luồng code, chưa khai thác trên dữ liệu thật.
3. HIGH — src/app/customer/page.tsx thiếu kiểm tra role CUSTOMER và fallback liên kết hồ sơ theo tên khi thiếu customerId. Có thể trả lịch sử người trùng tên; query Service thiếu spaId. Cần chỉ dùng liên kết đã xác thực, fail closed, không suy danh tính theo tên/số điện thoại.
4. HIGH — scripts/setup.ts gọi migrateUserIndexes, tạo collections/indexes, bỏ index unique nghỉ cũ và bootstrap OWNER khi database chưa có User. src/lib/user-indexes.ts dropIndex email cũ. Không phải script chỉ đọc hoặc chỉ thêm; không chạy trên production trước khi review kế hoạch indexes và xác nhận.
5. HIGH — chưa có .github/workflows trong checkout, chưa xác minh protected branch/required checks trên GitHub; không có .vercel/project.json để xác nhận liên kết dự án. Không kết luận cấu hình cloud chưa có chỉ vì repo không có.
6. HIGH — import --write cho phép database bất kỳ khi --database khớp pathname URI; có transaction/auth OWNER/idempotency/audit, không cố ý ghi đè, nhưng chưa chặn production theo môi trường. Quy tắc hiện tại nên khóa CLI import production; nhập thật qua luồng vận hành hoặc quy trình import riêng được duyệt.
7. MEDIUM — đăng ký tạo Customer/User/Session tuần tự ngoài transaction; chưa thấy rate limit tại route đăng ký/booking. Có nguy cơ bản ghi dở dang hoặc spam. Không tự bổ sung chính sách OTP/khớp khách khi chưa được duyệt.
8. MEDIUM — logger JSON và failure an toàn đã có; chưa đồng nhất ở dispatch/background/scripts. scripts/seed-demo.ts vẫn in mật khẩu demo; bỏ việc in dù là dữ liệu giả. Không đưa raw driver error, request body, chữ ký, token hoặc URI vào log. Import preview có dữ liệu danh mục và không phải log hệ thống đã được chuẩn hóa.
9. MEDIUM — scripts/clean-published-repo.mjs có chế độ amend lịch sử và force-with-lease lên main. Không thuộc reset DB, nhưng không dùng trong quy trình phát hành thông thường.

## Scripts và xóa dữ liệu

- seed-demo/dev-demo chỉ chấp nhận spacare_demo; seed có marker/idempotency và transaction. Cần chặn thêm VERCEL_ENV=production và credentials không có quyền production.
- Integration và workbook HTTP/UI fixtures kiểm tra pathname spacare_test trước kết nối. Cleanup dùng deleteMany theo IDs spa fixture, không phải xóa toàn database. Có scripts gọi mongoose.connect trực tiếp, nên guard chỉ đặt trong db.ts chưa bao phủ hết.
- Không thấy dropDatabase/dropCollection hoặc API xóa hàng loạt lịch sử tài chính trong các file source/scripts/tests đã rà. Đây không phải bảo đảm tuyệt đối chống mọi cách xóa.
- API logout xóa session; unsubscribe/push loại thiết bị. Đây là xóa dữ liệu kỹ thuật có chủ đích. Notification readAll updateMany được scope theo spa/user, không phải reset dữ liệu tài chính.
- Production runtime vẫn cần cập nhật nhiều bản ghi hợp lệ khi duyệt lương; không thể chặn mọi updateMany mà không đánh giá mục đích.
- Code guard không thể chống người dùng có credentials quản trị chạy Compass/mongosh hoặc script ngoài repo. Phải tách database users, giới hạn database/cluster và quyền quản trị; cân nhắc custom role loại dropDatabase/dropCollection/remove trên collection lịch sử nếu Atlas tier hỗ trợ và sau kiểm thử quyền thực tế.

## Quyền và tài chính

OWNER: sửa hóa đơn chưa phát sinh theo expectedUpdatedAt và điều kiện lịch sử; cấu hình/duyệt/chi lương, hoàn gói, đảo sai sót, mở lại sổ thuộc ownerActions.
STAFF: quyền vận hành; cashier flag mở thêm action tài chính. Payment/allocate kiểm tra hóa đơn lịch phụ trách qua assignedInvoice, OWNER có quyền toàn spa. Không mặc định thu ngân được sửa lịch sử.
CUSTOMER: route operations từ chối; payrollStaffScope giới hạn STAFF chỉ mình và OWNER toàn spa. Tuy nhiên luồng nhận diện khách ở đăng ký/trang khách là blocker nêu trên.
MANAGER: chưa được hỗ trợ trong schema/Actor; tests chủ động từ chối. Không tự cấp quyền OWNER cho MANAGER. Cần xác nhận ma trận quyền trước khi thêm role.

operations đọc lại user active/role từ DB trong transaction, lấy scope theo actor phiên, truy vấn tham chiếu cùng spa; dùng Control guard, snapshot/majority, idempotency fingerprint và Audit. Ghi tiền yêu cầu sổ mở. Không thấy Promise.all ghi song song trong transaction operations. Những bảo vệ này chưa thay thế integration và kiểm thử quyền trên môi trường đã tách.

## Thay đổi dự kiến và rollback (chưa triển khai)

| Đợt | Thay đổi | Điều kiện | Rollback |
| --- | --- | --- | --- |
| A | Guard thuần và tests, template env không chứa secret, CI/checklist | Không kết nối DB; giữ .env thật | Revert đúng patch/commit, không reset working tree hiện có |
| B | Gắn guard trước mọi kết nối app/scripts/test; từ chối thiếu env, tên DB sai, URI mơ hồ, dbName override và connection đang mở sai DB | Xác nhận deployment đang dùng DB nào; cấu hình dev/test và quyền riêng đã sẵn sàng | Giữ deployment đang tốt; rollback code tương thích, không đổi/restore DB |
| C | Chặn liên kết khách theo tên/số tự khai, fail closed hoặc tạm đóng đăng ký; bổ sung transaction và tests | Duyệt tác động đến người đăng ký/hồ sơ hiện tại | Không rollback về bản có lỗ hổng; giữ cổng khách đóng nếu có sự cố |
| D | Chặn setup/seed/demo/import/reset trong production, tách bootstrap và index migration | Mọi đường gọi trực tiếp cũng qua guard; credentials tách | Revert code khi vẫn giữ quyền DB hạn chế; không tự tạo lại indexes cũ |
| E | Đổi cấu hình/cloud/deploy và chuyển sang spacare_prod nếu cần | Backup đã kiểm chứng, kế hoạch cutover được duyệt riêng | Giữ DB nguồn nguyên vẹn; đối chiếu dữ liệu phát sinh sau cutover trước bất kỳ đổi lại nào |

Guard đề xuất dùng SPACARE_ENV=production/development/test/demo; VERCEL_ENV=production bắt buộc production/spacare_prod, preview bắt buộc development/spacare_dev, test bắt buộc spacare_test. Không dựa riêng NODE_ENV vì Preview build cũng chạy production mode. Parse URI bằng cơ chế tương thích MongoDB nhiều host, từ chối database path thiếu/sai; không auto sửa URI. Kiểm tra namespace thực tế trước ghi/cleanup. Build/CI không giữ credentials production. Fail closed là thay đổi hành vi cần rollout có kế hoạch, không bật mù trên deployment cũ.

## Cấu hình cloud mục tiêu

Production Vercel: SPACARE_ENV=production, MONGODB_URI tới spacare_prod bằng user riêng, APP_ORIGIN URL chính xác, CRON_SECRET/VAPID riêng; không chứa SEED_OWNER_PASSWORD. Preview: development/spacare_dev, user chỉ có quyền dev; APP_ORIGIN phải khớp URL preview được cho phép (hiện code checkOrigin chỉ chấp nhận một origin). Development local: spacare_dev. Test/CI: spacare_test trên replica set riêng, không dùng secret Vercel/Atlas prod.

Không dùng NEXT_PUBLIC_ cho secret. Kiểm tra cả env theo branch và biến kế thừa từ integration. Preview không được giữ khóa push/cron production hoặc tự gửi thông báo thật. Chưa thay đổi Vercel/Atlas/GitHub trong audit này.

## Backup và restore đề xuất (không thực hiện)

Xác minh cluster tier và trang Backup thực tế. Atlas hiện có tài liệu Free backup subscription ở private preview, có thể chưa hiện cho tài khoản; không mặc định M0 đã có backup. Với tier hỗ trợ, chọn snapshot tự động và PITR nếu cần giảm mất dữ liệu; xem giá trước khi bật. Nếu không có managed backup, dùng mongodump có xác thực an toàn, archive mã hóa ngoài repo/máy dev, checksum và giám sát lỗi. Dump DB đang có giao dịch cần phương án nhất quán (snapshot/PITR phù hợp hoặc dừng ghi có kế hoạch); không coi dump từng collection lúc đang thu tiền là backup nhất quán.

Đề xuất để spa duyệt: backup hằng ngày, giữ 7 bản ngày + 4 bản tuần + 3 bản tháng; RPO 24h chỉ phù hợp nếu chấp nhận mất tối đa một ngày. Với thu tiền thật, cân nhắc PITR/RPO ngắn hơn. Không đặt lịch hay bật tính phí tự động.

Diễn tập restore vào cluster/DB phục hồi riêng, không dùng production/dev/test đang hoạt động; không --drop, không restore đè. Đối chiếu counts, indexes, liên kết, tổng thu/cọc/nợ, số buổi, chữ ký/GridFS; kiểm tra ứng dụng trước cutover riêng được duyệt. Backup chứa thông tin khách, session và chữ ký: mã hóa, giới hạn quyền, không đưa vào Git/Library công khai/log. Không clone dữ liệu thật sang Preview chưa ẩn danh.

Nguồn chính thức đã đối chiếu ngày audit:
- https://www.mongodb.com/docs/atlas/backup/cloud-backup/free-cluster-backup/
- https://www.mongodb.com/docs/atlas/backup/cloud-backup/overview/
- https://www.mongodb.com/docs/atlas/security-add-mongodb-users/
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/deployments/environments
- https://vercel.com/docs/git/vercel-for-github

## Git và deploy đề xuất

main chỉ phát hành; feature/* hoặc fix/* → PR → checks/Preview → merge. CI npm ci, npm test, typecheck, build không dùng prod secret; integration có replica set spacare_test riêng và không bị bỏ qua âm thầm. Bật required checks, chặn force push/direct push, giải quyết comments trước merge. Vercel Production Branch=main, branch khác Preview. Không coi có CI là Vercel tự chờ CI: phải bảo vệ main hoặc cấu hình deployment checks/promote thủ công nếu muốn kiểm soát thêm. Không promote artifact Preview dùng env dev sang production mà chưa xác nhận cơ chế rebuild/env.

## Checklist mỗi lần deploy

- [ ] Đúng commit/PR, diff được review; không đính kèm .env, backup, file khách thật hoặc outputs nhạy cảm.
- [ ] Xác nhận production DB hiện hành, user chỉ đúng phạm vi; Preview/dev/test không thể xác thực hoặc truy cập prod bằng credentials của chúng.
- [ ] npm ci, npm test, npm run typecheck, build đạt trên CI; integration spacare_test đạt. Ghi rõ blocked/fail, không tính là pass.
- [ ] Test phủ cross-spa, OWNER/STAFF/CUSTOMER, MANAGER bị từ chối, thu ngân không sửa lịch sử và lương STAFF chỉ mình.
- [ ] Kiểm tra gửi lặp/đồng thời, rollback, sổ chốt, không âm cọc/buổi/kho và audit.
- [ ] Không chạy seed/setup/import/migration trong build hoặc postinstall; thay đổi indexes/schema có kế hoạch riêng.
- [ ] Backup gần nhất thành công, restore drill đạt và RPO/RTO được chấp nhận.
- [ ] Preview dùng DB giả riêng; login/origin đúng, không gửi push thật; smoke test mobile và luồng chính đạt.
- [ ] Production env đúng scope; không có secret NEXT_PUBLIC_, seed password hoặc dev URI; không đổi URI ngầm.
- [ ] Bản phát hành tương thích schema cũ; đã xác định deployment rollback còn hoạt động và người quyết định rollback.
- [ ] Sau deploy kiểm tra chỉ đọc/login trước, logs/error rate và xác nhận các giao dịch thật tiếp tục đúng. Không tạo giao dịch tiền giả trên prod để test.
- [ ] Khi lỗi: hạn chế ghi nếu cần, giữ bằng chứng; rollback deployment tương thích. Không reset/restore DB để sửa lỗi code.

## Kiểm tra và phần chưa xác minh

Lượt audit: npm test 110/110 đạt, npm run typecheck đạt. Không chạy integration vì không thực hiện kết nối DB trong audit này; lượt trước đã bị DB_CONNECTION_FAILED. Không chạy lại build vì chỉ thêm tài liệu; lượt trước Turbopack bị quyền tạo junction và Webpack EPERM khi ghi .next. Chưa kiểm chứng build trên CI/Linux. Không kiểm tra tính hợp lệ đầy đủ các secrets trong lịch sử Git; chỉ xác nhận tracked env hiện tại là hai file example. Chưa đọc quyền cloud hoặc dữ liệu thật.

Cần xác nhận trước đợt thay đổi ảnh hưởng hành vi/dữ liệu: deployment production đang sử dụng spacare_live, spacare hay database khác? spacare_live đã chứa dữ liệu cần giữ chưa? MANAGER tiếp tục bị từ chối đến khi có ma trận quyền riêng. Không yêu cầu gửi connection string hoặc mật khẩu.


## Bản vá containment đã triển khai cục bộ — 24/10/2026
Đã thay đăng ký công khai bằng 403 không đọc body/kết nối DB/tạo User/Customer/Session; trang đăng ký hiển thị thông báo. /customer không đọc hồ sơ/lịch sử và không truyền customerId cũ xuống client; OWNER/STAFF chuyển workspace. Đặt lịch từ CUSTOMER bị từ chối cả trước transaction và sau khi đọc lại role DB; không còn nhánh nhận customerId cũ. Chưa có workflow xác minh/mở lại cổng khách. Chưa deploy và chưa sửa dữ liệu hoặc cấu hình production. Các phát hiện về môi trường/backup khác vẫn còn. Rollback phải giữ containment, không trở về luồng nhận hồ sơ bằng tên/số điện thoại.
