# SpaCare — Business Requirements

Cập nhật: 20/10/2026. Phạm vi: MVP nội bộ Next.js + MongoDB.

## Nhu cầu

Spa hiện ghi thu chi bằng sổ. SpaCare tập trung lịch hẹn, khách hàng, dịch vụ, cọc, công nợ, liệu trình và đối chiếu tiền cuối ngày để giảm ghi chép rời rạc.

## Nguồn và thẩm quyền

- Tài liệu chuyển đổi hiện có: `DESIGN.md`, mục C01–C09, dẫn nguồn BRD SpaCare v1.1 ngày 19/10/2026. Bản BRD gốc không nằm trong repository; tài liệu này là bản tổng hợp, không giả nhận đã đọc lại bản gốc.
- Các câu trả lời spa đã cung cấp: cọc dư giữ lần sau; dừng liệu trình không hoàn tiền; chỉ chủ spa sửa khoản thu chi; có thể xác nhận buổi bằng hình thức khác và phải lưu lý do.
- Yêu cầu người dùng ngày 20/10/2026: kiểm tra trùng email/SĐT, thêm sửa/xóa nhân viên và dịch vụ. Thiết kế xóa mềm vChủ spa (OWNER), nhân viên (STAFF). Phân quyền truy cập xác nhận 21/10/2026: Giao diện điều hướng theo menu phân cấp; STAFF truy cập Tổng quan, Vận hành (Lịch hẹn, Khách hàng), Dịch vụ & liệu trình (Gói liệu trình, Buổi đã sử dụng), Tài chính (Hóa đơn & công nợ, Tiền cọc, Sổ thu chi), và Quản trị (Lương và Hoa hồng của chính mình). Nhân viên trực tiếp phục vụ được xác nhận tiền thực nhận và phân bổ cọc cho khách mình phụ trách. OWNER truy cập toàn bộ hệ thống (thêm Danh mục dịch vụ, Chốt sổ ngày, Thống kê dòng tiền, Danh sách nhân sự, Nhật ký thao tác, và xem Lương/Hoa hồng toàn bộ nhân sự). Quyền thu ngân riêng (cashier flag) vẫn giữ cho các hành động tài chính khác; việc nhân viên có được lập hóa đơn dịch vụ không gắn với lịch hẹn hay không vẫn chưa chốt (BR-OPEN-001).

## Phạm vi MVP

- Đăng nhập, quản lý khách, dịch vụ, nhân viên, sửa thông tin và thay đổi trạng thái.
- Đặt lịch theo nhân viên/dịch vụ, hoàn thành/hủy, kiểm tra giao nhau.
- Hóa đơn một dịch vụ, thu từng phần, công nợ, nhận và phân bổ cọc.
- Gói nhiều buổi, nhật ký từng buổi đã dùng với tham chiếu xác nhận.
- Thu/chi, đảo sai sót, mở/chốt/mở lại sổ, báo cáo dòng tiền và audit.
- Giao diện menu phân cấp, thu gọn/mở rộng nhóm, mỗi mục con mở trang riêng biệt.
- Theo dõi sản lượng phục vụ nhân sự (ca làm hoàn thành, buổi liệu trình đã ghi). Trang Lương và Hoa hồng hiển thị phân quyền (nhân viên xem của mình, chủ spa xem toàn bộ) kèm trạng thái OPEN cho các quy chế/công thức tài chính chưa chốt.

## Chưa triển khai / cần quyết định

