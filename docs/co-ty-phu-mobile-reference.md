# Tham khảo Cờ tỷ phú Việt Nam trên điện thoại

Khảo sát trực tiếp ngày 01/10/2026 qua Mobile MCP trên OPPO Reno8 T, Android 15.
Ứng dụng: `com.qastudios.cotyphu`, phiên bản 6.2, version code 122, QA Studios.
Đã xem thiết lập, đọc toàn bộ vòng trang hướng dẫn, chơi thử offline với máy,
xem thông tin đất và màn vào online. Chưa chơi hết một ván hoặc ghép trận online.
Không thay đổi luật hay giao diện của `co-ty-phu-classic` trong lần khảo sát này.

## Thiết lập

| Mục | Quan sát trực tiếp |
| --- | --- |
| Người chơi offline | Chọn 1–4 người; chọn thêm 0–3 máy. Chưa thử mọi tổ hợp để xác nhận giới hạn tổng |
| Nhân vật | Đổi hình đại diện, chọn đỏ/xanh lá/xanh dương/cam, nhập tên; có lựa chọn giấu tên |
| Máy | Dễ, Vừa, Khó; chưa đo chiến thuật khác nhau giữa ba mức |
| Xúc xắc | Một hoặc hai viên |
| Bản đồ | Bản đồ chuẩn hoặc tạo bản đồ mới. Đã thấy bản đồ mới thay thành phố/vị trí/giá; vẫn giữ cấu trúc bàn |
| Tiền đầu ván | Có nút trừ/cộng; đã thấy hai giá trị 1.000 và 20.000. Chưa xác nhận bước tăng và toàn bộ miền giá trị |
| Trong ván | Âm thanh, Trợ giúp, Tự động xúc xắc, Hiển thị tên, Tăng tốc gấp đôi |
| Lưu ván | Khi thoát có thông báo sẽ lưu; lần vào offline tiếp theo có Ván mới / Chơi tiếp |
| Online | Đấu nhanh 1vs1, Đấu nhiều người, Vào phòng kín; màn này ghi tiền đầu trận cố định $20.000 |

Các lựa chọn được giữ lại giữa những lần mở ứng dụng. Vì vậy giá trị đang chọn
trên máy không được coi là giá trị mặc định của một bản cài mới.

## Luật của phiên bản này

Các luật dưới đây lấy từ hướng dẫn trong ứng dụng; một số đã thấy diễn ra trong
ván thử. Không dùng luật Monopoly thông thường để lấp những phần chưa kiểm tra.

- Bàn chữ nhật có **36 ô**: 10 ô thường giữa hai góc trên/dưới, 6 ô thường giữa
  hai góc trái/phải, cộng 4 góc. Bàn chuẩn hiển thị 25 ô thành phố, 3 ô vận tải,
  4 ô thẻ và 4 góc. Quân đi theo chiều kim đồng hồ từ góc dưới phải.
- Một xúc xắc: ra 6 được thêm lượt. Hai xúc xắc: ra đôi được thêm lượt.
  Ba lần thưởng lượt liên tiếp dẫn đến vào tù.
- Đất có thể mua rồi xây nhà. Nhà thứ năm trở thành khách sạn.
  Hướng dẫn không nói cần đủ bộ màu mới được xây; chưa kiểm chứng điều kiện xây.
- Mỗi nhà có giá bằng một nửa giá đất; khách sạn có giá bằng ba lần giá đất.
  Thẻ Nam Định giá 2.400 ghi nhà 1–4 đều 1.200, khách sạn 7.200.
- Thẻ Nam Định ghi tiền thuê: đất trống 480, một nhà 1.200, hai nhà 2.400,
  ba nhà 3.600, bốn nhà 4.800, khách sạn 7.200. Đây là ví dụ trực tiếp,
  chưa xác nhận công thức chung của mọi thành phố bằng chơi thử.
