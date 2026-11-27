# Cache ảnh sản phẩm và xử lý bản cũ

Ngày rà soát: 27/11/2026. Chỉ thay mã/tài liệu; chưa deploy, purge cache, sửa Docker hoặc sửa dữ liệu production.

## Chính sách trong mã

| Route | Quyền | Cache phản hồi mới |
|---|---|---|
| `/api/product-images/{id}` | Phiên OWNER/STAFF active, ảnh cùng spa; URL tương thích cũ | `Cache-Control: private, no-store, max-age=0`; `CDN-Cache-Control: no-store`; `Vercel-CDN-Cache-Control: no-store` |
| `/api/product-images/v2/{id}` | Dùng chính handler/quyền của route trên | Cùng ba header trên; namespace mới tránh cache key immutable cũ |
| `/api/s/{slug}/products/{productId}/image` | Spa active/publicEnabled và sản phẩm active cùng spa, file GridFS cùng spa | Cùng ba header trên; không fallback sang phiên nội bộ |

Áp dụng cả ảnh 200 và lỗi 401/403/404/500/503, tránh cache ảnh riêng tư hoặc giữ lỗi cũ sau khi quyền thay đổi. Không đặt `s-maxage`, `stale-while-revalidate`, `stale-if-error` hoặc `immutable`. Không dùng ETag/Last-Modified làm đường tắt bỏ qua kiểm tra quyền. Request có validator cũ vẫn phải qua kiểm tra quyền và trạng thái hiện tại.

Header no-store là chỉ dẫn cho cache tuân thủ chuẩn, không phải biện pháp thu hồi dữ liệu đã nhận. Không thêm Pragma vì không cần cơ chế HTTP/1.0. Tradeoff: mỗi request ảnh mới phải đi qua backend, tăng số lần đọc MongoDB so với cache công khai lâu.

## Nơi có thể giữ ảnh

- Trình duyệt: HTTP cache trên đĩa/bộ nhớ, ảnh đã giải mã trong tab, lịch sử và bản người dùng tự lưu.
- CDN/proxy trước ứng dụng: repository có `vercel.json`, nhưng chưa kiểm tra cấu hình CDN đang chạy trên production. `next.config.ts` hiện không có quy tắc ép cache. Header Vercel riêng có độ ưu tiên cao hơn header thông thường trên Vercel; proxy ngoài vẫn phải tôn trọng/no override chính sách này.
- Next.js: route force-dynamic; các nơi dùng ảnh sản phẩm hiện dùng `<img>`, không qua bộ tối ưu `next/image`. Nếu sau này thêm image proxy/optimizer, phải kiểm tra riêng cache và quyền của proxy đó.
- `public/sw.js`: không có fetch handler/Cache API lưu ảnh hoặc API; chưa thấy offline cache ảnh trong mã hiện tại.
- Máy chủ ảnh bên ngoài: các URL tuyệt đối legacy giữ nguyên trong dữ liệu và giao diện nội bộ; ứng dụng không kiểm soát cache của máy chủ đó, và không xuất chúng trên trang sản phẩm công khai.

## Đổi URL mà không đổi dữ liệu

Thumbnail trong Products và preview trong ProductImagePicker đổi tham chiếu tương đối `/api/product-images/{id}` thành `/api/product-images/v2/{id}` **chỉ ở src hiển thị**. Hidden input, kết quả upload, Product.imageUrl, validation gắn ảnh và file GridFS giữ nguyên. Không tạo bản sao/xóa ảnh, không migration. Quyền v2 trùng route nội bộ cũ, kể cả ảnh chưa gắn và ảnh sản phẩm ngừng bán.

Route công khai theo slug vốn đã có namespace khác URL ảnh cũ nên giữ nguyên. Nó kiểm tra lại trạng thái công khai/sản phẩm cho từng request; thay đổi imageUrl trên sản phẩm không tạo quyền đọc file cũ. Các URL tuyệt đối legacy không được tự viết lại thành v2; không đoán host hoặc sửa dữ liệu để chuẩn hóa.

## Hướng dẫn purge khi được phép phát hành

Các bước dưới đây là runbook, **chưa thực hiện** trong lượt sửa này. Không thể dùng code mới để xóa bản đã cache mà request không tới origin.

