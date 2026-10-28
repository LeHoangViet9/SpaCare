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


## Liệu trình theo số buổi hoặc thời gian — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: danh mục có hai loại lựa chọn: SESSIONS nhập số buổi, TIME nhập thời hạn và không giới hạn số lần làm (ví dụ triệt 24/36 tháng). Thay thế phần chỉ hỗ trợ số buổi trước đây và chốt BR-OPEN-007 trong phạm vi này. Cả hai loại vẫn ký, ghi lịch sử từng lần, hóa đơn buổi 0đ và hoa hồng thực hiện theo quy tắc hiện có; tài chính mua gói vẫn riêng.
PROPOSED kỹ thuật: PackageTemplate/Treatment bổ sung packageType, durationMonths (1–120); TIME không lưu totalSessions/remaining, Treatment snapshot startsOn/expiresOn YYYY-MM-DD và usedSessions. Mặc định dữ liệu cũ thiếu packageType là SESSIONS, không backfill hay thay quyền lợi gói đã bán. Mốc từ ngày mua hay lần đầu vẫn OPEN: khi bán TIME (kể cả quà) phải chọn startsOn theo thỏa thuận, không tự mặc định. Hạn tính cộng tháng lịch, chặn ngày không tồn tại, kẹp cuối tháng; bao gồm ngày đầu/cuối theo giờ Việt Nam.
API packageTemplate/updatePackageTemplate nhận packageType + totalSessions hoặc durationMonths, không cả hai; sellPackage thêm startsOn bắt buộc nếu gói chính/quà thuộc TIME. Tạo/gửi lại vẫn transaction + idempotency + audit và cùng spa. use/invoice/completeTreatmentAppointment giữ remainingBefore: số buổi còn với SESSIONS, bộ đếm usedSessions với TIME để bắt xung đột chữ ký (0 ở lần đầu). Ghi TIME tăng usedSessions, không giảm quota hoặc tự COMPLETED. Backend chặn chưa bắt đầu/hết hạn/bảo lưu khi ghi lần làm và kiểm tra ngày dự định khi tạo/dời lịch. Bảo lưu không tự cộng hạn; OWNER gia hạn riêng như hiện có.
Giao diện danh mục chọn loại rồi hiện đúng ô; bán gói chọn ngày bắt đầu và xem hạn. Danh sách/thu ngân/lịch sử/khách hàng hiển thị hạn và không giới hạn thay số buổi. Không đổi indexes, không chạy migration dữ liệu vận hành.


## Hoa hồng chủ spa và thông tin khách — 23/10/2026
CONFIRMED: chủ spa trực tiếp bán gói cũng được ghi nhận và hiển thị hoa hồng bán gói 5% như nhân viên theo tiền thực thu đủ điều kiện. Giữ quy tắc cũ về thời điểm hưởng, hoàn/đảo và chống trùng; không tự backfill người bán hoặc hoa hồng lịch sử. Trang Hoa hồng thêm bộ lọc nhanh Của tôi cho OWNER; danh sách người hưởng gồm OWNER/STAFF.
GET /api/payroll view=commission và PDF hoa hồng bổ sung customerName/customerPhone từ Customer cùng spa, chỉ truy vấn customerId có trong các khoản hoa hồng đã lọc theo quyền, tháng và trang (PDF toàn bộ phạm vi xuất). STAFF chỉ xem khoản của mình, không nhận danh sách khách toàn spa hay ghi chú khách. Dữ liệu thiếu khách hiển thị Chưa ghi nhận. Không thay schema/index, số tiền hoặc trạng thái bảng lương.


## Chủ spa không tham gia lương/chấm công — 23/10/2026
CONFIRMED theo yêu cầu mới nhất: Lương, chính sách lương, ngày công và nghỉ phép chỉ áp dụng cho STAFF; loại OWNER khỏi lựa chọn, danh sách, tổng hợp và phân trang. Chủ spa vẫn quản lý/duyệt/ghi chi lương nhân viên. Hoa hồng giữ OWNER/STAFF, chủ spa bán gói vẫn hưởng và xem hoa hồng theo quy tắc thực thu hiện hành. Nội dung này thay phần trước cho phép OWNER là người nhận lương/chấm công.
PROPOSED kỹ thuật: GET /api/payroll view=salary giao scope được phép với IDs STAFF cùng spa trước mọi count/aggregate/page; view=commission giữ phạm vi cũ. Backend từ chối cấu hình/lập/duyệt/chi bảng lương, ghi công/nghỉ và duyệt nghỉ của OWNER; không chỉ ẩn trên UI. Không xóa hay sửa bảng lương/chấm công/hoa hồng lịch sử; bản OWNER cũ được giữ trong database nhưng không đưa vào danh sách/tổng lương hiện hành. Không thay schema/index hoặc tự chuyển khoản hoa hồng chủ spa thành chi lương.


## Chia hoa hồng bán gói cho nhiều người tư vấn — 23/10/2026
CONFIRMED: bán liệu trình có nút + Người cùng tư vấn; tổng quỹ hoa hồng vẫn 5% tiền thực thu đủ điều kiện, chia đều cho những người được chọn, không phải mỗi người 5%. OWNER vẫn được tham gia và hiện hoa hồng nhưng không thuộc lương/chấm công. Chỉ chia hoa hồng bán gói, không thay hoa hồng thực hiện dịch vụ.
PROPOSED kỹ thuật: sellPackage nhận participantIds? (1–20 IDs không trùng, gồm OWNER/STAFF active cùng spa); nếu thiếu giữ tương thích sellerId hoặc user phiên. sellerId truyền kèm phải khớp phần tử đầu. Snapshot Invoice.saleParticipants=[{staffId,staffName}], giữ sellerId/sellerName đầu danh sách cho tương thích; không có action sửa nhóm sau bán, không backfill nhóm hóa đơn cũ.
Gói một người giữ saleCommissionVersion=1/SaleCommission. Nhiều người dùng version=2 và SharedSaleCommission bổ sung: spaId,staffId,staffName,invoiceId,serviceId,serviceName,customerId,category=PACKAGE_SALE,sharedSale=true,sourceType/sourceId,shareCount,amount,earnedAt,payrollId. Unique (spaId,sourceType,sourceId,staffId), index (spaId,staffId,earnedAt desc). Không đổi/xóa unique index ledger cũ. Khởi tạo bổ sung bằng npm run db:commission-shares (hoặc db:setup với cấu hình seed cũ); không chạy vào DB vận hành trong phiên sửa code.
Quỹ cộng dồn = floor((paid-refunded)/20). Phân số nguyên đồng: chia thương và dư theo staffId chuẩn hóa tăng dần (không phụ thuộc thứ tự chọn); mỗi người ghi chênh lệch quyền hưởng cộng dồn trước/sau sự kiện. Vì vậy thu nhiều đợt/đảo/hoàn có tổng và phần từng người đúng như thu một lần, lệch tối đa 1đ ở quyền hưởng cộng dồn. Không đổi người hưởng khi họ đổi tên/ngừng hoạt động sau bán.
Payment/Allocation/refund/reversal giữ transaction tuần tự, Control guard, idempotency, audit; ledger share ghi cùng transaction và snapshot invoice tổng accrued. Không tăng 5% theo số người, quà 0đ/công nợ chưa thu không phát sinh. Khoản điều chỉnh âm vào phần chưa chốt, không sửa bảng đã duyệt/chi.
Đọc hoa hồng/PDF/báo cáo union cả hai ledger với cùng scope người dùng/spa/tháng; STAFF chỉ xem phần của mình. Payroll thêm sharedSaleCommissionIds; tổng bán gói gồm cũ và chia, duyệt khóa IDs cả hai ledger, không đưa khoản của OWNER vào lương STAFF. Giao diện hiển thị số người chia và phần tiền của từng người, giữ thông tin khách. Preview lúc bán chỉ là dự kiến khi thu đủ.