Chưa có thanh toán tự động, xác minh chuyển khoản, chữ ký điện tử, tải tệp bằng chứng, xuất Excel, reset mật khẩu, đặt lịch công khai, ca làm/phòng/giường, workflow hoàn tiền. Chưa có: action bán gói một luồng (BR-PKG-001), kiểm tra và nhắc hạn sử dụng gói (BR-PKG-003), bảo lưu gói (BR-PKG-004), mở rộng quyền payment/allocate cho nhân viên phục vụ (BR-ACCESS-002). Các câu hỏi chưa chốt (BR-OPEN): nhân viên lập hóa đơn không gắn lịch (BR-OPEN-001), thời hạn cụ thể từng gói và tiêu chí/người duyệt bảo lưu (BR-OPEN-002), phương án thay thế khi app không khả dụng để xác nhận buổi (BR-OPEN-003), ngoại lệ hoàn tiền khi spa hủy (BR-OPEN-004), quy trình mở lại hoặc xử lý khoản ghi nhầm đã chốt sổ (BR-OPEN-005), cách ghi nhận doanh thu gói/dịch vụ (BR-OPEN-006), triệt lông tính theo buổi hay cả liệu trình (BR-OPEN-007), cách tính giá trị phần gói chưa dùng khi đổi dịch vụ (BR-OPEN-008), mốc bắt đầu tính thời hạn gói từ ngày mua hay ngày dùng đầu (BR-OPEN-009), số ngày chính xác và mốc tính thời hạn trả nợ gói (BR-OPEN-010), công thức tính hoa hồng (BR-OPEN-011), quyền quản lý xem lương/hoa hồng nhân viên khác (BR-OPEN-012), quy chế tiền lương và chu kỳ chốt lương (BR-OPEN-013). Không tự suy ra chính sách cho các mục này.

## Tiêu chí nghiệm thu

Đối chiếu ví dụ trong BUSINESS_RULES; kiểm thử quyền và transaction trên database riêng; kiểm tra giao diện tiếng Việt và mobile. Đối chiếu sổ thực tế trước khi đưa vào vận hành. Test thuần đạt không thay thế kiểm thử tích hợp hoặc nghiệm thu của chủ spa.

Tham chiếu: `API.md`, `DATA_MODEL.md`, `DESIGN.md`, `VALIDATION.md`.

Cập nhật 20/10/2026: bổ sung hoãn/dời/hủy có lý do cho tình huống khách đến sớm/muộn. Chi tiết trạng thái là thiết kế MVP trong BR-TECH-008; chưa có check-in, thời gian trễ cho phép hay phí đổi lịch.

Cập nhật 20/10/2026: ưu tiên liên kết lịch dịch vụ lẻ với hóa đơn. OWNER/thu ngân xác nhận hoàn thành và tạo/liên kết hóa đơn cùng giao dịch; thu tiền, áp cọc vẫn riêng. STAFF thường chỉ hoàn thành lịch, chờ người có quyền xử lý hóa đơn. Liên kết lịch với gói được bổ sung ở cập nhật tiếp theo bên dưới.

Cập nhật lịch gói/thanh toán: đặt lịch có thể chọn gói đúng khách/dịch vụ còn buổi; hoàn thành gói ghi xác nhận và trừ một buổi, dịch vụ lẻ tạo invoice. Hóa đơn theo dõi chưa trả/trả một phần/đã trả, nhận CASH/BANK_TRANSFER có xác nhận thực nhận. QR tài khoản là ảnh cấu hình thủ công, chưa có QR động/webhook.

Cập nhật 21/10/2026: xác nhận phân quyền giao diện STAFF (BR-ACCESS-001); nhân viên phục vụ được xác nhận tiền và phân bổ cọc (BR-ACCESS-002, chưa có code). Bán gói một luồng là nhu cầu CONFIRMED chưa có code (BR-PKG-001). Thêm chính sách: khách dùng gói trước, thanh toán 1–2 tuần (BR-PKG-002); thời hạn gói theo loại dịch vụ (BR-PKG-003); bảo lưu tùy trường hợp (BR-PKG-004); dừng gói không hoàn tiền nhưng có thể đổi sang dịch vụ tương đương (BR-TRT-002 bổ sung). Khi xếp lại lịch hoãn, xác nhận tạo lịch mới thay vì cập nhật bản ghi cũ; code hiện tại cần xét lại (BR-TECH-008). Rà soát và cập nhật trạng thái các câu hỏi mở BR-OPEN-001 đến BR-OPEN-010 theo phản hồi mới nhất của chủ spa. Triển khai menu phân cấp có thể thu gọn/mở rộng, mỗi mục con mở trang riêng biệt; trang Lương và Hoa hồng hiển thị sản lượng phục vụ thực tế và phân quyền xem dữ liệu (nhân viên xem của mình, chủ spa xem toàn bộ) kèm trạng thái OPEN cho các chính sách tài chính chưa chốt (BR-OPEN-011, BR-OPEN-012, BR-OPEN-013).� một phần/đã trả, nhận CASH/BANK_TRANSFER có xác nhận thực nhận. QR tài khoản là ảnh cấu hình thủ công, chưa có QR động/webhook.