- Sở hữu trọn dãy cùng màu nhân đôi tiền thu khi đối thủ ghé vào.
- Nhà ga, Bến xe, Bến cảng là **ô đấu giá**: phải đấu giá để sở hữu, không xây nhà.
  Giá trị của ô sau khi mua bằng giá thắng đấu giá; phí thu bằng nửa giá trị ấy.
  Sở hữu cả ba nhân đôi phí thu. Chưa chơi một cuộc đấu giá để kiểm tra bước giá,
  thời hạn hoặc cách xử lý người bỏ cuộc.
- Qua Start có thưởng; **đáp đúng Start không có thưởng**, theo hướng dẫn.
  Trong ván tiếp tục ban đầu đã thấy thưởng qua Start $2.000.
- Góc sân bay đưa người chơi đến ô đích được ghi trên sân bay. Đã thấy máy bay
  lớn bay ngang bàn và thông báo điểm đến; cách chọn/đổi điểm đến chưa được xác nhận.
- Góc Vô tù đưa quân về Trại giam. Ra tù bằng 6/đôi tương ứng số xúc xắc,
  thẻ ra tù, hoặc trả tiền; lần thứ ba không ra được thì buộc phải trả tiền.
- **Người đang ở tù không được thu phí từ đất của mình.** Nếu có người bị giam,
  người khác ghé Trại giam phải trả tiền thăm tù. Chưa xác nhận các mức phí.
- Khí vận màu tím thiên về rủi ro, Cơ hội màu vàng thiên về may mắn;
  cả hai đều có thể cho kết quả ngược lại. Đã thấy chi tiêu siêu thị và chuyển ô.
- Thiếu tiền phải bán các ô đang sở hữu; hết tiền thì phá sản. Người cuối cùng
  chưa phá sản thắng. Chưa kiểm tra bán đất, xử lý nợ hoặc màn kết quả trực tiếp.

Những khác biệt này thuộc một biến thể riêng. Bàn 40 ô, thế chấp, nhà công cộng
và cơ chế đấu giá của game hiện tại không nên tự đổi chỉ vì tham khảo ứng dụng này.

## Nhịp giữa các hành động

Chuỗi quan sát được: đổi người đang chơi → tung xúc xắc → di chuyển → thông báo
ô hoặc thẻ → lựa chọn nếu cần → chuyển tiền → cập nhật quyền sở hữu → lượt tiếp.
Máy cũng đi qua các bước trình bày đó; không nhảy thẳng đến trạng thái cuối.

Ước lượng từ ảnh có thời gian chụp, thường cách nhau khoảng 0,7–1 giây.
Sai số đủ lớn để không dùng làm mốc chính xác theo mili giây. Đo từ lúc hình
thay đổi, không tính thời gian chạy lệnh tap qua USB hoặc chờ người quyết định.

| Nhịp | Quan sát |
| --- | --- |
| Xúc xắc | Đổi mặt liên tiếp trong khoảng 1–2 giây trong các mẫu; hình nhìn có chiều sâu nhưng không thấy mô phỏng va chạm vật lý |
| Di chuyển | Quân đi dọc đường ô; ô đang đến sáng lên. Nhanh hơn đáng kể so với nhịp chuyển tiền; chưa có đủ mẫu để kết luận thời gian mỗi ô |
| Máy cân nhắc mua | Có chữ nhỏ “Suy nghĩ” trên nhân vật trước quyết định; khoảng 1 giây trong mẫu tốc độ 2× |
| Mua/chuyển tiền thường | Khoảng 4–5 giây tính cả xuất hiện hình ngân hàng, chuyển số tiền, giữ kết quả rồi đổi lượt |
| Mua ở 2× | Khoảng 2–3 giây trong mẫu đã xác nhận tốc độ nhanh; cùng nội dung nhưng ngắn hơn |
| Thêm lượt | Hiện thông báo được thêm lượt, sau đó tự tung tiếp; không cần nút kết thúc lượt riêng |
| Thẻ | Khung thông báo đổi màu theo loại thẻ, đọc được nội dung trước bước tiếp theo; chưa đo đủ để có thời lượng chuẩn |
| Đợi người chơi | Mua Có/Không dừng để quyết định; không thấy đồng hồ trong các màn offline đã xem |
| Đầu ván | Sau màn Loading đi vào lượt đầu; không thấy bảng đếm tiền từ 0 hoặc nút xác nhận vào ván |