## Một bảng tổng hợp lương và công/nghỉ — 23/10/2026
Theo yêu cầu mới nhất: trang Lương chỉ có một bảng chung theo nhân viên/tháng, đủ lương cơ bản, công/nghỉ, lương tính, hai loại hoa hồng, thưởng/phụ cấp, phạt/khấu trừ, tạm ứng, tổng thực nhận, trạng thái và thao tác. Bỏ các khối cài lương/công/nghỉ độc lập trên trang chính; Công/nghỉ mở hộp quản lý riêng cho người được chọn, Cài đặt và Tính lương nằm trên dòng. Phạt vẫn là khoản deductions nhập tay có lý do, không tự đặt mức phạt.
PROPOSED kỹ thuật: GET payroll view=salary phân trang theo STAFF trong phạm vi, trả một dòng mỗi nhân viên (kể cả chưa có Payroll); chưa lập dùng status=NOT_CREATED, _id uncreated-ID chỉ phục vụ hiển thị, không ghi Payroll giả. Tổng thực nhận/lương theo công/thưởng/phạt chưa tính hiển thị Chưa tính hoặc dấu gạch, không giả thành 0. Preview hoa hồng lấy toàn bộ khoản chưa chốt đến hết tháng giống savePayroll, gồm tồn kỳ trước. Các tổng salarySummary vẫn chỉ cộng bảng lương đã lưu. Mọi tham chiếu cùng spa/quyền như trước.
Rows thêm currentWorkdays/currentLeaveStats cho công/nghỉ thực tế, tách khỏi snapshot đã tính lương; không thay đổi snapshot APPROVED/PAID khi nguồn công/nghỉ/hoa hồng thay đổi. Bấm Tính lương vẫn dùng transaction/idempotency/audit savePayroll và kiểm tra dữ liệu công theo chính sách. Không tự duyệt/ghi chi. Không đổi schema/index.


## Hiển thị thưởng và phạt trong bảng lương - 23/10/2026
CONFIRMED theo yêu cầu mới nhất: bỏ ba ô Lương nháp/Chờ chi/Đã chi trên trang Lương. Cột Thưởng tự hiển thị tổng hoa hồng dịch vụ + hoa hồng bán gói + thưởng/phụ cấp thêm; hai cột hoa hồng chỉ giải thích thành phần đã nằm trong thưởng, không cộng hai lần vào thực nhận. Chưa lập lương vẫn hiện hoa hồng tạm tính. Phạt/khấu trừ tự hiển thị deductions đã lưu trong bảng lương; chủ spa nhập khoản và lý do khi tính/cập nhật nháp. Không tự suy mức phạt từ nghỉ hoặc đi muộn, không thay snapshot đã duyệt/chi, schema, API hay công thức tài chính.


## Nhập danh mục thật và lịch chỉ ghi giờ đến — 24/10/2026
CONFIRMED: người dùng yêu cầu nhập danh mục Excel và chọn “Chỉ ghi giờ đến”. Không bắt thời lượng dịch vụ; lịch mới/dời lịch chỉ có startAt trong 09:00–22:00 giờ Việt Nam, không suy giờ kết thúc hay chặn nhân viên theo khoảng thời gian. Spa tự cân đối ca; cho phép nhiều lượt đến cùng giờ. Thay yêu cầu trước về chống chồng lịch/kín lịch bằng thời lượng. Giữ idempotency, quyền cùng spa, transaction, audit và lịch hoãn tạo bản mới. duration/endAt cũ giữ để tra lịch sử; dời lịch CONFIRMED bỏ endAt sau khi audit before, lịch POSTPONED cũ không đổi.
CONFIRMED: dịch vụ có hoa hồng cố định mỗi lần; triệt lông trong bảng có cả giá lẻ và gói TIME 36 tháng không giới hạn lượt, bắt đầu ngày mua (kể cả gói tặng cùng loại). Backend sellPackage dùng ngày Việt Nam tại giao dịch khi service.category=TRIỆT LÔNG và template TIME/36; không lấy startsOn do client gửi cho nhóm này. Gói khác giữ ngày thỏa thuận. Không backfill gói cũ.
PROPOSED kỹ thuật: đặt online tạm giao OWNER active đầu tiên, fallback nhân viên đầu tiên theo _id để spa sắp xếp lại; không coi đó là nhân viên đang rảnh. Timeline ô một mốc cho lịch mới, không biểu thị thời lượng; phản hồi đặt online không trả duration. Service create/update không bắt duration; trường legacy nếu gửi vẫn kiểm tra 5–480. Không đổi schema/index.
PROPOSED kỹ thuật: npm run db:import-catalog đọc XLSX trên Windows, tối đa 10 MB/1000 dòng, sheet đầu, không công thức; mặc định chỉ xem trước, không kết nối DB. --write yêu cầu --database khớp URI, chủ active xác thực lại bằng mật khẩu từ env (công cụ vận hành cục bộ, không phải endpoint công khai; không nhận spaId từ file). Không tạo session web mới; scope lấy từ User trong transaction. Một transaction cho toàn file, Control guard tuần tự, audit từng dòng và Idempotency catalog-v1 theo tên/nhóm chuẩn hóa. Chạy lại cùng nội dung bỏ qua; khác nội dung/trùng danh mục đang có thì dừng, không ghi đè. Không tạo hóa đơn/thu chi/công nợ hay khoản hoa hồng phát sinh.
Giá theo khoảng: thêm cột Giá mặc định (VNĐ), hoặc người chạy chủ động chọn --use-min-price. Đây là giá mặc định kỹ thuật, không chốt giá khách; khoảng gốc/ghi chú lưu trong Audit.details.source, chưa có field khoảng giá trong Service/UI. Triệt lông tạo Service giá lẻ từ cột Giá lẻ (VNĐ) hoặc ghi chú “Giá lẻ: ... đ/lần”, và PackageTemplate TIME/36 giá gói từ cột Giá từ/Giá đến. Hoa hồng 0 được giữ. Không nhập thời lượng giả. CLI không xóa/reset dữ liệu. Hướng dẫn: IMPORT_CATALOG.md.