Cập nhật 21/10/2026: xác nhận phân quyền giao diện STAFF (BR-ACCESS-001); nhân viên phục vụ được xác nhận tiền và phân bổ cọc (BR-ACCESS-002, chưa có code). Bán gói một luồng là nhu cầu CONFIRMED chưa có code (BR-PKG-001). Thêm chính sách: khách dùng gói trước, thanh toán 1–2 tuần (BR-PKG-002); thời hạn gói theo loại dịch vụ (BR-PKG-003); bảo lưu tùy trường hợp (BR-PKG-004); dừng gói không hoàn tiền nhưng có thể đổi sang dịch vụ tương đương (BR-TRT-002 bổ sung). Khi xếp lại lịch hoãn, xác nhận tạo lịch mới thay vì cập nhật bản ghi cũ; code hiện tại cần xét lại (BR-TECH-008). Rà soát và cập nhật trạng thái các câu hỏi mở BR-OPEN-001 đến BR-OPEN-010 theo phản hồi mới nhất của chủ spa: phân biệt rõ nội dung đã biết và nội dung còn mở; xác nhận buổi thực hiện trên app và không tự kết luận ảnh chụp nhóm chat là đủ (BR-OPEN-003); giữ nguyên trạng thái mở cho các nội dung chưa được chốt.


## Cập nhật ưu tiên theo yêu cầu mới nhất — 21/10/2026

Menu phân cấp có thể thu gọn/mở rộng, dùng chung cấu hình cây trên desktop và mobile. Tổng quan tại `/`; mỗi mục hoạt động mở trang riêng `/workspace/{section}`, hỗ trợ tải lại và Back/Forward. Server kiểm tra phiên và quyền: services/staff/audit chỉ OWNER, days/reports OWNER hoặc thu ngân. Không thay đổi quyền ghi tài chính hay phạm vi dữ liệu API workspace.

Yêu cầu này thay thế mô tả trước về trang Lương/Hoa hồng hiển thị sản lượng: chỉ tạo trang hoạt động khi nghiệp vụ được xác định. Hiện hai mục chỉ ghi “Chưa triển khai”, không liên kết, không có trang hoạt động, schema hoặc API lương/hoa hồng. Không tạo kỳ lương giả hay suy ra hoa hồng từ người ghi buổi. Khi triển khai: backend lấy spaId/actorId từ phiên, STAFF chỉ xem của mình, OWNER xem toàn spa. BR-OPEN-011 (công thức/thời điểm hoa hồng), BR-OPEN-012 (quyền quản lý xem nhân viên khác), BR-OPEN-013 (quy chế và kỳ lương) giữ OPEN. Cấu hình route là thiết kế kỹ thuật; không chốt thêm chính sách tài chính.


## Luồng vận hành đã triển khai — 21/10/2026
Nguồn: yêu cầu mới nhất của người dùng. Mục này thay thế các mô tả “chưa có code” trước đó cho BR-PKG-001 và BR-ACCESS-002.
- Hoãn khi chưa biết ngày mới giữ POSTPONED; khi xếp lại tạo lịch CONFIRMED mới, lịch cũ nguyên thời gian và trạng thái. Không xóa cứng.
- Bán gói một form tạo hóa đơn và liệu trình liên kết trong transaction; chọn giá toàn gói, số buổi và hạn thanh toán đã thống nhất. Có thể dùng khi còn nợ, không mặc định số ngày trả nợ. Quá hạn cảnh báo, chế tài vẫn OPEN.
- Nhân viên phục vụ thu tiền hóa đơn lịch mình và hóa đơn gói được giao; đếm tiền mặt, xác nhận thực nhận, ghi chú/tham chiếu ảnh chuyển khoản đã gửi nhóm. Nhân viên phân bổ cọc cho cùng phạm vi hóa đơn; dư giữ lần sau.
- Không triển khai đổi gói/bảo lưu hay định giá số buổi còn lại khi chưa chốt; BR-OPEN-002/008/009/010 giữ phần chưa được xác nhận.


