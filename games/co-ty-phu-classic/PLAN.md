# Kế hoạch Cờ tỷ phú Classic

## Đích đến

Một ván 2–4 người chơi được trên trình duyệt, từ lúc nhận tiền và mua ô đầu tiên tới khi chỉ
còn một người chưa phá sản. Bàn 40 ô phải đọc được ở khung ngang nhỏ nhất; các quyết định có
tiền hoặc đổi chủ đất do server kiểm tra.

## Phạm vi đã triển khai

1. Bàn 40 ô với tám bộ màu, bốn ga, hai đơn vị tiện ích, hai loại thẻ, thuế và nhà tù.
2. Lượt gieo xúc xắc, đi qua Xuất phát, lượt gieo đôi, mua đất và đấu giá.
3. Tiền thuê theo bộ màu, ga và tiện ích; xây đều, khách sạn, số lượng nhà trong ngân hàng,
   bán nhà, thế chấp và chuộc.
4. Hai chồng thẻ được xáo trộn phía server, thẻ ra tù, đề nghị trao đổi cần hai bên đồng ý,
   xử lý nợ và phá sản.
5. Bàn 2.5D kết xuất từ Blender; biểu tượng đơn sắc và dải màu được in theo phối cảnh lên mặt bàn,
   biểu tượng đất đổi màu theo chủ sở hữu; nhà, khách sạn và dấu thế chấp được vẽ bám theo từng ô.
6. Tuỳ chọn 0–3 máy; máy tự xử lý lượt, đấu giá, nợ và trao đổi.
7. Xúc xắc và quân cờ chuyển động, phản hồi hình ảnh cho tài sản và tiền; nhạc nền cùng hiệu ứng
   âm thanh riêng được tạo bằng code.
8. Mặt bàn gỗ dựng và kết xuất trong Blender với góc nhìn 2.5D; tọa độ ô được chiếu từ cùng
   camera, quân cờ đi theo các ô này, và hai khối xúc xắc 3D xoay đến đúng kết quả server.

## Nhịp trình bày một lượt

| Bước | Người chơi thấy gì | Khi nào chuyển tiếp |
| --- | --- | --- |
| Sẵn sàng | Bảng giữa bàn ghi tên, màu quân và 1.000 ₫ của từng ghế. | Tiền tăng xong, giữ lại một giây rồi tự đóng. |
| Gieo | Hai xúc xắc lăn; quân, số dư và vị trí trong danh sách vẫn ở trạng thái cũ. | Xúc xắc dừng đúng kết quả server sau khoảng 1,1 giây. |
| Xem kết quả | Hai mặt xúc xắc và tổng số ô đứng yên để người xem đọc. | Sau 1,5 giây. |
| Đi | Quân nhảy từng ô, đáp xuống từng ô ngắn rồi mới nhảy tiếp; xúc xắc đứng yên, chưa hiện lựa chọn. | Quân đến ô cuối, hoặc tới tù khi luật yêu cầu. |
| Đến ô | Hiện tên địa điểm và kết quả trên bảng giữa bàn khoảng 1,3 giây; mặt bàn chỉ dùng biểu tượng, không ghi tên ô. | Hiện quyết định hoặc phát lượt gieo tiếp của máy. |
| Giải quyết | Hiện thay đổi tiền, thẻ và các nút mua, đấu giá, trả nợ hoặc kết thúc lượt. | Quyết định của người chơi hoặc máy được server chấp nhận. |
| Chuyển lượt | Tên người có lượt và các thao tác tiếp theo xuất hiện. | Người đó gieo xúc xắc. |

Đây là các bước trình bày ở máy người xem. Server vẫn quyết định luật và gửi kết quả ngay;
giao diện xếp các lượt gieo của máy thành hàng để xem theo thứ tự. Người vào giữa ván bắt đầu
ở trạng thái hiện tại, không phát lại các chuyển động đã qua.

## Tiêu chí hoàn thành

- Người không có lượt không thể gieo hoặc mua; đấu giá và trao đổi không thể chuyển tiền/đất
  vượt quá tài sản của người tham gia.
- Thứ tự hai chồng thẻ không có trong view gửi tới người chơi hay khán giả.
- Một ván có thể tiếp tục khi người chơi rời phòng, và kết thúc khi chỉ còn một người.
- Chơi thử qua sandbox, chạy `npm run check` và kịch bản trình duyệt của game.

Các luật chi tiết và điểm điều chỉnh của phiên bản này nằm ở [README](README.md).