## BR-CARD-001 — Thẻ tiền mặt khách hàng — 24/10/2026
CONFIRMED theo yêu cầu người dùng: khách mua riêng thẻ (ví dụ 800.000đ), phải thực trả đủ mới phát hành/dùng; dùng cho dịch vụ lẻ (ví dụ 400.000đ còn 400.000đ), không dùng mua gói hoặc sản phẩm. Thiếu số dư được thu thêm tiền mặt/chuyển khoản. Cả thẻ mua và thẻ tặng không hết hạn, không hoàn hoặc đổi tiền mặt. Khi bán gói có thể tặng thẻ với mệnh giá nhập riêng (ví dụ gói 3.000.000đ tặng thẻ 800.000đ); thẻ tặng không làm tăng tiền thực thu. Không đồng nhất thẻ với tiền cọc.
PROPOSED kỹ thuật: OWNER/STAFF có cashier được bán thẻ và phát hành quà cùng sellPackage; nhập đợt khuyến mãi khi tặng. Quà phát hành ngay trong transaction bán gói; chưa chốt quy chế riêng cho gói chưa thu đủ hoặc ngừng/hoàn gói có quà thẻ, nên không tự suy cách thu hồi/đổi giá trị. Bản đầu chặn refundPackage và updateInvoice khi đã phát hành thẻ tặng, để tránh mất đối chiếu; cần spa quyết định workflow xử lý ngoại lệ trước khi hỗ trợ. Bán thẻ chưa sinh hoa hồng bán gói 5%; hoa hồng dịch vụ giữ quy tắc thực hiện hiện hành. Không tự chốt doanh thu kế toán BR-OPEN-006.
PROPOSED kỹ thuật: dùng thẻ theo quyền thu tiền hóa đơn hiện có (OWNER/thu ngân hoặc STAFF phụ trách lịch); cùng spa và cùng khách, chỉ SERVICE hoặc hóa đơn legacy có serviceId và không có liên kết liệu trình. Nhân viên chọn thẻ, số tiền trừ và phần thu thêm, xác nhận trước lưu; không tự trừ chỉ vì mở hóa đơn. Mỗi lần dùng yêu cầu sổ hôm nay đang mở, transaction snapshot/majority với Control guard + Idempotency + Audit. Không âm số dư, không trả vượt công nợ, không dùng thẻ người khác, không ghi CashEntry cho phần trừ thẻ. Quy trình chuyển thẻ, nạp thêm, đảo sử dụng và sửa sai tiền mua thẻ còn OPEN; không triển khai hoàn bằng reverseCash.


## Trang thẻ tiền mặt tham khảo EasySalon — 24/10/2026
CONFIRMED: người dùng yêu cầu tham khảo https://my.easysalon.vn/cashcard để tổ chức giao diện thẻ. Đã quan sát trang danh sách rỗng, tìm theo tên/SĐT, cột mã/trạng thái/khách/số dư/hạn/thời gian và hộp Tạo mới. Chỉ mở/xem rồi hủy form, không tạo thẻ hay sửa dữ liệu ở hệ thống tham khảo. Yêu cầu mới thay thiết kế trước chỉ đặt thẻ trong hồ sơ khách bằng mục riêng Tài chính → Thẻ tiền mặt (/workspace/cash_cards). Giữ cả lối vào hồ sơ khách và thanh toán từ hóa đơn dịch vụ lẻ.
PROPOSED kỹ thuật: OWNER/thu ngân được mở danh sách toàn spa và tạo thẻ trả đủ qua action sellCashCard hiện có. STAFF thường không xem danh sách toàn spa, giữ quyền dùng thẻ theo hóa đơn được giao. Bảng gồm mã tự sinh từ ID (TM-ID), trạng thái theo số dư, tên/SĐT khách, mệnh giá, số tiền hiện tại, nguồn mua/tặng, Không thời hạn và ngày tạo theo giờ Việt Nam; tìm theo mã hoặc tên/SĐT, lọc nguồn/số dư, phân trang 10 dòng ở backend, chi tiết thẻ chỉ hiện lịch sử đúng cardId. Bộ lọc/trang lưu trên URL cardSearch/cardStatus/cardOrigin/cardPage. Mobile cuộn trong bảng, không tràn toàn trang.
Không suy chính sách mới từ EasySalon: không tự thêm hết hạn, bảo lưu, đồng sở hữu, nạp thêm, hoàn/đổi tiền; không tạo thẻ 0đ ngoài luồng quà bán gói. API GET /api/cash-cards thêm view=list&search=&status=AVAILABLE|EXHAUSTED&origin=PURCHASE|GIFT&page=1; bắt OWNER/STAFF cashier ở backend, spaId lấy từ phiên, lookup khách cùng spa chỉ trong trang kết quả, regex tìm kiếm được escape. GET hiện tại thêm cardId? để giới hạn thẻ và ledger cùng khách/spa; không thay quyền STAFF. Không thay schema/index/transaction hay dữ liệu đang dùng. Rollback UI/API list không xóa thẻ hoặc số dư và phải giữ các guard tài chính hiện có.


## Nhóm dịch vụ và chọn dịch vụ cho gói — 24/10/2026
CONFIRMED theo yêu cầu người dùng: form thêm/sửa dịch vụ chọn nhóm có sẵn, có tạo nhóm riêng; form tạo gói mẫu phải chọn dịch vụ đã khai báo. Form hóa đơn/bán gói có lọc nhóm, gói hiển thị tên dịch vụ đi kèm. PROPOSED kỹ thuật: ServiceGroup {spaId,name,nameKey,actorId,timestamps}, unique (spaId,nameKey); nameKey chuẩn hóa NFC/khoảng trắng/chữ thường, giữ dấu tiếng Việt. OWNER tạo nhóm qua operations action serviceGroup {name}, xác thực lại active/role DB, scope từ phiên, Control guard/transaction/idempotency/audit; kiểm tra trùng cả registry và category legacy. Không tự thêm quyền cho MANAGER/STAFF. Chưa có sửa/xóa nhóm.
Service.category vẫn là chuỗi, không đổi schema dịch vụ hoặc chuyển dữ liệu cũ. Danh sách chọn nhóm hợp nhất ServiceGroup.name và Service.category cũ cùng spa; nhóm chưa có dịch vụ vẫn được lưu. Nhập nhóm mới trong form dịch vụ lưu category khi lưu dịch vụ; lần sau có thể chọn lại từ category này. Không tự sao chép danh mục spacare_live sang spacare_dev. Form Thêm gói mẫu dùng select nhóm option theo dịch vụ active; nếu danh mục dev trống hiển thị hướng dẫn thêm dịch vụ trước và chặn lưu form rỗng. Sửa gói cũ vẫn hiển thị dịch vụ ngừng đã gắn, backend giữ kiểm tra active hiện có.
GET workspace thêm serviceGroups [{_id,name}] cho OWNER tại services/package_catalog; truy vấn cùng spa. Bổ sung script db:service-groups chỉ tạo collection/index mới trong spacare_dev/spacare_test, từ chối production/Vercel production; không chạy trong phiên sửa code. Production cần duyệt bước tạo index riêng, không chạy db:setup để cập nhật tính năng. Rollback không xóa category/nhóm/dịch vụ; không cần backfill.