## Xác nhận mới nhất: ký trên màn hình và bảo lưu — 21/10/2026
Nguồn: yêu cầu người dùng trong phiên sửa code. Phần này thay thế các mô tả cũ 'chưa có chữ ký/bảo lưu', dùng mã phiếu cho buổi mới và phần chưa chốt về người duyệt bảo lưu.
- Có lịch gói: nhân viên hoàn thành ca, khách ký trên màn hình; lưu thành công mới hoàn thành lịch và trừ đúng một buổi. Không có lịch: mở gói và ghi buổi sau khi khách ký, không yêu cầu tạo lịch giả.
- Chữ ký trống/hủy không làm thay đổi dữ liệu. Chữ ký gắn khách, gói, buổi, người thực hiện và thời điểm; có thể tra cứu theo quyền. Phiếu lịch sử cũ giữ nguyên, không tạo chữ ký giả.
- OWNER duyệt bảo lưu theo lý do hợp lý từng trường hợp, nhập ngày kết thúc theo từng gói; giữ nguyên số buổi. Gói đang bảo lưu không được dùng, kể cả đã hết thời gian nhập. Chỉ OWNER mở lại. Gia hạn bảo lưu và gia hạn sử dụng là hai quyết định riêng, không tự cộng ngày.
- Chưa chốt giá trị phần gói khi đổi dịch vụ, hạn gốc/mốc tính hạn theo loại gói, phương án xác nhận khi app không dùng được và các OPEN khác vẫn giữ nguyên.


## Bỏ trần lịch sử danh sách - 22/10/2026

Nguồn: yêu cầu người dùng bỏ giới hạn 500 ở các danh sách còn lại và bỏ thông báo giới hạn trên giao diện. Các danh sách tra cứu được toàn bộ lịch sử trong phạm vi spa/quyền; phân trang tại backend. Báo cáo khoảng ngày tổng hợp toàn bộ giao dịch phù hợp. Mục này thay thế các mô tả giới hạn tổng bản ghi trong bản MVP trước đây.


## Yêu cầu bán gói, quà tặng và hóa đơn — 22/10/2026 (ưu tiên mới nhất)
Nguồn: người dùng yêu cầu trong phiên và trả lời ba câu hỏi xác nhận. Thay thế phạm vi cũ hóa đơn chỉ lấy giá danh mục, bán gói nhập lại từng lần và buổi gói không có hóa đơn.
- OWNER khai báo danh mục gói (dịch vụ, tên, số buổi, giá); khi bán chọn gói và khách. Gói đã bán giữ snapshot, sửa danh mục không đổi quyền lợi cũ.
- Lần bán có đợt khuyến mãi và nhiều gói tặng kèm. Quà tặng luôn 0đ, có số buổi riêng; không tạo dòng tiền/công nợ mới cho phần tặng.
- Dịch vụ cấu hình hoa hồng bằng số tiền cố định. Chưa chốt thời điểm hưởng, đối tượng hưởng/chia hoa hồng, hoa hồng quà tặng và kỳ trả: giữ các phần này OPEN, không tự lập bảng lương hoặc trả hoa hồng.
- Khách có người tư vấn mặc định; lần bán có thể chọn người khác. Hóa đơn ghi tên người tạo từ phiên và người tư vấn; không suy đoán người tạo hóa đơn cũ.
- Hóa đơn chọn dịch vụ rồi cho chỉnh nội dung/giá khi tạo. Dịch vụ lẻ có tiền phải trả; chọn liệu trình phù hợp, khách ký và ghi buổi thì hóa đơn 0đ. Thanh toán tiền gói mua ban đầu vẫn riêng, không xóa nợ gói khi dùng buổi.
- Ẩn mục nhật ký thao tác/buổi dùng khỏi menu, chuyển tra cứu vận hành vào hóa đơn và lịch sử khách. Dữ liệu audit/buổi/chữ ký vẫn giữ, quyền xem cũ được bảo toàn.


## Tham khảo luồng Thu ngân EasySalon — 22/10/2026
Nguồn: người dùng yêu cầu xem và tham khảo https://my.easysalon.vn/cashier để làm SpaCare. Đã quan sát màn thu ngân, tìm khách, danh mục dịch vụ có tên/giá, tab gói và phần hóa đơn xem trước. Không suy ra quy tắc tài chính từ giao diện tham khảo. Hóa đơn nháp trống mở để xem giao diện đã được đóng; không xác nhận thanh toán hay nhập khách/dịch vụ vào hệ thống tham khảo.
SpaCare bổ sung trang Thu ngân riêng: chọn/tìm khách hoặc thêm khách tại chỗ; chọn dịch vụ lẻ, bán gói hay dùng liệu trình; danh mục dạng thẻ và hóa đơn xem trước; chỉnh nội dung/giá, nhập khuyến mãi/quà tặng, tư vấn; lưu rồi thu tiền qua form xác nhận hiện có. Không sao chép dữ liệu khách, danh mục hoặc thông tin đăng nhập từ hệ thống tham khảo. Phạm vi mỗi hóa đơn vẫn theo dịch vụ/gói hiện tại, không thêm giỏ nhiều dịch vụ, sản phẩm, thẻ trả trước, thuế hay chính sách giảm giá chưa xác nhận.


