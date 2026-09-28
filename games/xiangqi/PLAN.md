# Kế hoạch Cờ Tướng

## Đích đến

Hai người chơi một ván Cờ Tướng trọn vẹn trên bàn cờ dễ đọc ở điện thoại. Quân cờ bằng ngọc trắng
khắc chữ Hán; các nước ăn quân có nhịp hành động riêng: lao tới, bay, nhào lộn, va đập và vỡ.
Những khai cuộc hoặc thế đánh được nhận diện chắc chắn có cut-in tên bằng tiếng Việt. Hiệu ứng làm nước đi đáng nhớ nhưng không che khuất trạng thái bàn cờ.

Hiện đã có luật đầy đủ (nước đi, chiếu, chiếu bí, hết nước, lặp thế cờ, xin hoà, đầu hàng), máy
chơi ba mức, bàn cờ, 14 quân, pha ăn quân riêng cho từng loại và quân vỡ thành mảnh; xem
[README](README.md), cut-in khi chiếu tướng/chiếu bí, bảng kết quả với thời gian đã chơi và nhạc
thắng. Còn lại: cut-in tên thế cờ.

## Luật chơi sẽ áp dụng

- Chọn [Luật Cờ Tướng Thế giới 2018 của WXF](https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf)
  làm chuẩn cho ván hai người. Bàn 9 đường dọc × 10 đường ngang, 32 quân chia hai bên; Đỏ đi
  trước. Có Tướng, Sĩ, Tượng, Xe, Mã, Pháo và Binh/Tốt; quân đi trên **giao điểm**.