## Áp thẻ ngay khi tạo hóa đơn — 24/10/2026
CONFIRMED theo yêu cầu người dùng: khi tạo hóa đơn dịch vụ lẻ có thể chọn thẻ tiền mặt hiện có của đúng khách và áp dụng ngay. Giữ giới hạn chỉ dịch vụ lẻ, không áp cho mua gói/sản phẩm/buổi liệu trình. Chọn thẻ là tùy chọn, không tự trừ chỉ vì khách có thẻ.
PROPOSED kỹ thuật: invoice nhận cashCard? {cardId,amount,additionalAmount?,method?,receivedConfirmation?}; tạo Invoice và gọi cùng logic redeemCashCard tuần tự trong một transaction với Control guard, idempotency và audit hiện có. Số dư/khách/spa/công nợ/quyền/sổ ngày được kiểm tra lại ở backend; lỗi bất kỳ rollback cả hóa đơn, số dư, ledger và phần thu thêm. Phần thẻ chỉ tăng paid/cardPaid, không tạo dòng tiền; chỉ phần thu thêm tạo Payment/CashEntry và phải xác nhận thực nhận. UI Thu ngân và form Tạo hóa đơn dùng danh sách thẻ phân trang của khách, không mặc định chọn, hiện số dư/công nợ sau thanh toán. Đổi khách/dịch vụ/giá hoặc dùng liệu trình bỏ lựa chọn cũ. Không đổi schema/index, không migration hay sửa dữ liệu cũ/production. Rollback giao diện không xóa ledger, phải giữ backend hiểu paid/cardPaid và guard CARD_SALE.


## Nhập số dư lịch sử — 24/10/2026
CONFIRMED: người dùng cung cấp bảng khách, xác nhận thêm 0 đầu SĐT, tiền ghi thiếu 000 được hiểu theo nghìn đồng, các dòng trống thuộc khách ngay phía trên; Gđ là Gội đầu, Cơ bản là Mặt cơ bản, dương sinh là dưỡng sinh. Số buổi là còn lại; các liệu trình đã trả đủ. 23 khách, 29 liệu trình/107 buổi, 4 thẻ còn 12.950.000đ, riêng nợ mỹ phẩm 7.000.000đ. Dữ liệu cá nhân nguồn chỉ lưu imports/ bị Git bỏ qua. Người dùng yêu cầu hoàn thiện công cụ rồi nhập live; chưa ghi production trong phiên.
PROPOSED kỹ thuật: CLI import-opening-balances mặc định preview ngoại tuyến. --check chỉ đọc DB với OWNER active xác thực lại; so sánh cùng spa, khớp tên dịch vụ NFC/khoảng trắng/chữ thường còn dấu hoặc mapping ID được duyệt. Không tự tạo dịch vụ thiếu, không gộp hồ sơ khác tên cùng SĐT, không cộng đè quyền lợi/thẻ/công nợ có sẵn. --write cần database khớp URI và dữ liệu nguồn, mã đợt ổn định, --approve hash báo cáo đối chiếu và --app-ready xác nhận code tương thích đã deploy; Control guard/transaction snapshot+majority tuần tự, batch Idempotency unique, audit ID các bản mới. Kiểm tra collection/index trước nhập, không tự setup/index vào production. Chỉ cho spacare_live/dev/test, không đổi URI.
Schema bổ sung không backfill/index mới: Invoice.openingBalance/openingDate; Treatment.openingBalance/openingRemaining; CashCard.origin thêm OPENING, openingDate/sourceLabel. Gói nguồn tạo chứng từ liên kết PACKAGE tổng=paid=0/status PAID với nhãn đã trả đủ trước chuyển đổi, không coi 0 là giá mua gốc hay quà tặng. Treatment chỉ remaining/openingRemaining, không bịa totalSessions, startsOn giữ ngày nguồn, chưa có expiresOn; báo cáo duyệt cảnh báo gói được dùng theo số buổi, chưa xác định hạn gốc. Số buổi mới đánh từ 1 kể từ chuyển đổi bằng usedSessions; không tái tạo buổi/chữ ký/hoa hồng cũ. Thẻ OPENING amount=balance=số dư chuyển, không phải mệnh giá gốc hoặc khoản thu mới; không tự tách phần mua/quà. Nợ cũ chứng từ PRODUCT không productId, không xuất kho, total=số còn nợ/paid=0; thu sau bằng payment hiện hành và không có hoa hồng bán gói. Không tạo CashEntry/Payment/Commission/SaleCommission lúc chuyển số dư; buổi thực hiện sau chuyển đổi vẫn hưởng theo quy tắc hiện hành.
UI/PDF ghi rõ chứng từ chuyển số dư, tổng gốc chưa có, 0 chỉ nghĩa không thu thêm; không hiển thị tiến độ dựa trên tổng buổi chưa biết. updateInvoice/refundPackage chặn chứng từ chuyển số dư. API operations không mở action import công khai; CLI xác thực OWNER từ DB. Rollback trước commit tự động toàn đợt; sau commit dùng báo cáo IDs/audit đối soát và kế hoạch sửa được chủ duyệt, không xóa/reset/restore tự động. Không quay về code không hiểu openingBalance/OPENING sau có dữ liệu; giữ patch tương thích hoặc khóa ghi. Backup và kiểm tra deploy trước ghi thật.


