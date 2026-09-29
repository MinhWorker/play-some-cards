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
  hàng hoặc rời ván, đất trở lại ngân hàng. Nhà được thanh lý theo nửa giá xây. Thẻ ra tù được
  chuyển cho chủ nợ, hoặc trả về chồng thẻ khi không có chủ nợ.

Các thẻ, địa danh và hình ảnh là nội dung riêng của game này. Mỗi chồng có 12 thẻ và được xáo
trộn ở đầu ván; thẻ ra tù được giữ ngoài chồng cho tới khi dùng. Tiền dùng đơn vị quy ước trong
game, không phải tiền thật.

## Điều khiển

Khi tạo phòng, chọn từ **0 đến 3 máy**. Máy tự gieo, mua hoặc đấu giá, xây nhà, xử lý nợ và
trả lời đề nghị trao đổi. Có thể chơi một mình với máy hoặc cùng bạn bè và máy.

Chạm một ô để xem giá, chủ đất, tiền thuê và tình trạng nhà ở cột bên phải. Nút giữa bàn thay
đổi theo bước hiện tại: gieo xúc xắc, mua/đấu giá, trả nợ hoặc kết thúc lượt. Khi chọn đất của
mình, cột bên phải hiện các nút xây, bán nhà, thế chấp và chuộc. Nút **Trao đổi** cho phép lần
lượt chọn người nhận, đất hai bên và số tiền; mỗi lần chạm vào một mục sẽ chuyển lựa chọn.

Mặt bàn dùng biểu tượng đơn sắc thay cho tên ô: nhà phố, ga, điện, nước, thẻ, thuế, tù và các ô
đặc biệt có dấu hiệu riêng. Biểu tượng và dải màu bộ đất được in theo phối cảnh trên mặt bàn;
game vẽ huy hiệu chủ đất, nhà, khách sạn và dấu thế chấp theo đúng mặt phẳng của từng ô. Sau khi
quân cờ đáp xuống, tên địa điểm được giữ trong bảng giữa bàn trước khi hiện quyết định hoặc lượt
gieo tiếp của máy. Bảng bên phải tự chuyển sang ô vừa đến; chạm ô bất kỳ để đọc chi tiết ô khác.

Chơi thử cùng nhiều ghế tại `/?play=co-ty-phu-classic&players=2` khi chạy `npm run dev`.

## Hình

Ảnh đảo, mặt bàn trống và nút gốc được tạo bằng imagegen theo `sources/prompts.json`. Script Blender
thu nhỏ lòng bàn, mở rộng mặt các ô, in biểu tượng vector một màu cùng dải màu bộ đất lên đó, rồi
kết xuất với mô hình gỗ thành `assets/board-25d.webp`. Dấu sở hữu, nhà, khách sạn và thế chấp được
vẽ lúc chơi theo tọa độ ô do cùng camera Blender tạo ra.
Chạy `blender -b -t 4 --python games/co-ty-phu-classic/sources/render_board_25d.py` từ gốc repo
để tạo lại ảnh và tọa độ 40 ô. File Blender chỉnh sửa được nằm ở
`.blender/co-ty-phu-classic-board.blend` (đã bỏ qua trong git). Tên địa danh, số tiền và dấu sở
hữu do game vẽ theo trạng thái server để mọi người thấy cùng một ván.

HUD đặt thông tin người chơi ở bên trái, ô đang xem và các thao tác đất ở bên phải. Lượt chơi,
thông báo và nút hành động nằm trong lòng bàn cờ; ô đặc biệt dùng thẻ thông tin ngắn để không
che bớt nền. Bảng tự co theo khung ngang của điện thoại, máy tính bảng và máy tính.

Đầu ván, bảng giữa bàn cờ giới thiệu tất cả người chơi bằng màu quân và số tiền khởi điểm;
chọn **Vào ván** để bắt đầu xem lượt chơi.
Mỗi lượt đi theo nhịp **gieo xúc xắc → đọc kết quả → nhảy từng ô → hiện kết quả đến ô và
lựa chọn**. Hai xúc xắc đứng yên thêm 1,5 giây trước khi quân bắt đầu đi; mỗi ô có một cú
nhảy và một nhịp đáp riêng. Trong lúc đó, các nút hành động tạm ẩn.

Hai khối xúc xắc xoay trong không gian 3D rồi dừng đúng mặt mà server đã gieo. Bốn quân cờ
men màu đỏ, xanh dương, xanh lá và vàng được dựng, chiếu sáng và kết xuất riêng trong Blender.
File chỉnh sửa nằm ở `.blender/co-ty-phu-classic-pawns.blend`; chạy
`blender -b -t 4 --python games/co-ty-phu-classic/sources/render_pawns.py` để tạo lại ảnh.
Quân cờ nhảy theo góc nhìn của bàn, tiền nổi lên khi số dư đổi, và ô đất sáng lên khi mua
hoặc xây. Game có nhạc nền cùng hiệu ứng riêng cho lượt, thẻ, đấu giá, xây dựng, nhà tù và kết
thúc ván. Danh sách âm thanh nằm trong [tài liệu âm thanh](../../docs/co-ty-phu-classic-audio.md).