Mẫu tốc độ thường: thư mục `purchase-cycle`, từ ảnh 2 (1,49s, ngân hàng xuất
hiện) đến ảnh 7 (5,33s, đổi sang máy): khoảng 3,84s; cộng phần nhận quyết định
và chuyển màn đầu thành khoảng 4–5s. Mẫu nhanh: `fast-new`, ảnh 9 (6,67s,
ngân hàng xuất hiện) đến ảnh 12 (8,98s, chuyển sang tung thêm lượt): khoảng 2,31s.
Các mẫu 2× có chữ `1X` trên nút đổi tốc độ, và thiết lập tốc độ đã được kiểm tra.

Tự động xúc xắc có lựa chọn riêng. Việc bật giữa một lượt đang chờ không tạo
được một phép thử đáng tin cậy do trạng thái tạm dừng/orientation; chưa kết luận
chính xác nó chờ bao lâu hoặc xử lý những lượt đang dở như thế nào.

## Cách trình bày đáng học

**Mỗi lúc chỉ có một việc nổi bật.** Nửa trên giữa bàn cho nhân vật đang chơi,
xúc xắc hoặc giao dịch. Nửa dưới giữa bàn là một khung thông báo lớn, nút quyết
định nằm ngay trong khung đó. Các nút chung thoát/cài đặt/tốc độ nhỏ và ổn định.

**Giao dịch có hai đầu rõ ràng.** Nhân vật trả tiền nằm bên trái, ngân hàng hoặc
đối tượng nhận bên phải, hình tiền ở giữa. Số dư đổi dần; chữ vàng `−2.400` và
`+2.400` cho biết nguyên nhân thay đổi. Kết quả được giữ lại trước khi đổi lượt.
Danh sách tiền nhỏ có thể nhường chỗ cho giao dịch, nên không phải HUD nào cũng
hiển thị liên tục trong ứng dụng này.

**Bàn đơn giản nhưng có đủ dấu hiệu.** Quân là biểu tượng phẳng người/máy theo
màu. Màu nhóm đất là nền ô; chủ sở hữu là dải màu riêng. Ô đang có quân/đang xử
lý sáng hơn, nhà và trạng thái tài sản có dấu hiệu bổ sung. Các kênh này phục vụ
các ý nghĩa khác nhau thay vì chỉ đổi một màu nền cho mọi trạng thái.

**Tra cứu đất tách khỏi nhịp sự kiện.** Chạm đất mở bảng hai cột: chi phí bên
trái, tiền thu bên phải, các cấp nhà cùng hàng, số màu vàng. Bảng có ích nhưng
rất lớn và nhiều dòng; không nên nhét nguyên bảng vào thẻ bên phải của game mình.

**Hiệu ứng lớn dành cho sự kiện đặc biệt.** Máy bay, ngân hàng, tiền và nhân vật
có kích thước lớn để đọc trên điện thoại. Số lượng hiệu ứng cùng lúc thấp.

## Đề xuất cho game hiện tại

1. Thêm nhịp giao dịch sau mua, thuê, thuế, thưởng và xây: liên kết hai thẻ
   người chơi/ngân hàng, số tiền bay và số dư chuyển dần. Mục tiêu thử nghiệm
   0,6–0,9s chuyển số + 0,4–0,6s giữ kết quả; đây là **đề xuất**, không phải
   thời lượng đo từ game tham khảo.