## Gộp bảng mặt và gội — xác nhận 24/10/2026
CONFIRMED: Yến Thương giữ 1 buổi Mặt cơ bản và 11 buổi Gội đầu dưỡng sinh 1; dòng GD 11 trong bảng gội là cùng quyền lợi, không cộng lần hai. Ng T Lệ Quyên còn 1 buổi Gội đầu cấp collagen và được tặng 1 buổi Laser Carbon. Khách thiếu SĐT giữ trống, không tự tạo số giả hoặc nhận SĐT khách phía trước.
PROPOSED kỹ thuật: openingInput.phone cho phép thiếu/null/chuỗi rỗng và chuẩn hóa thành undefined; duplicate detection chỉ kiểm số có thật. Khách thiếu SĐT không tự gộp với bất kỳ hồ sơ thiếu số khác, cùng tên có sẵn hoặc trùng tên trong nguồn phải đối chiếu riêng; tạo Customer không có field phone. Mã batch vẫn bảo vệ retry. Treatment input thêm gift/benefitNote tùy chọn, giữ quyền lợi mặt nạ thêm kèm trong tên liệu trình/chứng từ và audit, không cộng thành buổi gội hay tự đặt giá. Gói GD+CVG giữ nhãn kết hợp và phải ánh xạ với danh mục thực tế trước ghi. Gộp ngoại tuyến ra imports/opening-combined.review.json: 84 khách, 93 dòng quyền lợi/319 buổi, 6 thẻ số dư 14.310.000đ, riêng nợ mỹ phẩm 7.000.000đ; 3 khách chưa có số. Loại 3 dòng quyền lợi lặp và 1 thẻ lặp; lưu provenance hai nguồn trong file review bị Git bỏ qua. Chưa đối chiếu/ghi live.


## Xóa vĩnh viễn hóa đơn nhập nhầm chưa phát sinh — 25/10/2026
CONFIRMED theo yêu cầu mới nhất: chỉ OWNER được xóa hẳn hóa đơn nhập nhầm đã hủy, chưa thanh toán/áp cọc/thẻ, chưa phát sinh hoa hồng, thực hiện, lượt dùng hoặc liên kết vận hành. Ngoại lệ này thay quy tắc giữ mọi hóa đơn hủy trước đó; không cho xóa lịch sử tài chính hoặc dữ liệu đang được tham chiếu. Hồ sơ khách giữ nguyên.
PROPOSED kỹ thuật: deleteInvoice {id,expectedUpdatedAt,reason,confirmDelete:true}. Backend xác thực active OWNER/cùng spa, trạng thái CANCELLED, phiên bản mới nhất. Chặn openingBalance; paid/cardPaid/refunded/saleCommissionAccrued; performedAt/performedBy; appointmentId/treatmentId/treatmentUseId/giftOfInvoiceId/productId; kind PRODUCT/SESSION/GIFT. Kiểm tra Payment, Allocation, CashCardUse, Commission (kể cả đã hủy/0đ), SaleCommission, SharedSaleCommission, StockMovement, Treatment theo invoiceId/giftOfInvoiceId, hóa đơn quà và CashCard nguồn. Bất kỳ tham chiếu nào đều chặn 409, không cascade. Ngày lập đã chốt phải mở lại. Xóa Invoice và thông báo INVOICE_CREATED tuần tự trong transaction Control snapshot/majority; giữ audit/idempotency và nhật ký cũ, không sao chép thêm hóa đơn. Retry cùng khóa không xóa lại. Không tái dùng mã/giảm sequence. UI OWNER có Xóa vĩnh viễn ở danh sách/chi tiết hóa đơn hủy; bắt lý do và tích xác nhận không thể khôi phục. Không schema/index/migration mới; không xóa dữ liệu vận hành trong phiên triển khai.


## Xóa hóa đơn đã thu, nhập ngày hóa đơn, lịch gói và dịch vụ thêm — 25/10/2026
CONFIRMED yêu cầu mới nhất thay giới hạn chỉ xóa hóa đơn hủy chưa thanh toán: OWNER được xóa hóa đơn nhập sai đã thu và trừ số liệu liên quan. Hóa đơn có ngày tùy chọn, mặc định hiện tại; dùng gói 0đ có thể thêm dịch vụ lẻ phải trả trong cùng hóa đơn. Khi đặt lịch, chọn khách thấy các gói khả dụng của khách và chọn gói tự chọn dịch vụ; dịch vụ chọn bằng ô lớn.
PROPOSED kỹ thuật: deleteInvoice giữ active OWNER/phiên bản/idempotency/transaction; xử lý cả invoice và họ quà. Khoản Payment chưa đảo được đánh dấu reversed và có CashEntry REVERSAL OUT ngày hiện tại với originalId unique (không ghi là hoàn tiền thực tế); cần sổ hiện tại OPEN nếu có tiền. Allocation chưa đảo trả balance cọc; CashCardUse chưa đảo trả balance thẻ và lưu reversedAt; hoa hồng chưa gắn payrollId đưa về 0, Commission đánh dấu cancelledAt. Phiếu xuất bán được bù phiếu nhập MANUAL có audit; gói chưa dùng chuyển CANCELLED, thẻ tặng chưa dùng về 0. Xóa bản ghi hóa đơn chính, giữ lịch sử tiền/kho/audit/idempotency; thông báo tạo hóa đơn được gỡ. Hóa đơn quà giữ CANCELLED/0đ. Chặn chứng từ mở đầu, buổi đã ký, gói có lượt ký, gói còn lịch chờ, thẻ tặng đã dùng, hóa đơn đã hoàn và hoa hồng đã chốt/chi lương; không xóa dây chuyền các bằng chứng đó. Đây là giới hạn triển khai hiện tại, chưa phải hỗ trợ mọi ngoại lệ. Không reset dữ liệu thật.
issuedOn? YYYY-MM-DD chỉ nhận ở invoice/serviceInvoice/sellPackage/sellProduct; backend kiểm ngày thật/không tương lai. Khi có ngày, Invoice.createdAt dùng 12:00 giờ Việt Nam của ngày chọn để tra/báo cáo theo ngày; recordedAt giữ thời điểm nhập thật. Không có ngày giữ thời gian hiện tại. Thu tiền/cọc vẫn theo ngày thực ghi hiện tại, không backdate tiền. Gói triệt 36 tháng tính ngày mua đã chọn. Không tự backdate chữ ký/thực hiện/hoa hồng lịch sử.
invoice thêm additionalServices? [{serviceId,total}] tối đa 30, không trùng, dịch vụ active/cùng spa, giá dương. Nhánh treatmentId ghi buổi có chữ ký như cũ rồi trong cùng transaction thêm serviceItems (dòng gói 0đ + dòng lẻ), tổng phần lẻ và công nợ, cộng hoa hồng cố định vào Commission lần thực hiện cho cùng nhân viên. Hóa đơn kind SESSION có tổng dương khi có phần lẻ; không áp thẻ cho hóa đơn hỗn hợp trong phiên bản này. Lỗi rollback cả buổi/chữ ký/quyền lợi/hóa đơn/hoa hồng. Cashier cho chọn thêm ô dịch vụ lẻ và giá từng dòng trong Dùng gói. Gói khả dụng vẫn chịu điều kiện ngày/quyền lợi/bảo lưu tại backend. Không thêm indexes hoặc migration; schema mới Invoice.recordedAt, CashCardUse.reversedAt.