## Tham khảo các phân hệ EasySalon — 22/10/2026
Nguồn: người dùng yêu cầu tham khảo cả chức năng khác. Đã đọc trực tiếp giao diện khách hàng (tìm kiếm/lịch sử/lịch gần nhất), lịch hẹn (hôm nay/7 ngày/khoảng ngày/nhân viên), danh mục dịch vụ (nhóm/giá/trạng thái bán), thu chi (phương thức/người tạo), quản lý nhân viên (các khu vực lương). Chỉ tham khảo bố cục và cách tra cứu, không sao chép dữ liệu hay mặc định dùng chính sách của hệ thống khác.
SpaCare bổ sung hồ sơ khách có số liệu trong quyền đọc và tab lịch sử, thao tác đặt lịch/thu ngân; lịch theo ngày và lọc nhân viên/trạng thái/ngày; nhóm dịch vụ, lọc đang bán/ngừng; hóa đơn lọc còn nợ/quá hạn/đã trả/quà/buổi0; cọc lọc còn dư/hết; sổ quỹ lọc ngày/phương thức/người tạo/thu-chi với tổng toàn bộ bộ lọc; hồ sơ nhân viên và sản lượng thực tế. Kho, nhà cung cấp, CSKH gửi tin, thẻ tiền mặt, chấm công và công thức lương không tự triển khai từ giao diện tham khảo vì chưa có nghiệp vụ tương ứng được xác nhận.


## Triển khai lương và hoa hồng — 22/10/2026 (ưu tiên mới nhất)
Nguồn: người dùng yêu cầu triển khai và trả lời lựa chọn trong phiên: lương tháng + hoa hồng; ghi nhận khi hoàn thành dịch vụ; người trực tiếp thực hiện hưởng; buổi trong gói tặng0đ vẫn hưởng như bình thường. Các nội dung này thay thế mô tả trước về chưa triển khai Lương/Hoa hồng và phần OPEN tương ứng.
- Cài lương cơ bản từng nhân viên. Bảng lương tháng gồm lương cơ bản + hoa hồng + thưởng/phụ cấp nhập tay − khấu trừ nhập tay; điều chỉnh phải có lý do.
- Hoa hồng cố định riêng dịch vụ, ghi một lần theo ca/buổi hoàn thành, không phụ thuộc tiền khách trả. Bán gói không tự sinh hoa hồng thực hiện; từng buổi ký mới sinh. Quà tặng cũng ghi như buổi thường.
- Nhân viên (kể cả thu ngân) chỉ đọc của mình. OWNER cài/lập/duyệt/ghi chi và đọc toàn spa. Không tạo vai trò quản lý mới.
- Kỹ thuật PROPOSED: nháp → duyệt → đã chi; số liệu duyệt khóa, chi ghi CashEntry thực tế trong ngày đang mở. Hoa hồng chưa gắn bảng lương đến hết tháng gồm cả khoản tồn từ trước; khoản phát sinh sau duyệt để kỳ sau, không sửa bảng đã duyệt. Không tự tính công/giờ, thuế/bảo hiểm hoặc quy chế thưởng/phạt.
- Ghi nhận mới từ các lần hoàn thành sau triển khai. Không tự backfill hoa hồng công việc đã hoàn thành trong lịch sử bằng mức giá hôm nay; đối soát lịch sử cần quyết định riêng.


## Cài hoa hồng theo dịch vụ — 22/10/2026
CONFIRMED theo yêu cầu người dùng: có nút Tạo hoa hồng trên trang Hoa hồng, chọn dịch vụ và nhập mức tiền cố định (ví dụ Gội đầu 10.000đ, Nặn mụn 20.000đ). Không tạo khoản hưởng thủ công cho nhân viên bằng nút này.