1. Kiểm tra đúng project, môi trường và toàn bộ domain/alias trước khi thao tác. Bản phát hành phải chứa cả guard quyền và chính sách no-store; purge đơn thuần trong khi origin còn chính sách cũ có thể làm cache được nạp lại.
2. Với CDN có purge theo URL/prefix, loại các cache key ảnh cũ `/api/product-images/*` trên các host đã từng dùng. Nếu route public mới từng được cache sai, loại thêm `/api/s/*/products/*/image`. Kiểm tra biến thể query string theo cache key của nhà cung cấp; không giả định xóa một URL là xóa mọi biến thể.
3. Nếu dùng Vercel và cần purge toàn bộ CDN của project, tài liệu CLI chính thức có lệnh mẫu `vercel cache purge --type cdn`. Lệnh tác động **toàn bộ CDN cache của project đang được liên kết**, không chỉ ảnh. Chỉ người vận hành đã kiểm tra đúng scope mới chạy ở bước phát hành riêng. Không dùng `--type data`, không xóa MongoDB, không xóa GridFS/volume. Chưa chạy CLI này và chưa xác minh project production trong lượt sửa.
4. Sau phát hành/purge, kiểm tra GET lặp lại ở staging/đúng môi trường được phép, dùng dữ liệu tổng hợp. Xem `Cache-Control`, `CDN-Cache-Control`, `Age` và cache-status do nhà cung cấp trả. Không được có HIT phục vụ ảnh đã mất quyền. Vercel có thể tiêu thụ header `Vercel-CDN-Cache-Control`, nên header đó không nhất thiết hiện ở browser.
5. Kiểm tra: khách gọi URL cũ/v2 phải 401; nội bộ cùng spa 200, khác spa 404; public đúng sản phẩm 200; sau ngừng sản phẩm/tắt công khai trả 404 trên lần request tiếp theo, kể cả có `If-None-Match` cũ. Không chỉ kiểm tra ảnh cũ đang còn trên màn hình.
6. Purge CDN **không xóa cache trình duyệt**. Sau cập nhật, giao diện dùng v2 để không tái sử dụng cache key cũ. Tab còn chạy mã cũ, bookmark ảnh cũ và URL tuyệt đối legacy có thể vẫn giữ bản cũ; cần tải lại/xóa cache site ở trình duyệt đó nếu muốn loại bản cũ tại thiết bị. Không tự gửi Clear-Site-Data hoặc xóa cache site của người dùng trong thay đổi này.

**Ảnh đã được người dùng tải về, chụp lại hoặc sao chép thì không thể thu hồi.** Không cam kết TTL thu hồi cho cache cũ immutable một năm hoặc proxy cố tình bỏ qua no-store.

## Chẩn đoán DOCKER_CLI trên máy hiện tại

Runner `scripts/integration-runner.ts` dùng `spawn('docker', ['--version'], {shell:false})` trước mọi lệnh daemon/Compose và trước khi ghi fixture. Probe cùng cơ chế trả `{platform:win32,errorCode:ENOENT,status:null}`. `Get-Command docker,docker.exe` và `where.exe docker` không tìm thấy executable; các vị trí Docker Desktop/Rancher Desktop/LocalAppData/Scoop phổ biến đã kiểm tra cũng không có docker.exe.

Kết luận được chứng minh: tiến trình Node Windows hiện tại không tìm được Docker CLI trong PATH; runner dừng ở DOCKER_CLI. Chưa đủ bằng chứng để khẳng định Docker daemon không chạy hoặc Docker không được cài ở vị trí khác/WSL. Việc cổng 127.0.0.1:27018 mở không chứng minh đủ Docker CLI, đúng project Compose hoặc replica set.

Chưa sửa PATH, cài Docker, mở Docker Desktop, đổi context/daemon, gọi Compose, reset database hoặc xóa volume để khắc phục. Khi executable đã được người vận hành cung cấp cho môi trường phù hợp, chạy lại runner của dự án; không bỏ qua các guard bằng cách chạy integration trực tiếp trên database đang nghe cổng đó.

Nguồn đối chiếu: [RFC 9111, no-store](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5), [Vercel cache headers](https://vercel.com/docs/caching/cache-control-headers), [Vercel CLI cache](https://vercel.com/docs/cli/cache).