- [Luật AXF](https://www.asianxiangqi.org/English/AXF_rules_Eng.pdf) là một bộ quy tắc khác về
  phân xử lặp nước. Bản đầu chỉ theo WXF 2018 để mọi phòng dùng cùng một cách xử lý.
- Mỗi loại quân tuân theo đường đi và giới hạn riêng: Sĩ và Tướng trong cung; Tượng không qua sông;
  Mã bị cản chân; Pháo phải có đúng một quân làm ngòi để ăn; Tốt/Binh chỉ đi ngang sau khi qua
  sông. Không được để Tướng của mình bị chiếu hoặc để hai Tướng đối mặt trên một cột trống.
- Bên không còn nước hợp lệ khi tới lượt sẽ thua, kể cả khi không đang bị chiếu. Ván cũng kết thúc
  khi một bên đầu hàng hoặc rời bàn giữa ván. Áp dụng cách phân xử lặp nước của WXF 2018: chiếu
  dai, đuổi quân dai và lặp nước trung tính có thể dẫn tới kết quả khác nhau; không mặc định mọi
  lần lặp là hoà. Cho phép hai bên đồng ý hoà và áp dụng giới hạn nước đi không ăn quân của bộ
  luật này.
- Ván đầu giữ màu cố định; các ván sau có thể đổi màu giữa hai người. Không thêm biến thể bàn cờ,
  quân hoặc luật địa phương ở bản đầu. Chưa bật đồng hồ thi đấu ở bản đầu.

## Model và hình ảnh

- Dựng bàn gỗ 3D cùng sông, cung và giao điểm rõ ràng; đặt trong phong cách đảo trời, gỗ và giấy
  của ứng dụng. Ưu tiên nhìn được nước đi trên màn hình nhỏ trước khi thêm chi tiết trang trí.
- Dựng một dáng quân tròn thống nhất và bảy biến thể nhận diện cho từng loại quân, mỗi loại có bản
  Đỏ và Đen. Các quân cùng loại dùng chung ngôn ngữ tạo hình; 32 quân trên bàn vẫn dễ phân biệt
  nhờ màu, ký hiệu và bố cục chuẩn.
- Dùng Blender dựng model, vật liệu, ánh sáng và chuyển động; render thành frame 2D nền trong suốt
  để hiển thị trong Phaser. Giữ cùng góc máy, kích thước và điểm neo cho mọi frame để quân không
  bị “nhảy” khi đổi từ trạng thái đứng yên sang hoạt ảnh. Repo chỉ chứa hình đã xuất.
- Làm trước một quân mẫu và một cảnh ăn quân mẫu để duyệt độ rõ, độ vui và dung lượng trên điện
  thoại, rồi mới sản xuất đủ bộ.

## Chuyển động và âm thanh

Mỗi **loại quân** có hoạt ảnh ăn quân riêng cho cả hai màu. Những quân trùng loại có thể khác
nhịp lấy đà, góc xoay hoặc phản ứng va chạm để các pha ăn quân không lặp y hệt. Nước đi trên bàn
luôn kết thúc ở giao điểm hợp lệ, dù pha hành động có cường điệu.

| Quân | Ý tưởng ăn quân |
| --- | --- |
| Tướng | Nhấc nặng, dồn lực rồi giáng xuống; sóng va đập ngắn. |
| Sĩ | Lướt chéo gọn, xoay nửa vòng và chặn đối thủ. |
| Tượng | Bật chéo như cú húc lớn, tiếp đất chắc. |
| Xe | Lao thẳng nhanh, thắng gấp và hất quân bị ăn. |
| Mã | Bật theo nhịp chữ L, nhào lộn trên không rồi đáp xuống. |
| Pháo | Lấy đà qua quân ngòi, bật lên và nện xuống ô đích. |
| Tốt/Binh | Lao bước ngắn, cú đẩy nhỏ mà dứt khoát. |

Quân bị ăn có phản ứng trúng đòn, bay lệch khỏi bàn rồi vỡ vụn; mức độ va đập thay đổi
theo loại quân tấn công để các pha không giống hệt nhau. Nước thường có chuyển động ngắn hơn;
chọn quân, chiếu Tướng, chiếu bí, thắng và hoà có điểm nhấn riêng. Ghép các pha này với bộ âm
thanh đã có theo [kế hoạch âm thanh](../../docs/xiangqi-audio.md), tránh nhiều âm kết quả phát
chồng nhau. Người xem mới vào hoặc vừa kết nối lại thấy ngay bàn cờ đúng trạng thái, không phải
xem lại chuỗi hoạt ảnh cũ.

## Cut-in tên thế cờ

- Chỉ hiện tên khi nước vừa đánh đáp ứng **mẫu nhận diện đã được định nghĩa rõ**, bắt đầu từ một
  số khai cuộc phổ biến rồi mới mở rộng sang đòn phối hợp. Không gắn tên thế cờ chỉ vì một nước
  trông tương tự; cùng một nhãn không lặp liên tục trong một ván.
- Cut-in dùng chữ tiếng Việt, xuất hiện ngắn ở mép bàn cùng họa tiết giấy, mực và âm thanh nhấn;
  vẫn nhìn được quân vừa đi và lượt tiếp theo.
- Ví dụ để thẩm định trong giai đoạn nội dung: “Pháo đầu”, “Bình phong mã”, “Thuận pháo”, và
  “Mã hậu pháo”. Mỗi tên cần mô tả điều kiện nhận diện và được kiểm tra trên các ván mẫu trước
  khi đưa vào game; tên chưa có điều kiện chắc chắn sẽ không hiện.

## Chế độ Cờ Tướng truyền thống

Mỗi client có tuỳ chọn **Tắt hoạt ảnh**, đổi được ngay trong lúc xem hoặc chơi và được ghi nhớ trên
thiết bị đó. Khi bật, quân chuyển thẳng tới vị trí mới, quân bị ăn biến mất ngay; không phát cảnh
bay, nhào lộn, va đập, vỡ hay cut-in. Bàn vẫn hiện lượt, nước vừa đi, trạng thái chiếu và kết quả
bằng dấu hiệu tĩnh, để chơi như một bàn Cờ Tướng truyền thống. Tuỳ chọn này không nằm trong cài
đặt phòng, không đổi luật hoặc nhịp xử lý nước đi, và không ảnh hưởng client khác trong cùng ván.

## Rời phòng và về Home

Trên thanh phòng, đặt **nút biểu tượng Home** ngay cạnh “Rời phòng”. “Rời phòng” tiếp tục đưa
người chơi về danh sách phòng của Cờ Tướng; nút Home rời phòng rồi đưa thẳng về màn hình chính.
Nếu đang chơi dở, nút Home dùng cùng bước xác nhận bỏ dở ván như “Rời phòng”; chọn ở lại thì vẫn
ở trong phòng. Hành vi này thuộc thanh phòng dùng chung của ứng dụng, nên người chơi các game
khác cũng có cùng lối về Home.

## Thứ tự triển khai

1. **Chốt luật và bàn chơi:** viết luật ngắn cho người chơi, hoàn thiện nước đi, chiếu, kết thúc
   và hoà; bàn 2D rõ ràng, chọn quân và xem nước hợp lệ trên điện thoại.
2. **Duyệt phong cách 3D:** dựng bàn và một cặp quân mẫu; render nước đi, pha ăn quân và cảnh vỡ
   mẫu; kiểm tra độ rõ của ký hiệu và nhịp xem ở kích thước điện thoại.
3. **Hoàn thiện bộ quân:** dựng đủ bảy loại cho hai bên và hoạt ảnh ăn quân khác nhau; bổ sung
   phản ứng trúng đòn, âm thanh, chiếu và kết thúc ván.
4. **Thêm thế cờ có tên:** chọn danh sách ít nhưng nhận diện chắc, làm cut-in và thử trên ván thực.
5. **Rà soát để phát hành:** chơi trọn ván trên điện thoại và máy tính, thử khán giả, kết nối lại,
   tắt/bật hoạt ảnh ở từng client và hai cách rời phòng; bảo đảm hiệu ứng không làm chậm thao tác
   hoặc khiến người chơi hiểu sai vị trí quân.

## Tiêu chí hoàn thành

Luật áp dụng được ghi công khai; hai người chơi được một ván đúng luật; cả 14 biến thể quân Đỏ/Đen
đọc được trên màn hình nhỏ; bảy loại quân có pha ăn quân riêng; hoạt ảnh va đập và vỡ khớp với
nước server đã chấp nhận; cut-in chỉ hiện cho mẫu đã kiểm chứng. Một client có thể chơi ván trọn
vẹn với hoạt ảnh tắt trong khi client khác cùng bàn vẫn xem hoạt ảnh.
Nút Home rời đúng phòng hiện tại và về màn hình chính sau bước xác nhận nếu ván còn đang chơi.