## Cập nhật lịch hẹn - 23/10/2026
Theo yêu cầu người dùng: giờ hoạt động 09:00–22:00 theo giờ Việt Nam. Khung giờ bắt đầu trên trang đặt lịch cách nhau 30 phút và phụ thuộc thời lượng dịch vụ để dịch vụ kết thúc không muộn hơn 22:00. Lịch theo ngày trong workspace dùng trục thời gian ngang theo nhân viên. Backend kiểm tra cả lịch mới và lịch dời; lịch cũ ngoài giờ vẫn giữ và được đánh dấu.

## Kiểm tra kín lịch trên web - 23/10/2026
Theo yêu cầu người dùng: khi khung giờ đã kín, thông báo rõ cho khách chọn giờ khác. Kiểm tra toàn bộ thời lượng theo từng nhân viên, kể cả lịch tạo bởi spa; nếu còn nhân viên rảnh thì vẫn đặt được. Chống hai khách gửi đồng thời chiếm cùng ca và gửi lại yêu cầu tạo trùng lịch. Không hiển thị danh tính/lịch riêng của khách khác.

## Đơn giản phiếu kho - 23/10/2026
Theo yêu cầu người dùng 23/10/2026: nhập/xuất kho từ một sản phẩm dùng sẵn sản phẩm đó, chỉ nhập số lượng; bỏ ô lý do. Nút nhập/xuất chung vẫn chọn sản phẩm.

## Ảnh và danh mục sản phẩm công khai - 23/10/2026
CONFIRMED theo yêu cầu người dùng: chủ spa chọn/chụp ảnh sản phẩm bằng điện thoại thay cho nhập đường dẫn. Khách xem danh mục sản phẩm công khai có ảnh, tên, dung tích, giá và trạng thái còn hàng; trang /products hỗ trợ tìm tên và phân trang. Không bổ sung thanh toán trực tuyến.


## Báo cáo và nhân viên — 23/10/2026
PROPOSED kỹ thuật theo yêu cầu tiếp tục: báo cáo tách giá trị hóa đơn (ngày tạo, thanh toán hiện tại), thu chi (ngày ghi sổ), kết quả nhân viên (ngày phát sinh). Không chốt doanh thu kế toán BR-OPEN-006. OWNER xem nhân viên; OWNER/thu ngân xem báo cáo tài chính. Tổng hợp toàn bộ bộ lọc cùng spa trước phân trang; CSV chỉ xuất tổng hợp.
GET /api/payroll view=salary thêm salarySummary: [{_id: DRAFT|APPROVED|PAID, count, total}] theo tháng/nhân viên trên toàn bộ dữ liệu. STAFF chỉ xem mình; danh sách nhân sự không gồm CUSTOMER. Không thay schema hoặc action chi lương. Buổi thiếu staffId không suy người thực hiện từ actorId. UI chung thẻ tổng hợp và liên kết Nhân viên/Bảng lương/Hoa hồng, thẻ mobile hai cột. Hai URL EasySalon chưa truy cập được trong phiên này.


## BR-LEAVE-001 — Thống kê nghỉ — 23/10/2026
CONFIRMED: nghỉ có phép/không phép chỉ để thống kê, chủ spa quyết định khi chốt lương; không tự động khấu trừ, thay lương hoặc hủy lịch. PROPOSED kỹ thuật: OWNER ghi/sửa ngày nghỉ; STAFF xem chính mình. Một ngày nguyên/người, chưa suy chính sách nửa ngày hay quy trình xin phép.
StaffLeave: spaId, staffId, staffName snapshot, day YYYY-MM-DD, type PERMITTED|UNPERMITTED, note, actorId, timestamps. Unique (spaId,staffId,day), index (spaId,day desc). Không xóa lịch sử audit.
POST /api/operations action recordStaffLeave {staffId,day,type,note?}: OWNER, cùng spa, nhân sự OWNER/STAFF; upsert theo người/ngày trong transaction guard có idempotency và audit before/after. Không ghi tài chính. GET /api/payroll view=salary thêm leaves (10/trang), leavePage, leaveTotal, leaveSummary [{_id:{staffId,type},count}], lọc tháng/nhân viên và phạm vi phiên trước tổng hợp/phân trang. UI trong Lương thống kê toàn tháng, danh sách ngày và nút ghi/sửa dành OWNER.


