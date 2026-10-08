# Bom Nguyên Tố

Đấu trường isometric 13 × 11 ô cho 1–4 nhân vật. Một nhân vật là chế độ luyện tập;
**Sinh tồn đơn** có người sống sót cuối cùng thắng. **Đấu đội 2v2** có đội còn người
sống sót thắng. Các ghế 1 và 3 thuộc đội A, ghế 2 và 4 thuộc đội B. Thành viên
đã bị loại vẫn được tính thắng nếu đồng đội giành chiến thắng. Thiếu người
thì máy tự bổ sung; có thể chọn 0–3 máy trong phòng để dành ghế cho bạn bè.

Mỗi người chọn nguyên tố trước mỗi trận rồi bấm **Sẵn sàng**. Sau 20 giây,
trận tự bắt đầu với lựa chọn hiện tại. Mỗi nhân vật có 100 HP, 2 bom đồng thời,
tầm nổ 2 ô và tốc độ 3,2 ô/giây.

## Điều khiển

| Thao tác | Bàn phím | Cảm ứng |
| --- | --- | --- |
| Di chuyển theo trục của đấu trường | WASD hoặc phím mũi tên | Bốn nút hướng |
| Đặt bom | Space | Bom |
| Kỹ năng nguyên tố | E | Kỹ năng |
| Tăng tốc 0,65 giây; hồi 5 giây | Shift | Lướt |
| Mở/đóng luật chơi | Escape | Luật chơi / Đóng |

Bom căn vào ô đang đứng, nổ sau **2,5 giây**, gây **35 sát thương** và tồn tại
vùng nổ 0,65 giây. Vùng sáng báo phạm vi; chuyển đỏ và nhấp nháy khi sắp nổ.
Bom thường nổ hình chữ thập. Tường chặn vụ nổ; thùng bị phá và chặn phần tiếp
của tia. Bom trúng vụ nổ kích hoạt phản ứng dây chuyền. Người đặt được bước
ra khỏi bom nhưng không thể quay xuyên qua nó; bom chặn người khác.

Trúng sát thương có 0,7 giây bảo vệ, tránh nhận lặp sát thương của cùng vụ nổ.
HP về 0 sẽ bị loại và được tiếp tục xem trận. Bom của chính mình vẫn gây sát
thương. Chế độ đội mặc định không gây sát thương hay hiệu ứng xấu lên đồng đội.

## Năm nguyên tố

Kỹ năng hồi **14 giây**. Bốn kỹ năng cường hóa tác dụng lên bom đặt trong
**6 giây**, và bom giữ cường hóa đến khi nổ.

| Nguyên tố | Kỹ năng | Hiệu ứng |
| --- | --- | --- |
| Hỏa | Thiêu Đốt | Bom +1 ô tầm nổ và +15 sát thương |
| Thủy | Thủy Vực | Bom thành ba tia song song, tạo vùng chữ nhật theo hướng nhìn; làm chậm 50% trong 2 giây |
| Lôi | Lôi Kích | Bom thành đường thẳng theo hướng nhìn, vươn `2 × tầm nổ + 1` ô mỗi phía; nhảy 20 sát thương một lần tới đối thủ trong 2,5 ô, hoặc choáng mục tiêu 0,9 giây |
| Băng | Băng Bộc | Đóng băng nhân vật 1,5 giây; đóng băng bom trúng phải 1,5 giây và giữ lại thời gian ngòi nổ còn lại |
| Phong | Cuồng Phong | Đẩy bom phía trước tối đa 2 ô; gây 20 sát thương và đẩy đối thủ. Bom đặt trong 6 giây cũng đẩy mục tiêu khi nổ |

Tường vẫn chắn các tia nguyên tố; kỹ năng gió và lướt không xuyên tường.
Nhân vật đóng băng hoặc choáng không thể di chuyển, đặt bom, lướt hay dùng kỹ năng.

## Vật phẩm và kết thúc trận

Thùng có 55% cơ hội rơi vật phẩm. Bình hồi **30 HP** (tối đa 100);
tầm nổ tăng tối đa 5 ô, số bom tối đa 4, tốc độ tối đa 4,5 ô/giây.
Vụ nổ tiếp theo phá vật phẩm nằm trong vùng nổ.

Trận tối đa **3 phút**. Sau 2 phút, tường thu hẹp vào trong mỗi 12 giây;
nhân vật trong ô bị đóng sẽ bị loại. Nếu hết giờ mà còn nhiều bên, bên có
HP còn lại cao nhất thắng (đội cộng HP các thành viên sống); bằng nhau thì hòa.
Nếu tất cả bị loại cùng nhịp thì hòa. Luyện tập kết thúc khi bị loại hoặc hết giờ.

Máy có ba mức **Dễ / Thường / Khó**. Máy tìm đường tránh vật cản, dự đoán vùng
nổ và dây chuyền theo thời gian, chỉ đặt bom khi có đường thoát, ưu tiên hồi
máu khi thiếu HP, nhặt vật phẩm, phá thùng và truy đuổi đối thủ. Máy thường/khó
sử dụng kỹ năng và lướt; máy khó ưu tiên mục tiêu ít HP trong chế độ đội.
