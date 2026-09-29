# Cờ tỷ phú Classic

Hai đến bốn người cùng mua đất, thu tiền thuê và quản lý tài sản trên bàn 40 ô. Người còn lại
cuối cùng sau khi các đối thủ phá sản thắng ván. Đây là phiên bản có địa danh Việt Nam và hình
riêng của Chơi chút bài; [luật Monopoly Classic của Hasbro](https://instructions.hasbro.com/en-ca/instruction/monopoly-game)
là tham khảo cho cấu trúc bàn và các cơ chế chính.

## Một lượt chơi

- Mỗi người bắt đầu ở **Xuất phát** với 1.500. Gieo hai xúc xắc và đi theo chiều tăng số ô.
  Đi qua hoặc dừng ở Xuất phát nhận 200. Nếu ra đôi, giải quyết ô đang đứng rồi gieo thêm;
  ra đôi ba lần liên tiếp thì vào tù ngay.
- Đến đất chưa có chủ, chọn **Mua** theo giá ghi trên ô hoặc **Đấu giá**. Khi đấu giá, từng
  người tăng giá hoặc bỏ cuộc. Người trả cao nhất trong số tiền mình có nhận đất.
- Đến đất người khác sở hữu và chưa thế chấp, trả tiền thuê. Đất cùng màu được một người sở hữu
  trọn bộ thì tiền thuê đất trống gấp đôi. Ga thu 25, 50, 100 hoặc 200 theo số ga cùng chủ;
  điện/nước thu 4 hoặc 10 lần tổng xúc xắc theo số đơn vị cùng chủ.
- **Cơ hội** và **Cộng đồng** rút thẻ theo thứ tự bí mật. Thuế nộp cho ngân hàng. **Bãi đỗ miễn
  phí** không phát tiền. Ô **Vào tù** chuyển thẳng tới nhà tù, không nhận 200.
- Trong tù, bạn có thể trả 50, dùng thẻ ra tù, hoặc thử gieo đôi. Nếu lần thứ ba vẫn không ra
  đôi, phải trả 50 rồi đi theo xúc xắc vừa gieo. Ra đôi để thoát tù không được gieo thêm.

## Tài sản và nợ

- Khi sở hữu đủ bộ màu chưa thế chấp, có thể xây đều trên các ô của bộ. Mỗi ô tối đa bốn nhà,
  sau đó là một khách sạn. Ngân hàng có 32 nhà và 12 khách sạn. Bán nhà thu lại nửa giá xây,
  cũng phải bán đều.
- Thế chấp đất sau khi đã bán hết nhà trong bộ màu: nhận nửa giá đất, không thu tiền thuê trong
  lúc thế chấp. Chuộc với 110% tiền đã vay.
- Người đang có lượt có thể đề nghị trao đổi đất và tiền với một người khác. Hai bên phải xác
  nhận; đất có nhà trong bộ màu không được đổi.
- Khi thiếu tiền trả, ván tạm ở bước **Nợ**. Bán nhà hoặc thế chấp để đủ tiền rồi chọn **Trả**;
  nếu không thể trả, chọn **Phá sản**. Tài sản của người phá sản chuyển cho chủ nợ; nếu nợ ngân
  hàng hoặc rời ván, đất trở lại ngân hàng. Nhà được thanh lý theo nửa giá xây.

Các thẻ, địa danh và hình ảnh là nội dung riêng của game này. Mỗi chồng có 12 thẻ và được xáo
trộn ở đầu ván; thẻ ra tù được giữ ngoài chồng cho tới khi dùng. Tiền dùng đơn vị quy ước trong
game, không phải tiền thật.

## Điều khiển

Chạm một ô để xem giá, chủ đất, tiền thuê và tình trạng nhà ở cột bên phải. Nút giữa bàn thay
đổi theo bước hiện tại: gieo xúc xắc, mua/đấu giá, trả nợ hoặc kết thúc lượt. Khi chọn đất của
mình, cột bên phải hiện các nút xây, bán nhà, thế chấp và chuộc. Nút **Trao đổi** cho phép lần
lượt chọn người nhận, đất hai bên và số tiền; mỗi lần chạm vào một mục sẽ chuyển lựa chọn.

Chơi thử cùng nhiều ghế tại `/?play=co-ty-phu-classic&players=2` khi chạy `npm run dev`.

## Hình

Ảnh đảo, bàn và nút được tạo bằng imagegen theo mô tả trong `sources/prompts.json`; game hiển
thị các ảnh WebP trong `assets/`. Tên địa danh, số tiền và dấu sở hữu do game vẽ theo trạng thái
server để mọi người thấy cùng một ván.