## Cập nhật ưu tiên mới nhất — 23/10/2026: nhập liệu, nghỉ và hoa hồng bán gói
Nguồn CONFIRMED: PROMPT CẬP NHẬT SPACARE trong phiên hiện tại. Thay thế BR-LEAVE-001 trước đó về chỉ thống kê: nay có duyệt, nửa ngày và cấu hình tính lương. Thay thế phạm vi cũ không có hoa hồng bán hàng bằng hoa hồng bán gói 5% trên thực thu đủ điều kiện; giữ nguyên hoa hồng thực hiện dịch vụ cố định.
CONFIRMED: OWNER duyệt và sửa bản nghỉ đã duyệt; có phép không đồng nghĩa hưởng lương; không suy ngày công từ lịch hẹn. OWNER cấu hình và chốt lương. Tiền lưu nguyên VNĐ, giao diện vi-VN. Không bắt mã sản phẩm, lý do/nội dung nhập kho; giữ dữ liệu lịch sử.
PROPOSED kỹ thuật đang áp dụng (không phải quy chế spa đã xác nhận):
- Bản nghỉ có startDay/endDay (gồm ngày cuối), period FULL/AM/PM cho mỗi ngày trong khoảng, type PERMITTED/UNPERMITTED, status PENDING/APPROVED/REJECTED, paid độc lập; reviewedBy/reviewedAt lưu lúc OWNER duyệt. STAFF gửi/sửa PENDING của mình; OWNER ghi/sửa mọi bản. Legacy thiếu status tiếp tục được xem là ngày đã ghi, paid=false, không bịa người duyệt. Không tính bản từ chối/chờ duyệt vào lương.
- Kiểm tra overlap theo ngày + sáng/chiều trong transaction Control chung. Nghỉ trùng công đã ghi bị từ chối; công không trùng nghỉ đang giữ chỗ; hai nửa khác buổi có thể cùng ngày. Công thực tế nhập bởi OWNER, không nhận ngày tương lai.
- Chính sách riêng từng người: standardDays, paidLeaveDays theo THÁNG, mode NONE hoặc DAILY. NONE/không cấu hình giữ lương tháng. DAILY yêu cầu OWNER xác nhận đủ dữ liệu công; earnedBase=round(baseSalary*min(standardDays,workdays+min(paidLeaveDays,nghỉ đã duyệt paid))/standardDays). Không tự coi thiếu lịch là nghỉ. Không tự tính OT, thuế, BHXH, phép tích lũy/năm. Giá trị 26 trong form chỉ gợi ý chưa lưu, không phải chính sách mặc định.
- Một Payroll hiện có: tổng = earnedBase + serviceCommissionTotal + saleCommissionTotal + bonus - deductions - advance; leaveDeduction chỉ là phần đã giảm trong earnedBase, không trừ lần hai. advance là khoản đã nhận do OWNER nhập, không ghi thêm dòng tiền; chưa có sổ tạm ứng riêng. Thiếu công khi DAILY trả lỗi. Lương âm bị từ chối, cần quy trình bù trừ riêng. Chốt kiểm tra fingerprint ngày nghỉ/công/chính sách và tập hoa hồng trước khi khóa. Sửa nguồn sau khi chốt không sửa bảng đã duyệt.
- Hóa đơn PACKAGE mới snapshot sellerId/sellerName tách consultant và performer. Không backfill người bán cho hóa đơn cũ. Giá đủ điều kiện là tổng giá bán sau giảm, phần đã thanh toán; cọc thực nhận sau khi phân bổ vào gói được tính một lần, không tính khi mới nhận cọc. Công thức cộng dồn floor((paid-refunded)/20), phát sinh delta nên chia đợt không sai làm tròn. Quà 0 và công nợ chưa thu không tạo hoa hồng bán.
- SaleCommission là ledger bổ sung để giữ nguyên unique index Commission dịch vụ cũ, không phải bảng lương thứ hai. Unique (spaId,sourceType,sourceId). Cùng payment/allocation/refund/reversal và idempotency/audit trong transaction. Điều chỉnh âm vào kỳ chưa chốt kế tiếp, không sửa khoản/bảng đã chi.
- refundPackage chỉ ghi hoàn ĐÃ THỰC HIỆN, OWNER xác nhận ngoại lệ và lý do. Không tự cho quyền hoàn khi khách dừng gói (BR-TRT-002 giữ), không dùng reverseCash làm hoàn tiền, không tự chuyển tiền. Cộng refunded riêng; paid giữ tổng đã thanh toán, không tái tạo công nợ từ tiền hoàn. Không tự đổi buổi/quyền lợi khi hoàn; điều kiện được hoàn và cách xử lý quyền lợi còn OPEN. REFUND không cho đảo bằng reverseCash thông thường.
- SKU cũ giữ nguyên khi sửa nếu không gửi; tạo mới sinh nội bộ SP-ObjectId, không phải trường nhân viên nhập. Phiếu kho vẫn chỉ số lượng như module đang có, chi mua hàng vẫn ghi riêng trong sổ thu chi; không thêm hoặc đổi chính sách giá nhập.
Cần xác nhận trước dùng tính lương thực tế: công chuẩn, hạn mức phép theo tháng hay năm/cộng dồn, cách làm tròn, OT/ngày lễ, quản lý sổ tạm ứng và bù trừ hoa hồng âm vượt lương; điều kiện ngoại lệ hoàn tiền/quyền lợi sau hoàn.