## Giữ giỏ liệu trình khi chuyển danh mục — 25/10/2026
CONFIRMED người dùng: khách dùng gói đã mua phải có thể thêm dịch vụ lẻ và sản phẩm trong cùng một lần thu ngân; chuyển tab không được thay thao tác làm mất gói đang chọn.
PROPOSED kỹ thuật: tách browseMode danh mục khỏi mode hóa đơn. Khi đã chọn gói, tab dịch vụ/sản phẩm thêm hoặc bỏ dòng trong giỏ, giữ gói/người thực hiện/chữ ký. Đổi khách xóa toàn bộ giỏ. Bán gói mới vẫn là luồng riêng (chọn tab này xóa giỏ hiện tại). Nhánh invoice có treatmentId thêm additionalProducts? [{productId,quantity,unitPrice}] tối đa 30, không trùng ID, giá/số lượng nguyên dương; kiểm product active/cùng spa/tồn kho và tổng tiền ở backend. Tạo Invoice.productItems snapshot tên/đơn vị/giá/số lượng/tổng; tổng hóa đơn = phần dịch vụ lẻ + sản phẩm, buổi gói vẫn 0đ. Không sinh hoa hồng bán sản phẩm. StockMovement.checkoutInvoiceId lưu tham chiếu hóa đơn hỗn hợp, không tái dùng invoiceId vì index unique cũ chỉ cho một phiếu/hoá đơn; không thay index đang vận hành. Xuất kho tuần tự cùng transaction ghi buổi/chữ ký/hoa hồng/hóa đơn, lỗi bất kỳ rollback cả lượt dùng và tất cả sản phẩm; idempotency giữ một lần trừ kho. API đọc/PDF hiển thị sản phẩm riêng. Không áp thẻ tiền cho hóa đơn hỗn hợp; không mở xóa hóa đơn đã có chữ ký. Không migration hay ghi dữ liệu vận hành trong phiên này.


## Một chữ ký tùy chọn cho hóa đơn — 25/10/2026 (ưu tiên mới nhất)
CONFIRMED theo yêu cầu mới nhất: mỗi hóa đơn chỉ ký một lần và chữ ký không bắt buộc. Yêu cầu này thay quy tắc phải ký từng liệu trình/phải có chữ ký mới ghi buổi trước đây. Hóa đơn có nhiều liệu trình vẫn ghi nhận từng lượt dùng và trừ đúng quyền lợi dù không ký; không thay kiểm tra quyền, spa/khách, trạng thái, remainingBefore, transaction, idempotency hoặc audit.

PROPOSED kỹ thuật: Thu ngân, form hóa đơn và hoàn thành lịch nhiều liệu trình dùng một SignaturePad chung, có thể để trống. Ghi buổi không đặt lịch cũng có chữ ký tùy chọn. UI chỉ gửi signature nếu đã vẽ; chữ ký gửi lên nhưng sai định dạng vẫn bị từ chối (xóa nét ký để bỏ qua). invoice/completeTreatmentAppointment nhận signature? chung và treatments [{treatmentId,remainingBefore}]; use.signature cũng optional. Tương thích client cũ: chữ ký từng dòng được nhận nếu đồng nhất với chữ ký chung/nhau; gửi nhiều chữ ký khác nhau bị từ chối, không âm thầm bỏ bằng chứng.

TreatmentUse.confirmationUseId? (ObjectId) liên kết các lượt sau với lượt đầu cùng hóa đơn; chỉ lượt đầu lưu nét ký. Có ký: lượt đầu method DRAWN_SIGNATURE, các lượt dùng chung method INVOICE_SIGNATURE, giữ digest/snapshot và tham chiếu xác nhận. Không ký: method STAFF_RECORDED, không tạo signature/signatureDigest giả; snapshot ghi rõ nhân viên ghi nhận, không có chữ ký khách hàng. Các lượt sau vẫn liên kết lượt đầu để xem hóa đơn không lặp xác nhận. Audit không lưu nét ký, chỉ digest nếu có và evidenceRecorded phản ánh thực tế.
Đọc chữ ký dùng chung kiểm quyền trên cả lượt hiện tại và nguồn, nguồn phải cùng spa/customer/checkoutInvoiceId, không theo chuỗi tham chiếu. Chi tiết hóa đơn dùng buổi chỉ hiển thị một xác nhận; lịch sử gói vẫn tra được chữ ký chung của buổi tương ứng. Dữ liệu/chữ ký cũ giữ nguyên. Không thêm indexes/migration/backfill, không sửa dữ liệu thật. Giữ hạn chế sửa/xóa lịch sử đã có lượt dùng, kể cả lượt không ký.


## Giỏ nhiều loại và lịch kết hợp dịch vụ/gói — 25/10/2026
CONFIRMED: một lịch hẹn có thể chọn nhiều dịch vụ lẻ cùng nhiều liệu trình khách đã mua. Tìm kiếm/nhóm chỉ lọc dịch vụ lẻ; liệu trình nằm riêng bên dưới, không bị lọc và không bị mất khi chọn dịch vụ. Thu ngân cho tích nhiều gói mới/nhiều sản phẩm; giữ mọi loại mục khi chuyển danh mục.

