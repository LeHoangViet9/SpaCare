# Selenium E2E SpaCare

Bộ test Node.js + Selenium WebDriver thao tác Chrome thật. URL mặc định:
https://spacare-rho.vercel.app/workspace (base origin được tách tự động).
Selectors lấy từ giao diện production đã quan sát ngày 26/10/2026 và mã nguồn
login, workspace, cashier; không suy đoán ID phần tử.

## Cài và chạy (PowerShell, Node >=24 + Google Chrome)

```powershell
npm install --no-save selenium-webdriver@4
$env:SELENIUM_IDENTIFIER = 'tai-khoan-owner-test'
# Nhập bí mật mà không ghi vào lịch sử lệnh:
$secret = Read-Host 'Mật khẩu tài khoản test' -AsSecureString
$env:SELENIUM_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
$env:SELENIUM_HEADLESS = '0'
npm run test:selenium
Remove-Item Env:SELENIUM_PASSWORD
```

Selenium Manager tự tìm/tải ChromeDriver phù hợp, cần mạng ở lần đầu.
Không dùng tài khoản/mật khẩu của hệ thống tham khảo EasySalon.
Tài khoản phải là OWNER đang hoạt động; không có credentials: ca cần đăng nhập
SKIP và tiến trình trả mã 2, không báo toàn bộ suite đạt.

Tùy chọn: `SELENIUM_BASE_URL` (origin hoặc URL workspace),
`SELENIUM_HEADLESS=1` (mặc định), `SELENIUM_REMOTE_URL` (Selenium Grid).
Có thể tạo `.env.selenium.local` (được gitignore) và dùng
`node --env-file=.env.selenium.local tests/selenium/workspace.e2e.mjs`.
Không commit thông tin đăng nhập.

## Phạm vi / ánh xạ test case

| ID | Các bước chính | Mong đợi |
|---|---|---|
| SEL-AUTH-00 | Mở workspace không phiên; đọc API workspace | Về login kèm returnTo; API 401 |
| SEL-AUTH-UI | Mở login | Heading, trường bắt buộc, mật khẩu ẩn, link đăng ký/home |
| SEL-AUTH-EMPTY | Submit form trống | Form invalid, vẫn ở login |
| SEL-AUTH-TOGGLE | Nhập chuỗi giả; hiện/ẩn | Đổi type, giữ giá trị |
| TC-AUTH-02-UI | Đúng tài khoản, sai mật khẩu một lần | Lỗi xác thực; không vào workspace |
| TC-AUTH-01 | OWNER đăng nhập; reload | Role OWNER; dashboard giữ phiên |
| SEL-DASH-01 | Mở dashboard desktop | Heading, nội dung, đăng xuất, không tràn ngang |
| SEL-ROUTE-* (7 ca) | Mở/reload khách, lịch, thu ngân, hóa đơn, gói, cọc, sổ | Đúng heading, không lỗi ứng dụng |
| SEL-FLOW-SEARCH | Tìm khách bằng chuỗi giả; reload | URL và ô tìm kiếm giữ bộ lọc |
| SEL-FLOW-CASHIER | Chuyển 4 danh mục; bấm danh sách hóa đơn | Danh mục active, chuyển đúng trang |
| SEL-DASH-MOBILE | Resize 390x844, cuộn, mở menu vận hành/khách | Không tràn ngang; menu sát đáy; điều hướng đúng |
| SEL-AUTH-LOGOUT | Đăng xuất; truy cập lại workspace | Cookie phiên mất; về login |

`TC-AUTH-01/02` dựa trên docs/TESTING.md; TC-AUTH-02-UI chỉ là phần browser
của ca gốc, API không cookie được kiểm tra riêng ở SEL-AUTH-00.
Các SEL-* là ca bổ sung, không tuyên bố thay thế toàn bộ test case nghiệp vụ.
Mobile là viewport Chrome desktop, chưa chứng minh hành vi Safari/iPhone thực.

Luồng chính hiện là smoke test đọc/điều hướng: đăng nhập -> dashboard -> khách/
lịch -> thu ngân -> hóa đơn -> đăng xuất. Không tạo khách/lịch, thu tiền,
giảm kho/buổi, ký, xóa hay chốt sổ trên production. Ca giao dịch end-to-end
trong docs/TESTING.md (cọc 500k, hóa đơn 350k, phân bổ 350k, dư 150k) vẫn cần
môi trường app riêng dùng spacare_test và fixture; chưa tự động hóa trong suite này.
Đăng nhập và polling của app vẫn có thể cập nhật session/thông báo theo ứng dụng.

## Báo cáo

Mỗi lần chạy tạo `outputs/selenium/<timestamp>/report.json` và `report.md`.
PASS/FAIL/SKIP/BLOCKED được ghi từ thực tế. Exit 0 = tất cả PASS,
1 = FAIL/BLOCKED, 2 = có SKIP. Không ghi mật khẩu, cookies, DOM hay dữ liệu khách.
Ảnh lỗi mặc định tắt; `SELENIUM_SCREENSHOTS=1` chỉ bật với spa dữ liệu giả
vì ảnh có thể chứa thông tin khách. Không đưa outputs lên git.

## Giới hạn xác minh khi xây dựng

Đã quan sát trực tiếp production chuyển workspace về login, xác nhận các
trường/nút/link trên login. Chưa có tài khoản test để xem dashboard production.
Môi trường tạo bộ test bị lỗi DNS registry.npmjs.org nên chưa cài được
selenium-webdriver/ChromeDriver và chưa chạy E2E. Chạy lệnh trên máy có mạng
để lấy actual result; không coi các ca đã PASS trước khi thực thi.

## Sửa lỗi giới hạn đăng nhập (26/10/2026)

Suite dùng chung phiên sau TC-AUTH-01, không xóa cookie và đăng nhập lại cho
mỗi ca đọc. Một lượt chạy bình thường chỉ gửi 2 yêu cầu đăng nhập (1 sai,
1 đúng). Ca logout nằm cuối. Backend vẫn giữ giới hạn 10 lần/15 phút.
Nếu đăng nhập bị từ chối hoặc giới hạn, ca báo LoginRejected/LoginRateLimited;
các ca phụ thuộc tiếp theo BLOCKED. Report ghi bước cuối để phân biệt timeout
đăng nhập với timeout giao diện. Không tự retry đăng nhập liên tục.
Nếu vừa chạy phiên bản cũ và bị giới hạn, chờ tối đa 15 phút trước khi chạy lại.
