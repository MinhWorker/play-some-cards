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
5. Bàn Phaser với ảnh tạo bằng imagegen, lựa chọn ô, nút theo bước chơi và cổng đảo riêng.

## Tiêu chí hoàn thành

- Người không có lượt không thể gieo hoặc mua; đấu giá và trao đổi không thể chuyển tiền/đất
  vượt quá tài sản của người tham gia.
- Thứ tự hai chồng thẻ không có trong view gửi tới người chơi hay khán giả.
- Một ván có thể tiếp tục khi người chơi rời phòng, và kết thúc khi chỉ còn một người.
- Chơi thử qua sandbox, chạy `npm run check` và kịch bản trình duyệt của game.

Các luật chi tiết và điểm điều chỉnh của phiên bản này nằm ở [README](README.md).