PROPOSED kỹ thuật:
- Appointment.serviceIds? lưu riêng các dịch vụ lẻ; treatmentIds giữ các gói dùng. requestedServices chứa tên cả hai để hiển thị/nhắc lịch. serviceId và treatmentId đầu vẫn tương thích dữ liệu cũ. appointment nhận serviceIds? (1–30 không trùng) và treatmentIds? (1–30); mọi tham chiếu active/cùng spa, gói đúng khách/ngày. Đặt lịch không ghi tiền/trừ buổi. Dời/xếp lại giữ cả danh sách; hoàn thành lịch gói tính thêm đúng các serviceIds với giá/hoa hồng danh mục tại lúc hoàn thành, giữ một hóa đơn SESSION và một chữ ký tùy chọn. Gói 0đ không bị cộng giá bán lại. Lịch chỉ có dịch vụ lẻ dùng luồng completeAppointment nhiều dòng hiện có.
- Thu ngân giữ bốn danh sách giỏ độc lập. Giá/số lượng/khuyến mãi/gói tặng/thẻ tặng theo từng gói mới; danh sách người tư vấn và hạn trả chung áp dụng từng hóa đơn gói. Đổi khách/xóa giỏ mới xóa các mục. Không tự áp thẻ hoặc tự xác nhận đã thu tiền.
- productInvoice {customerId,dueDate?,items:[{productId,quantity,unitPrice}]} OWNER/cashier: một hóa đơn PRODUCT có productItems snapshots, nhiều StockMovement.checkoutInvoiceId để giữ unique invoiceId index cũ. Trừ kho tuần tự, kiểm tồn/active/cùng spa và tiền nguyên/tổng giới hạn. serviceInvoice bổ sung additionalProducts để gộp dịch vụ lẻ và sản phẩm; invoice có liệu trình vẫn gộp dịch vụ/sản phẩm như trước. Không hoa hồng sản phẩm; thẻ tiền bị chặn trên hóa đơn có productItems ở cả lúc tạo và dùng thẻ sau. PDF không lặp dòng tổng cho hóa đơn sản phẩm; kho mở đúng hóa đơn qua checkoutInvoiceId. Xóa sai sót theo quyền/quy trình hiện có bù kho cả phiếu invoiceId và checkoutInvoiceId; sửa/hủy từng dòng hóa đơn có sản phẩm chưa hỗ trợ để tránh lệch giá/kho.
- checkout {customerId,issuedOn?,actions:[{action,data}]} chỉ OWNER/cashier. Whitelist invoice/serviceInvoice/productInvoice (tối đa một hóa đơn phần đã làm/sản phẩm) và sellPackage (tối đa 30 gói mẫu khác nhau). Mỗi gói mới giữ hóa đơn/liệu trình riêng theo unique Treatment.invoiceId hiện hành để quản lý công nợ/hoa hồng/hoàn gói; không tự gộp công nợ hay đổi quy tắc 5%. Một lần lưu giỏ có thể sinh nhiều hóa đơn; UI nói rõ và chuyển tới danh sách khi có nhiều hóa đơn.
- Tất cả action của checkout cùng spa/khách, một phiên active, một Control transaction snapshot/majority, một khóa idempotency/fingerprint; thực thi/audit/notifications tuần tự, lỗi bất kỳ rollback toàn bộ (gồm xuất kho, gói/quà và buổi đã ghi trước lỗi). Retry không tạo trùng hóa đơn/gói/kho/thông báo. Audit con có checkoutKey digest; không ghi nét ký/mật khẩu vào log. Kết quả trả invoiceIds/invoices/total để đối chiếu giỏ. issuedOn chung vẫn không backdate tiền hoặc thực hiện.
Không thêm indexes, migration/backfill hoặc ghi dữ liệu vận hành trong phiên triển khai.


## Quà tặng dịch vụ lẻ thay cho cả liệu trình — 26/10/2026
CONFIRMED theo yêu cầu mới nhất: quà khi bán gói chỉ chọn dịch vụ lẻ, không tặng nguyên gói liệu trình. Thay quy tắc trước cho chọn PackageTemplate làm quà mới; quà đã cấp giữ nguyên quyền lợi/lịch sử. Tên/ghi chú ưu đãi (promotion) mô tả chương trình áp dụng để tra cứu, không tự tạo mức giảm giá; giữ điều kiện có quà/thẻ tặng thì nhập ghi chú.
PROPOSED kỹ thuật: sellPackage.gifts đổi thành [{serviceId}] strict, không nhận templateId/giá/số buổi từ client. Backend kiểm dịch vụ active/cùng spa và tạo chứng từ GIFT total=paid=0 liên kết hóa đơn mua. Dùng hạ tầng quyền lợi hiện có lưu một lượt dịch vụ tặng (Treatment packageType SESSIONS,totalSessions=remaining=1, không templateId/durationMonths); không cấp bảo hành/gói nhiều buổi và không tự đặt hạn. Khách có thể dùng sau qua luồng dùng quyền lợi: một lượt, chữ ký tùy chọn, hoa hồng thực hiện theo dịch vụ như trước; không sinh khoản thu/công nợ/hoa hồng bán gói cho quà. Mọi quà và gói mua cùng transaction/idempotency/audit, lỗi rollback toàn bộ. UI ghi Dịch vụ lẻ tặng 1 lần, dropdown từ Service; form cũ gửi templateId phải tải lại. Không schema/index/migration/backfill hoặc sửa dữ liệu thật.

## Sửa ngày hóa đơn — 26/10/2026

CONFIRMED theo yêu cầu người dùng: form sửa hóa đơn bổ sung Ngày hóa đơn,
điền sẵn ngày hiện có theo giờ Việt Nam. OWNER được sửa ngày khi hóa đơn đủ
điều kiện sửa hiện hành. Bỏ trống/không gửi giữ nguyên ngày, không lấy ngày hôm nay.
PROPOSED kỹ thuật: updateInvoice nhận issuedOn? YYYY-MM-DD, kiểm ngày thực,
không tương lai và cả ngày cũ/ngày mới chưa CLOSED. Đổi ngày cập nhật Invoice.createdAt
về 12:00 Việt Nam; nếu chọn lại cùng ngày giữ giờ cũ. recordedAt giữ thời điểm nhập
thật (chứng từ cũ thiếu trường này dùng createdAt trước sửa). Không đổi ngày thanh
toán, hoa hồng, thực hiện hay ngày bắt đầu/hết hạn liệu trình chỉ vì sửa ngày hóa đơn;
các trường liệu trình vẫn theo form sửa riêng. Giữ transaction, kiểm phiên active,
cùng spa, OWNER, expectedUpdatedAt, idempotency và audit trước/sau. Không backfill
hoặc sửa dữ liệu thật; không schema/index mới.

## Lịch hẹn và thu ngân dùng chung lần thực hiện — 26/10/2026

CONFIRMED theo yêu cầu triển khai: khi đã đặt lịch, hoàn thành qua thu ngân hoặc
chọn lịch trong thu ngân phải dùng một hóa đơn dịch vụ/buổi cho lần làm. Lưu thành
công mới hoàn thành lịch; đã liên kết thì mở hóa đơn, không tạo lại. Hóa đơn có thể
còn nợ sau khi lịch hoàn thành. Khách không đặt lịch vẫn lập hóa đơn riêng. Gói mới
mua thêm giữ hóa đơn riêng như quy tắc checkout hiện có. OWNER có thể đối chiếu và
liên kết hóa đơn đã lập rời với lịch, không tự ghép bằng khách/ngày.

PROPOSED kỹ thuật: checkout nhận appointmentId?; active OWNER/thu ngân, cùng spa và
khách, lịch CONFIRMED hoặc COMPLETED/đã tới giờ/chưa có hóa đơn và chưa ghi buổi, đủ các serviceIds và treatmentIds
của lịch. Người thực hiện phải khớp người được phân công (lịch chưa giao lấy người
thực hiện trên hóa đơn). Thêm dịch vụ/sản phẩm/gói mới vẫn theo checkout. Một hóa đơn
SERVICE/SESSION cho phần thực hiện; mua gói mới vẫn tách chứng từ. Transaction Control
chung ghi tuần tự hóa đơn, trừ buổi, kho, hoa hồng, lịch, audit, thông báo và idempotency;
lỗi bất kỳ rollback. Không tự ghi Payment hay thu tiền khi đánh dấu hoàn thành.