2. Giữ hàng đợi trình bày sự kiện: tiền và chủ đất cập nhật theo đúng beat mà
   người xem đang thấy. Với online, luật vẫn do server quyết định; hàng đợi
   hình ảnh không được làm mỗi máy nhìn một trình tự khác nhau hoặc tụt quá xa.
3. Tách hiệu ứng từng ô thành vị trí đang đi, đang đứng, chủ sở hữu, nhóm màu,
   số nhà, thế chấp và sự kiện đặc biệt. `BoardTileEffect` hiện có là điểm mở rộng
   phù hợp; cần kiểm soát từng lớp độc lập.
4. Thêm tốc độ 1×/2× vào phần game, có cùng nội dung ở cả hai mức. Giữ các nút
   điều hướng/cài đặt dùng chung theo yêu cầu đã thống nhất. Không coi “tự tung”
   và “tăng tốc” là cùng một tuỳ chọn.
5. Thẻ thông tin đất ưu tiên giá, chủ, tiền thuê hiện tại và cấp nhà tiếp theo.
   Bảng giá đầy đủ mở riêng khi cần. Nút liên quan vẫn nằm trong thẻ; xúc xắc ở ngoài.
6. Rút các quãng giữ tĩnh cộng dồn. Code hiện tại có giữ kết quả xúc xắc 1,5s,
   đi 0,36s mỗi ô và giữ thông báo đáp ô 1,3s. Riêng đi 12 ô đã tốn 4,32s trước
   các quãng còn lại. Nên thử giới hạn tổng thời gian đi, thay vì tăng tuyến tính
   không giới hạn, rồi đánh giá trên điện thoại.
7. Bot dùng cùng chuỗi hiệu ứng, có phản hồi ngắn khi cân nhắc, tự kết thúc các
   bước không cần lựa chọn. Bảng tiền đầu ván tự đóng hiện tại vẫn phù hợp mục
   tiêu của mình; không cần bắt chước màn Loading hoặc chuỗi hướng dẫn dài.

Ưu tiên triển khai: giao dịch tiền → giới hạn thời gian đi → tốc độ 2× → mở rộng
lớp ô. Đã triển khai bước giao dịch tiền cho `co-ty-phu-classic`: bản ghi từ server,
chuyển số dư 0,75s và giữ kết quả 0,5s. Đã giới hạn thời gian đi: 0,26s mỗi ô, tối đa 2s cho cả đường đi. Đã thêm 1×/2×, bản chụp quyền sở hữu theo hàng đợi, các lớp ô độc lập, thẻ thuê gọn
với bảng đầy đủ mở riêng, và nhịp cân nhắc của máy. Quãng giữ xúc xắc giảm còn 0,7s,
kết quả đến ô còn 0,85s ở 1×. Hơn hai lượt chờ dùng tốc độ bắt kịp tạm thời 3×.

## Bằng chứng và giới hạn

Ảnh gốc, bảng ảnh theo thời gian và `times.json` nằm tại
`.blender/mobile-research/co-ty-phu-mobile/` trên máy khảo sát (không đưa vào git).
Các ảnh chính: `settings.png`, `setup-players.png`, `setup-difficulty-dice.png`,
`setup-map-money.png`, `buy-prompt.png`, `property-info.png`, `online-menu.png`.
Ảnh hướng dẫn được lưu trong `tutorial-*.png`; số file chỉ là thứ tự thu thập,
không phải số trang do ứng dụng hiển thị.

Hệ thống Android báo orientation/kích thước khác với hình game ở một số thời
điểm. Một số tap và phép thử tốc độ không dùng được; chỉ các đoạn có thay đổi
trạng thái rõ ràng mới được dùng để ước lượng. Không đo âm thanh hoặc FPS, không
trích xuất mã/asset của ứng dụng. Đã trả Âm thanh/Trợ giúp/Hiển thị tên về bật,
Tự động xúc xắc/Tăng tốc gấp đôi về tắt như lúc bắt đầu, và trở về menu.