## Thông báo và hotline — 23/10/2026
CONFIRMED theo yêu cầu người dùng: thêm chuông và push trên điện thoại cho chủ spa khi có đặt lịch online; hotline 0329357116. Chi tiết kỹ thuật PROPOSED, cấu hình và giới hạn: PUSH_NOTIFICATIONS.md.


## Tài khoản nhân viên dùng số điện thoại — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: thêm/sửa nhân viên dùng số điện thoại thay email; đăng nhập số điện thoại và mật khẩu. Giữ tài khoản/email lịch sử để không khóa người dùng cũ.


## Bỏ ô tham chiếu ảnh chuyển khoản — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: bỏ trường nhập tham chiếu ảnh chuyển khoản trong form thu tiền hóa đơn; không bắt ghi chú thay thế. Quy tắc này thay yêu cầu ghi tham chiếu/ghi chú ảnh khi thu chuyển khoản trước đây. Vẫn bắt xác nhận đã kiểm tra tài khoản và thực nhận tiền, giữ quyền, trạng thái ngày, transaction, idempotency và audit. PROPOSED kỹ thuật: paymentEvidence dùng chung chỉ kiểm tra receivedConfirmation; transferReference vẫn là trường tùy chọn trong API/schema và giữ toàn bộ dữ liệu lịch sử. Không thay quy trình xác nhận buổi liệu trình/chữ ký; tham chiếu chi lương riêng không thuộc thay đổi này.


## Trạng thái sổ hôm nay và mở sổ lặp — 23/10/2026
PROPOSED kỹ thuật theo yêu cầu sửa lỗi danh sách trống nhưng mở sổ báo đã tồn tại: GET workspace thêm todayDay cho OWNER/thu ngân, query trực tiếp cùng spa/ngày Việt Nam và độc lập bộ lọc/phân trang. Trang days không áp dụng từ khóa search vì không có ô tìm kiếm; vẫn giữ lọc trạng thái/khoảng ngày. UI hiển thị rõ hôm nay chưa mở/đang mở/đã chốt; đã mở không hiện nút tạo thêm, đã chốt chỉ OWNER có Mở lại với lý do. openDay trên sổ OPEN trả sổ hiện có, không đổi tiền đầu ngày, không tạo sổ thứ hai; sổ CLOSED trả 409 và không tự mở lại. Giữ transaction, idempotency và audit snapshot thực tế. Không thay chính sách ai được mở/chốt/mở lại hoặc ghi đè dữ liệu lịch sử.


## Xuất PDF hóa đơn và hoa hồng - 23/10/2026
CONFIRMED: PDF để tải, in hoặc chia sẻ hóa đơn khách hàng và bảng kê hoa hồng theo nhân viên/tháng trên máy tính và điện thoại.
PROPOSED kỹ thuật: API chỉ đọc từ phiên active và cùng spa. OWNER xem phạm vi spa; STAFF giữ quyền đọc hóa đơn hiện có, chỉ xuất hoa hồng của mình. Không ghi tài chính hoặc xác nhận thu tiền/chi lương. Bảng kê lấy toàn bộ tháng theo giờ Việt Nam, tách dịch vụ/bán gói, giữ điều chỉnh âm.