recordUse của checkout lịch nhận appointmentId vào snapshot của buổi đầu, buổi sau
vẫn dùng liên kết xác nhận hiện có. completeAppointment/completeTreatmentAppointment
sau đó dùng lại invoice/use đã liên kết. Retry cùng key trả kết quả cũ, key khác hoặc
hai lần thu ngân cạnh tranh không lập thêm hóa đơn cho cùng lịch.

POST /api/operations linkAppointmentInvoice {appointmentId,invoiceId,reason}: chỉ OWNER,
cùng spa/khách, lịch CONFIRMED hoặc COMPLETED đã tới giờ, hóa đơn SERVICE/SESSION đã
có performedBy/performedAt, đủ dịch vụ và buổi thực hiện, không mở đầu/quà/hoàn tiền,
không liên kết lịch khác. Kiểm người thực hiện khớp; buổi không thuộc lịch khác.
Chỉ gắn tham chiếu và hoàn thành lịch, không trừ buổi/cộng hoa hồng/thu tiền lần nữa;
giữ snapshot và chữ ký ban đầu, audit ghi lý do cùng trạng thái trước/sau. Hóa đơn
chưa ghi nhận thực hiện cần hoàn thành dịch vụ trước khi liên kết theo luồng này.

GET /api/appointments/checkout: active OWNER/thu ngân; query customerId và page (20
lịch/trang, CONFIRMED/COMPLETED), hoặc appointmentId với customerId tùy chọn để lấy
chi tiết đúng spa/khách. Trả lịch, dấu hiệu hóa đơn đã liên kết; chi tiết trả khách,
dịch vụ, liệu trình để điền giỏ. no-store; không thay endpoint đặt lịch công khai.
UI hỗ trợ phân trang, không giới hạn lịch sử ở trang đầu. Không schema/index/migration
mới, không tự liên kết dữ liệu cũ hay chạy ghi dữ liệu thật khi triển khai code.


## Điều chỉnh riêng ngày hóa đơn đã thực hiện — 26/10/2026

CONFIRMED theo yêu cầu khắc phục hóa đơn buổi liệu trình bị chặn sau khi đã mở lại
sổ: OWNER được điều chỉnh riêng ngày hóa đơn SERVICE/SESSION/PACKAGE/PRODUCT đã
thực hiện hoặc có thanh toán; không mở quyền sửa giá, dịch vụ, số buổi hay lịch sử
thanh toán. Trước đó updateInvoice chặn SESSION/liên kết buổi; ngoại lệ mới chỉ áp
dụng action riêng correctInvoiceDate. Chứng từ nhập ban đầu và hóa đơn CANCELLED
vẫn không dùng action này. Không sửa dữ liệu thật tự động trong phiên phát triển.

PROPOSED kỹ thuật / API: POST /api/operations action correctInvoiceDate,
data strict {id,expectedUpdatedAt,issuedOn:YYYY-MM-DD,reason}. Backend lấy actor/spa
từ phiên active, kiểm OWNER, đúng spa, phiên bản, ngày thực/không tương lai và cả
ngày cũ/ngày mới không CLOSED. Cần mở lại ngày đã chốt trước khi điều chỉnh. Không
yêu cầu ngày mới đã mở sổ vì không ghi dòng tiền. Ngày mới khác ngày cũ dùng 12:00
Việt Nam cho Invoice.createdAt; cùng ngày giữ giờ cũ. Giữ Invoice.recordedAt; chứng
từ cũ thiếu trường này dùng createdAt trước đổi làm thời điểm ghi nhận ban đầu.
Chỉ cập nhật createdAt/recordedAt/updatedAt, không ghi Payment/CashEntry, không đổi
performedAt, chữ ký/snapshot/digest TreatmentUse, quyền lợi Treatment, Commission,
ngày bắt đầu/hết hạn gói hay lịch hẹn. Vì thế số liệu hóa đơn theo ngày đổi theo
ngày mới, còn sổ tiền/hoa hồng/thực hiện vẫn theo thời điểm ghi nhận riêng.
Control transaction, idempotency fingerprint và audit metadata trước/sau cùng lý
do được giữ. UI có nút Sửa ngày hóa đơn tại danh sách/chi tiết; Sửa hóa đơn trên
buổi liệu trình/đã thanh toán mở form chỉ gồm ngày và lý do. Không schema/index hay
migration mới, không xóa/tạo lại hóa đơn hoặc bút toán để thay ngày.


## Một lần mua nhiều gói dùng chung hóa đơn — 26/10/2026

CONFIRMED theo yêu cầu mới nhất: các gói mới trong cùng lần mua của một khách gộp thành một hóa đơn PACKAGE, nhiều dòng giá và nhiều hồ sơ Treatment độc lập; thu tiền/công nợ trên tổng hóa đơn. Thay thế mô tả checkout trước đây mỗi gói có hóa đơn riêng. Không tự gộp chứng từ lịch sử. Phần dịch vụ đã làm/sản phẩm trong giỏ vẫn theo chứng từ vận hành hiện có; yêu cầu này áp dụng các gói mua mới.

## STAFF security release policy — 28/10/2026

CONFIRMED theo chính sách đã chốt trong phiên release: OWNER và STAFF cashier được openDay; chỉ OWNER được closeDay/reopenDay và xem Reports hoặc tổng tài chính toàn spa. Ca trong release này là ngày Việt Nam; không xây hệ thống ca mới. Cashier phải thu được nợ hóa đơn cũ hợp lệ cùng spa.

PROPOSED kỹ thuật thực hiện chính sách: cashier đọc hóa đơn còn nợ chưa CANCELLED không giới hạn ngày tạo, hóa đơn tạo trong ngày, hóa đơn có Payment còn hiệu lực trong ngày và hóa đơn được phân công. Hóa đơn vừa tất toán vẫn tra được trong ngày thu; lịch sử đã tất toán không thuộc các phạm vi này không được mở rộng. Tìm khách cho OWNER/cashier giữ nguyên để phục vụ thu ngân; lịch sử hóa đơn áp dụng invoiceScope theo customerId cùng spa. Payment tiếp tục kiểm tài khoản active/cashier từ DB, cùng spa, hóa đơn chưa CANCELLED, số tiền không vượt nợ, sổ hôm nay OPEN, transaction/idempotency/audit. Không thay quyền allocate theo phân công.

STAFF thường: phạm vi khách lấy từ lịch đã giao hoặc buổi mình ghi/thực hiện; phạm vi Treatment lấy từ treatmentId/treatmentIds của lịch đã giao và buổi mình ghi/thực hiện; TreatmentUse chỉ actorId/staffId của mình. Áp dụng trước count/pagination, tìm trực tiếp ID, lịch sử khách, dữ liệu tham chiếu workspace và thống kê buổi; query customer/search không mở rộng quyền. Không thêm phân công nhân viên theo từng dịch vụ. Không schema/index/migration/backfill. Phần này thay thế mô tả cũ cho rằng phạm vi theo ca chưa đổi.
