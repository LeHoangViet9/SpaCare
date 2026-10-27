# Production Safety Guards — PR 1 (26/10/2026)

CONFIRMED phạm vi theo yêu cầu người dùng: chặn dev/Preview/test kết nối nhầm dữ liệu vận hành, bảo vệ CLI và Selenium; không đổi URI, credentials, dữ liệu, nghiệp vụ hoặc triển khai production trong PR này.

PROPOSED kỹ thuật: guard thuần trong `src/lib/production-safety.mjs`, dùng trước kết nối/mutation. Đây là hàng rào chống cấu hình nhầm, không thay quyền database hoặc chống người có credentials tự viết script khác.

## Ma trận kết nối

| Ngữ cảnh | Database được phép |
| --- | --- |
| Vercel Production có tín hiệu hợp lệ hoặc local `next start` không có tín hiệu cloud/CI | Giữ database hiện có trong URI, kể cả spacare_live; không yêu cầu biến mới |
| Vercel Preview/Development, NODE_ENV=development, CI ngoài Production | spacare_dev, spacare_test, spacare_demo |
| NODE_ENV=test, SPACARE_ENV=test hoặc Node test runner | Chỉ spacare_test |
| Local không khai báo môi trường | Runtime chỉ spacare_dev, spacare_test, spacare_demo |
| SPACARE_ENV=development / demo | Tên tương ứng spacare_dev / spacare_demo |
| CLI maintenance/import | Local spacare_dev/spacare_test; live/prod chỉ khi opt-in vận hành chính xác |
| Seed/dev demo | Chỉ spacare_demo, không chạy trong Vercel |

Môi trường mâu thuẫn, tên DB thiếu/mã hóa/mơ hồ, query dbName/database override và SPACARE_TARGET_DATABASE không khớp đều bị chặn. authSource=admin vẫn hợp lệ. Sau kết nối và khi tái dùng kết nối có sẵn, kiểm tra tên DB thực tế. Guard không thay URI hoặc tự chuyển database. Không dùng riêng NODE_ENV=production để nhận diện Preview: VERCEL_ENV=preview vẫn hạn chế DB.

Runtime production giữ tương thích cấu hình cũ để tránh gián đoạn. Không tự chuyển spacare_live sang spacare_prod. Đổi tên DB và quyền cloud nằm ngoài PR.

## CLI vận hành hợp lệ

Các script giữ nguyên tham số, OWNER/password/batch approval/idempotency hiện có. Trước lệnh nhập liệu/migration đã được duyệt vào DB vận hành, người vận hành cần đặt biến riêng cho tiến trình CLI:

- SPACARE_ENV=operations
- SPACARE_TARGET_DATABASE=spacare_live (hoặc spacare_prod, đúng DB đã được duyệt)
- Không chạy trong dev/test/CI/Vercel; không đặt chế độ operations vào môi trường web app.

Hai biến này là xác nhận đích, không phải quyền ghi hay thay thế mã duyệt. Không chạy lệnh live để kiểm tra PR. CLI sandbox spacare_dev/spacare_test không cần opt-in live. Các script setup-cash-cards/setup-service-groups vẫn giữ giới hạn sandbox cũ; guard mới không mở thêm quyền.

`push:setup` kiểm cả URI trong file cấu hình đích và URI shell trước ghi khóa, không cho shell sandbox che file live; không chạy công cụ này trong deployment/production runtime.

`backup-live.mjs` cũng kiểm môi trường trước gọi công cụ dump, vẫn chỉ hỗ trợ spacare_live; không thay đổi định dạng hoặc quy trình restore. `--check`/preview ngoại tuyến không ghi dữ liệu và giữ nguyên hành vi.

## Selenium

Không còn URL mặc định. Bắt buộc SELENIUM_ENV=test hoặc staging và SELENIUM_BASE_URL là một origin rõ ràng, không credentials/path/query/hash.

Local: dùng app test riêng, ví dụ http://127.0.0.1:3100, phải được cấu hình spacare_test. Guard URL không thể chứng minh DB mà server từ xa đang sử dụng.

Staging từ xa: yêu cầu HTTPS và SELENIUM_ALLOWED_ORIGIN trùng chính xác origin đích. Không coi một hostname lạ là staging tự động. Domain spacare-rho.vercel.app, subdomain của nó, cùng hostname từ VERCEL_PROJECT_PRODUCTION_URL/SELENIUM_PRODUCTION_ORIGIN bị từ chối. Khi có domain production mới, khai báo SELENIUM_PRODUCTION_ORIGIN; không đưa domain đó vào allowlist. APP_ORIGIN chỉ mô tả origin app, không dùng làm denylist production; staging HTTPS trùng APP_ORIGIN vẫn hợp lệ. Không chạy Selenium trong ngữ cảnh Vercel Production.

Chrome được chặn request/redirect tới các hostname production đã biết trước điều hướng đầu tiên; remote driver thiếu CDP sẽ dừng thay vì bỏ guard. Không thể tự phát hiện mọi alias production chưa khai báo. Dùng staging có dữ liệu giả và credentials riêng; không chạy Selenium trên production.

## Kiểm thử và triển khai

Unit/model doubles dùng URI synthetic spacare_test, không đọc env thật hoặc kết nối live. Integration/workbook chỉ được spacare_test và kiểm DB thực tế trước mutation. Unit test chứa chuỗi tên DB live để kiểm từ chối nhưng không kết nối tới chúng.

Triển khai đề xuất: review diff; kiểm thử CI bằng mock/DB test; dựng Preview với credentials sandbox; xác nhận Production đã có VERCEL_ENV=production (không cần đổi URI); triển khai code trong đợt được duyệt riêng. Không rollback về cấu hình Preview có quyền truy cập live. Local dev đang trỏ live sẽ bị chặn có chủ đích; chuẩn bị môi trường dev riêng trước khi dùng.

Không thêm field/index hoặc đổi ma trận quyền. Ngoại lệ sửa rollback: ba embedded snapshot Invoice.treatmentSessions, packageItems, productItems khai báo versionKey:false; giữ strict:throw, không migration/backfill hoặc thay dữ liệu cũ. Lỗi guard ở API được chuẩn hóa thành 503 với code SAFETY_GUARD_BLOCKED, không log URI/token/password. Không chạy migration/seed/import khi build.


## Cloud identity fail-closed

Khi có VERCEL, VERCEL_TARGET_ENV, VERCEL_URL, deployment/project/region hoặc Git marker của Vercel, bắt buộc VERCEL_ENV hợp lệ. Nếu VERCEL_TARGET_ENV được cung cấp phải khớp VERCEL_ENV. VERCEL nếu có phải là 1. Tín hiệu thiếu/mâu thuẫn bị chặn trước driver, kể cả URI sandbox. Không suy Production từ NODE_ENV trong cloud. Hiện chỉ hỗ trợ ba môi trường chuẩn production/preview/development; custom target chưa hỗ trợ và bị chặn.

CI thông thường không dùng live. Build Production của Vercel được phép khi có VERCEL=1 và VERCEL_ENV=production (target nếu có phải khớp); không chặn nhầm CI=1 do Vercel cung cấp. Runtime Production không cần thêm SPACARE_ENV, không thay URI hiện tại. Nếu mọi tín hiệu cloud bị tắt, code không thể tự phân biệt local next start với cloud; phải bật System Environment Variables và dùng credentials Preview chỉ có quyền sandbox. Preview nên đặt SPACARE_ENV=test và SPACARE_TARGET_DATABASE=spacare_test, cùng MONGODB_URI riêng. Không đưa opt-in operations vào web runtime.

## Input vận hành riêng và dữ liệu cá nhân

Script bổ sung quyền lợi giữ tên lệnh cũ để tương thích, nhưng bắt buộc `--check|--write --file imports/tệp-riêng.json`. JSON gồm batch và source {name,phone,startsOn,expiresOn,services}; đúng 3 dịch vụ riêng biệt, thời hạn 36 tháng. Chỉ đọc file JSON trong imports sau resolve đường dẫn; chặn traversal/link ra ngoài, file quá 64 KiB và input không hợp lệ. OWNER, Control transaction, snapshot/majority, audit và idempotency giữ nguyên. Giữ batch và source của đợt đã duyệt khi chạy lại: không đổi batch để né chống trùng. Không có chế độ tự chạy ghi khi build.

Bảng ánh xạ khách của import triệt lông được đọc từ imports/hair-removal-aliases.private.json (array {phone,source,existing}); thiếu hoặc sai file phải dừng, không đoán ánh xạ. Hai trường phone và tên NFC phải cùng khớp. Các input vận hành đã có được bảo toàn ở file ignored trên máy; không đưa vào commit. Log script bổ sung chỉ báo số lượng, không in tên/điện thoại/hồ sơ chi tiết. Ví dụ tổng hợp: docs/examples/supplement.synthetic.json và docs/examples/aliases.synthetic.json. Không dùng ví dụ để nhập dữ liệu thật.

Các dữ liệu cá nhân đã có ở HEAD được loại khỏi working tree và fixture. Lịch sử Git chưa được rewrite; đánh giá xóa lịch sử/phạm vi đã chia sẻ trong công việc riêng, không force-push từ PR này. Quét working tree không thay thế kiểm tra lịch sử hoặc quyền Atlas/Vercel.


## CSRF Origin cho Vercel Preview — 27/10/2026

POST /api/auth/login gọi checkOrigin trước parse input/kết nối DB. Production và local giữ allowlist APP_ORIGIN chính xác; cấu hình phải là HTTP(S) origin hợp lệ. Preview được nhận diện bởi VERCEL=1, VERCEL_ENV=preview và VERCEL_TARGET_ENV nếu có phải là preview: chỉ chấp nhận HTTPS origin khớp chính xác VERCEL_URL hoặc VERCEL_BRANCH_URL do Vercel cung cấp. Không dùng APP_ORIGIN Production làm fallback cho Preview, không tự tin VERCEL_PROJECT_PRODUCTION_URL, Host, X-Forwarded-Host, request URL hay wildcard *.vercel.app. Thiếu/sai Origin vẫn 403; metadata Preview thiếu/mâu thuẫn không mở allowlist. Các route dùng checkOrigin chung được cùng bảo vệ; SameSite=Strict và cookie httpOnly/secure không đổi.

Cần bật System Environment Variables để các giá trị Vercel có ở runtime. Không tự điền URL từ request vào biến môi trường. Alias tùy ý ngoài hai system URL không được tự chấp nhận. Production Safety Guards không thay đổi: Preview cấu hình SPACARE_ENV=test, SPACARE_TARGET_DATABASE=spacare_test và credentials riêng chỉ có quyền DB test. Origin hợp lệ không cấp quyền truy cập live. Không cần đổi cấu hình Production.
