# Luật Cờ tỷ phú Classic

Có 2–4 người, gồm người thật và tối đa 3 máy. Mỗi người bắt đầu ở Xuất phát với 1.000 tiền mặt,
chưa có tài sản hoặc thẻ. Ghế đầu tiên đi trước; lượt theo thứ tự ghế và bỏ qua người phá sản.
Người cuối cùng chưa phá sản thắng. Ván không giới hạn số lượt.
Số tiền dưới đây là đơn vị quy ước trong game.

## Bàn cờ

Bàn có 40 ô, gồm 24 đất phố, 4 bến xe, 2 Cơ hội, 2 Khí vận, 2 ô thuế,
Điện lực, Cấp nước và 4 ô góc. Thứ tự theo chiều kim đồng hồ, từ ô 0:

| Đoạn | Thứ tự ô |
| --- | --- |
| 0–9 | Xuất phát → Phú Quốc → Lào Cai → Việt Trì → Thuế thu nhập → Bến Bắc → Hạ Long → Cơ hội → Hải Phòng → Hà Nội |
| 10–19 | Nhà tù → Hải Dương → Điện lực → Thái Bình → Nam Định → Bến Tây → Thanh Hóa → Khí vận → Vinh → Hà Tĩnh |
| 20–29 | Sân bay → Huế → Cơ hội → Đà Nẵng → Hội An → Bến Nam → Kon Tum → Pleiku → Cấp nước → Đà Lạt |
| 30–39 | Vào tù → Nha Trang → Vũng Tàu → Khí vận → Biên Hòa → Bến Đông → Tp. HCM → Cần Thơ → Thuế xa xỉ → Cà Mau |

## Lượt chơi và di chuyển

Gieo hai xúc xắc, đi theo chiều kim đồng hồ số bước bằng tổng hai viên, rồi xử lý ô đến.
Đi qua hoặc dừng ở Xuất phát nhận 200. Ra đôi được gieo tiếp sau khi xử lý ô;
ra đôi ba lần liên tiếp trong một lượt thì vào tù ngay, không đi theo lần gieo thứ ba.
Vào tù làm mất lần gieo thêm. Khi không còn lần gieo thêm, bấm **Hết lượt** để chuyển ghế.

Đến đất phố, Điện lực hoặc Cấp nước chưa có chủ, có thể **Mua** nếu đủ tiền hoặc bấm **Hết lượt** ở tâm bàn.
Hết lượt kết thúc ngay lượt, kể cả vừa ra đôi, và giữ đất chưa có chủ.
Có thể quản lý tài sản để lấy tiền trước khi mua; không đủ tiền vẫn được kết thúc lượt.

Đến tài sản người khác chưa thế chấp thì trả tiền thuê. Chủ đang ở tù không thu tiền thuê.
Đến đất mình đã sở hữu có thể xây theo quy tắc công trình bên dưới.

## Các ô đặc biệt

| Ô | Hiệu lực |
| --- | --- |
| Xuất phát | Nhận 200 khi đi qua hoặc dừng lại |
| Cơ hội / Khí vận | Rút thẻ từ bộ tương ứng |
| Thuế thu nhập | Nộp `max(100, floor(10% × tiền mặt))` |
| Thuế xa xỉ | Nộp `max(200, floor(10% × tiền mặt))` |
| Điện lực / Cấp nước | Mua 150; khách trả cho chủ tổng xúc xắc ×4 nếu chủ có một đơn vị, ×10 nếu chủ có cả hai |
| Nhà tù | Đi tới bình thường chỉ là ghé thăm |
| Sân bay | Bay tới một trong 39 ô khác ngẫu nhiên, rồi xử lý ô đến |
| Vào tù | Chuyển thẳng tới Nhà tù, không nhận thưởng Xuất phát cho chặng chuyển này |

Thẻ thiếu điện/nước nhân đôi phí thuê ô tương ứng trong vòng bàn kế tiếp.
Điện/nước thế chấp hoặc chủ ở tù không thu phí. Đơn vị thế chấp vẫn tính khi xét sở hữu cả hai.
Thẻ tới điện/nước gần nhất và chuyến bay dùng tổng xúc xắc đã gieo để tính phí.
Một vòng bàn bắt đầu khi lượt quay về ghế đầu tiên còn chơi; hiệu lực hết khi vòng sau bắt đầu.
Các thẻ thiếu hụt cùng loại không cộng dồn mức phí. Giá trên ô hiển thị hệ số xúc xắc;
đuôi `x2` chỉ hiệu lực thiếu hụt. Đất thuộc bộ monopoly hiển thị giá thuê cơ bản với đuôi `x3`.

Sân bay không thưởng khi bay qua Xuất phát; đáp đúng Xuất phát nhận 200.
Chuyến bay giữ quyền gieo thêm từ xúc xắc đôi, trừ khi ô đến đưa người chơi vào tù.
Thẻ chuyển tới ô khác đi tiến theo chiều bàn và nhận thưởng khi qua Xuất phát.
Ô đến từ thẻ hoặc chuyến bay vẫn xử lý mua đất, xây, thuê hoặc sự kiện như một lần đến thường.

Cơ hội, Khí vận, thuế, Sân bay và việc bị đưa vào tù có bước **Xác nhận** trước khi áp dụng.
Chỉ người đang có lượt được xác nhận. Nếu ô đến tiếp tục có sự kiện thì xác nhận sự kiện mới riêng.
Tiền thuê và thưởng Xuất phát không cần xác nhận.

## Mua bán và đấu giá tài sản

Đất phố, Điện lực và Cấp nước mua trực tiếp theo giá niêm yết khi đến ô chưa có chủ.
Bến xe chưa có chủ dùng luật góp tiền bên dưới; điện/nước không xây công trình.

Trong lượt mình, người sở hữu có thể mở **Đấu giá** đất phố, điện/nước hoặc bến xe bất kỳ của mình,
không cần đứng trên ô đó. Người đang nợ tiền mua bến ngoài lượt cũng được mở bán để trả nợ.
Nút búa đấu giá mở bảng xác nhận tên tài sản, công trình và mức tăng giá tối thiểu;
chỉ bắt đầu phiên khi chọn **Mở đấu giá**. Chọn **Hủy** thì giữ nguyên tài sản.

- Người bán không trả giá; những người còn chơi trả giá lần lượt từ ghế tiếp theo người bán.
- Giá khởi đầu là 0. Mỗi lần trả giá phải tăng ít nhất `ceil(20% × giá gốc)` và không vượt tiền mặt.
  Ví dụ đất giá 180 có mức tăng tối thiểu 36, kể cả lần trả giá đầu.
- Người bỏ đấu giá không tham gia lại trong phiên. Người giữ giá cao nhất không được rút giá.
- Khi chỉ còn người giữ giá cao nhất, người đó trả giá thắng cho người bán và nhận tài sản.
  Công trình, tình trạng thế chấp và hạn chuộc được giữ. Không ai trả giá thì người bán giữ tài sản.
- Trong phiên không quản lý tài sản hoặc trao đổi. Hết phiên tiếp tục bước trước khi mở bán,
  giữ ô đang chờ mua hoặc khoản nợ.
- Người bán hoặc chủ lượt rời ván huỷ phiên. Người dẫn giá rời thì giá cao nhất trở về 0.

## Góp tiền bến xe

Mỗi bến chưa có chủ có một cuộc góp tiền riêng, kéo dài qua nhiều lượt.
Chỉ người vừa bước vào bến được **Góp** hoặc **Từ bỏ** ở bến đó.

Mức góp kế tiếp bằng mức vừa góp cộng 50: 50, 100, 150… Người góp trả toàn bộ mức mới,
không chỉ phần chênh lệch; tiền đó cộng vào khoản tích trữ riêng của họ tại bến. Góp xong tiếp tục lượt.

Người góp gần nhất không được góp lần nữa cho tới khi người khác góp vào chính bến đó.
Nếu quay lại khi vẫn là người góp gần nhất, họ đi tiếp mà không phải góp hoặc từ bỏ;
mức góp và tiền tích trữ giữ nguyên. Góp tại bến khác không mở lại quyền góp ở bến này.

Từ bỏ loại người đó khỏi cuộc góp tiền của bến cho tới khi chốt; ngân hàng hoàn ngay toàn bộ
tiền người đó đã góp và xóa khoản tích trữ, không chờ kết quả chung cuộc.
Người chưa từng đến bến cũng được tính là chưa từ bỏ. Người rời ván hoặc phá sản được loại khỏi cuộc góp.

Khi chỉ còn một người còn chơi chưa từ bỏ, ngân hàng hoàn tiền tích trữ cho tất cả,
rồi người còn lại nhận bến và trả giá gốc 200. Nếu không còn ai, hoàn tiền và giữ bến chưa có chủ.
Việc chốt diễn ra giữa các quyết định, khi đang chờ gieo hoặc kết thúc lượt.
Người thắng thiếu tiền được xử lý nợ ngân hàng, kể cả khi lượt hiện tại thuộc người khác.
Người rời/phá sản được hoàn khoản góp của mình khi thanh lý; khi ván kết thúc hoàn các khoản còn giữ.

Bến đang sở hữu thu `50 × số bến cùng chủ`: 50, 100, 150 hoặc 200.
Bến thế chấp vẫn được tính trong số bến cùng chủ, nhưng bản thân nó không thu thuê.
Thẻ tới bến gần nhất dùng cùng mức thuê.

## Công trình và tiền thuê đất phố

Khi quay lại đất phố đã sở hữu trong lượt mình, được xây một cấp trong lần đến đó.
Không xây ngay lần mua đất và không xây từ xa. Không cần đủ bộ màu hoặc xây đều.
Đất thế chấp không được xây. Có thể xây tối đa 4 nhà, rồi nâng thành khách sạn ở cấp 5.

Trong bảng thông tin ô, **Mua**, **Xây nhà** và **Xây khách sạn** là thao tác chính,
đặt phía trên các thao tác quản lý tài sản. Nút xây luôn hiện kèm giá trên đất của bạn;
khi chưa đủ điều kiện, nút màu xám và không bấm được.

Giá mỗi cấp bằng 50% giá đất. Ngân hàng có 32 nhà và 12 khách sạn.
Nâng lên khách sạn trả bốn nhà về ngân hàng; không thể xây nếu loại công trình cần dùng đã hết.
Bán từng cấp nhận 50% giá xây cấp đó. Bán khách sạn xuống 4 nhà cần ngân hàng còn đủ 4 nhà.

Tám bộ màu, mỗi bộ gồm ba đất phố kế tiếp trên đường đi, bỏ qua các ô khác:
(1, 2, 3), (6, 8, 9), (11, 13, 14), (16, 18, 19), (21, 23, 24), (26, 27, 29),
(31, 32, 34) và (36, 37, 39). Các ô cùng bộ không cần nằm liền nhau và có cùng màu viền.
Một người sở hữu đủ ba ô nhận monopoly:
**cả ba ô thu tiền thuê gấp 3 ở mọi cấp**, kể cả nhà và khách sạn. Mất một ô thì mất hệ số.
Ô đang thế chấp không thu thuê; quyền sở hữu của nó vẫn tính vào bộ.

Các ô liền nhau trong cùng bộ và cùng chủ gộp viền thành một khung chữ nhật theo mặt bàn.
Sở hữu hai ô trong bộ thì các khung sáng nhẹ; đủ ba ô thì mọi khung của bộ sáng mạnh
và có lửa chuyển động, kể cả khi các ô nằm cách nhau. Khung không nối qua ô khác bộ. Viền, quầng sáng và lửa nằm trong bề mặt ô, không tràn ra ngoài.
Ô pawn đang đứng không tô màu.
Mỗi tài sản đã mua có badge màu chủ sở hữu dạng dải mảnh, phủ hết chiều ngang phần mặt ô và sát mép đầu, không chừa khoảng trống hay bo góc;
badge nằm phẳng trong mép mặt ô, không che phần gờ hoặc làm tăng diện tích ô;
1–4 nhà là chấm trắng đè lên badge,
khách sạn là capsule trắng. Các ô không mua được có nền ánh kim, Khí vận màu vàng kim.

| Ô | Địa danh | Màu | Giá đất | Xây mỗi cấp | Trống | 1 nhà | 2 nhà | 3 nhà | 4 nhà | Khách sạn |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Phú Quốc | Nâu | 200 | 100 | 20 | 80 | 220 | 600 | 800 | 1000 |
| 2 | Lào Cai | Nâu | 150 | 75 | 15 | 60 | 165 | 450 | 600 | 750 |
| 3 | Việt Trì | Nâu | 180 | 90 | 18 | 72 | 198 | 540 | 720 | 900 |
| 6 | Hạ Long | Xanh nhạt | 280 | 140 | 28 | 112 | 308 | 840 | 1120 | 1400 |
| 8 | Hải Phòng | Xanh nhạt | 320 | 160 | 32 | 128 | 352 | 960 | 1280 | 1600 |
| 9 | Hà Nội | Xanh nhạt | 350 | 175 | 35 | 140 | 385 | 1050 | 1400 | 1750 |
| 11 | Hải Dương | Hồng | 220 | 110 | 22 | 88 | 242 | 660 | 880 | 1100 |
| 13 | Thái Bình | Hồng | 260 | 130 | 26 | 104 | 286 | 780 | 1040 | 1300 |
| 14 | Nam Định | Hồng | 240 | 120 | 24 | 96 | 264 | 720 | 960 | 1200 |
| 16 | Thanh Hóa | Cam | 270 | 135 | 27 | 108 | 297 | 810 | 1080 | 1350 |
| 18 | Vinh | Cam | 260 | 130 | 26 | 104 | 286 | 780 | 1040 | 1300 |
| 19 | Hà Tĩnh | Cam | 170 | 85 | 17 | 68 | 187 | 510 | 680 | 850 |
| 21 | Huế | Đỏ | 270 | 135 | 27 | 108 | 297 | 810 | 1080 | 1350 |
| 23 | Đà Nẵng | Đỏ | 300 | 150 | 30 | 120 | 330 | 900 | 1200 | 1500 |
| 24 | Hội An | Đỏ | 250 | 125 | 25 | 100 | 275 | 750 | 1000 | 1250 |
| 26 | Kon Tum | Vàng | 140 | 70 | 14 | 56 | 154 | 420 | 560 | 700 |
| 27 | Pleiku | Vàng | 160 | 80 | 16 | 64 | 176 | 480 | 640 | 800 |
| 29 | Đà Lạt | Vàng | 270 | 135 | 27 | 108 | 297 | 810 | 1080 | 1350 |
| 31 | Nha Trang | Xanh lá | 280 | 140 | 28 | 112 | 308 | 840 | 1120 | 1400 |
| 32 | Vũng Tàu | Xanh lá | 260 | 130 | 26 | 104 | 286 | 780 | 1040 | 1300 |
| 34 | Biên Hòa | Xanh lá | 220 | 110 | 22 | 88 | 242 | 660 | 880 | 1100 |
| 36 | Tp. HCM | Xanh đậm | 350 | 175 | 35 | 140 | 385 | 1050 | 1400 | 1750 |
| 37 | Cần Thơ | Xanh đậm | 300 | 150 | 30 | 120 | 330 | 900 | 1200 | 1500 |
| 39 | Cà Mau | Xanh đậm | 180 | 90 | 18 | 72 | 198 | 540 | 720 | 900 |

## Thế chấp và chuộc

Có thể thế chấp hoặc chuộc tài sản ở bất kỳ vị trí nào trong lượt mình, hoặc khi đang phải
trả nợ mua bến ngoài lượt. Chọn một hoặc nhiều tài sản trong bảng **Thế chấp tài sản**;
bảng mở từ nút ngân hàng, hiện khoản nhận của từng ô, tổng tiền và hạn chuộc.
Chỉ thực hiện thế chấp khi chọn **Xác nhận**; chọn **Hủy** thì giữ nguyên tài sản và tiền mặt.

Khoản vay bằng `50% × (giá đất + tổng giá xây các cấp hiện có)`.
Khách sạn tính bằng 5 lần giá xây một cấp. Ví dụ đất 200 có 2 nhà, mỗi cấp 100,
nhận khoản vay 200; chuộc trả 220. Tiền vay và giá bán công trình có thể có phần lẻ.

Nhà/khách sạn giữ trên đất và được thế chấp cùng đất; không thu thuê, không bán công trình riêng
khi chưa chuộc. Chuộc trả `ceil(110% × khoản vay)`, khôi phục đất và toàn bộ công trình.

Hạn chuộc là cuối lượt thứ ba tiếp theo của người vay. Lượt đang thế chấp không tính vào ba lượt;
gieo thêm do ra đôi không tính thành lượt mới. Hết hạn, ngân hàng thu hồi tài sản,
tháo toàn bộ công trình, trả chúng về ngân hàng và để đất trống chưa có chủ.
Đổi chủ giữ người vay và hạn gốc; người vay phá sản hoặc rời ván thì các khoản thế chấp của họ bị thu hồi.

Không mở bán, thế chấp hoặc chuộc trong lúc chờ xác nhận sự kiện, trao đổi hoặc đấu giá.

## Trao đổi

Người đang có lượt có thể đề nghị với một người còn chơi khác: đưa hoặc nhận tối đa một tài sản
mỗi bên và một khoản tiền mỗi bên. Tài sản phải đúng chủ và không có công trình; tiền đưa ra
phải đủ trong tiền mặt. Có thể trao đổi đất đang thế chấp, giữ khoản vay và hạn chuộc.

Người nhận đồng ý thì chuyển tài sản và tiền; từ chối hoặc bên đề nghị huỷ thì giữ nguyên.
Không trao đổi khi đang xác nhận sự kiện, đấu giá, trả nợ hoặc chờ một trao đổi khác.
Hết trao đổi tiếp tục quyết định trước đó.

Trong mục **Trao đổi**, chọn **Vé ra tù · 200 ₫** thay cho đất để bán một vé cho người nhận,
hoặc mua một vé của họ. Giá cố định 200, vé được giao dịch riêng, không kèm đất hoặc tiền thêm.
Người nhận phải đồng ý và bên mua đủ tiền; từ chối hoặc hết giờ không chuyển tiền/vé.
Vé giữ nguồn Cơ hội/Khí vận và trở về đúng bộ khi người mua sử dụng.

## Nhà tù

Vào tù do ô Vào tù, thẻ hoặc ba lần đôi; quân tới ô 10 và không được gieo thêm trong lượt ấy.
Đến Nhà tù bằng di chuyển thông thường không bị giam.

Đầu lượt khi ở tù có thể trả 50 hoặc dùng thẻ ra tù, rồi gieo bình thường.
Nếu không chọn cách đó, gieo để thử ra đôi:

- Ra đôi thì ra tù và đi theo tổng xúc xắc, nhưng không được gieo thêm vì lần đôi này.
- Hai lần thử đầu không ra đôi thì vẫn ở tù và kết thúc lượt.
- Lần thử thứ ba không ra đôi phải trả 50 rồi đi theo tổng vừa gieo; thiếu tiền thì xử lý nợ trước khi đi.

Người ở tù vẫn được quản lý tài sản nhưng không thu tiền thuê cho tới khi ra tù.
Khi ra tù, người chơi thấy hai cửa song sắt mở ra cùng âm thanh mở khóa.

## Nợ, phá sản và rời ván

Khoản phải trả lớn hơn tiền mặt đưa người trả vào bước **Nợ**. Bán công trình,
thế chấp hoặc đấu giá tài sản để lấy tiền, rồi **Trả** đủ khoản nợ một lần.
Nếu tiền mặt chưa đủ có thể **Phá sản**; đã đủ tiền thì phải trả.

Khi phá sản, hoàn tiền góp bến và thu hồi các khoản thế chấp có người vay là người phá sản trước.
Công trình còn lại của họ được thanh lý bằng nửa tổng giá xây.
Nếu chủ nợ là người chơi, chuyển tiền mặt, đất còn lại và thẻ ra tù cho chủ nợ;
công trình đã thanh lý không chuyển kèm. Đất thế chấp vay bởi người khác giữ khoản vay và hạn chuộc.
Nếu nợ ngân hàng hoặc rời ván, đất trả về ngân hàng, xoá thế chấp và công trình;
thẻ ra tù trả về bộ tương ứng. Người phá sản không tham gia lượt sau.

## Thẻ Cơ hội và Khí vận

Hai bộ được xáo riêng đầu ván, thứ tự bí mật. Rút từ đầu bộ;
thẻ thường trở về cuối bộ sau khi dùng. Thẻ ra tù giữ ngoài bộ tới khi sử dụng hoặc trả lại.
Thẻ sửa chữa tính cả công trình đang thế chấp; khách sạn chỉ chịu mức khách sạn,
không cộng thêm phí bốn nhà.

### Cơ hội

- Tiến về Xuất phát. Nhận 200.
- Tới Bến xe gần nhất.
- Tới Điện lực hoặc Cấp nước gần nhất.
- Tới Cà Mau.
- Tới Vinh.
- Ngân hàng trả lãi 50.
- Nhận cổ tức 100.
- Nộp phạt chạy quá tốc độ 15.
- Sửa chữa: 25 mỗi nhà, 100 mỗi khách sạn.
- Vào tù ngay.
- Giữ thẻ ra tù miễn phí.
- Được thưởng 150.
- Thiếu điện: thuế Điện lực gấp đôi trong vòng bàn kế tiếp.
- Thiếu nước: thuế Cấp nước gấp đôi trong vòng bàn kế tiếp.

### Khí vận

- Tiến về Xuất phát. Nhận 200.
- Ngân hàng chia lợi nhuận 200.
- Hoàn thuế 20.
- Nhận quà 100.
- Phí khám bệnh 50.
- Phí học tập 50.
- Bán cổ phiếu, nhận 50.
- Được thừa kế 100.
- Sửa chữa: 40 mỗi nhà, 115 mỗi khách sạn.
- Vào tù ngay.
- Giữ thẻ ra tù miễn phí.
- Trúng giải thưởng 10.

## Đồng hồ quyết định

Thời gian PvP chọn 15, 30, 60 hoặc 90 giây, mặc định 30. Khi còn ít nhất hai người thật,
đồng hồ áp dụng cho quyết định của người thật; một người thật với máy không dùng đồng hồ này.
Mỗi quyết định mới có thời hạn riêng. Xây, bán nhà, thế chấp, chuộc hoặc mở bảng quản lý
không kéo dài thời hạn đang chờ. Đồng hồ vẫn chạy khi mất kết nối.

| Quyết định hết hạn | Hành động tự động |
| --- | --- |
| Gieo | Gieo, kể cả khi đang ở tù |
| Mua đất | Mua nếu đủ tiền; không đủ thì kết thúc lượt |
| Kết thúc lượt | Chuyển sang người tiếp theo |
| Trao đổi | Từ chối |
| Trả nợ | Thanh lý công trình, thế chấp để trả; không đủ thì phá sản |

Mỗi lượt trả giá tài sản hoặc góp/từ bỏ bến có 10 giây riêng, kể cả bàn có máy.
Hết giờ tự bỏ; người đang giữ giá cao nhất trong phiên bán tài sản chỉ chuyển quyền trả giá,
không rút giá. Máy tự quyết định.

Sự kiện đặc biệt của người thật tự xác nhận sau 8 giây khi thông báo đã sẵn sàng,
nếu còn ít nhất hai người chưa phá sản. Nếu giao diện chưa sẵn sàng trong 30 giây,
thời hạn 8 giây bắt đầu dự phòng. Máy tự xác nhận.
Tốc độ hiệu ứng 1×/2× không đổi các thời hạn hoặc luật.

## Chiến thắng

Người cuối cùng chưa phá sản thắng; pawn của người đó phóng lớn ở giữa bàn, nhảy ăn mừng
cùng pháo hoa, thông điệp chiến thắng và nhạc kết quả Mậu Binh. Dãy số đếm lên tổng tài sản:
tiền mặt + giá gốc tài sản + tổng chi phí xây + 200 mỗi vé ra tù − tiền chuộc các tài sản thế chấp.
Các khoản góp bến còn giữ được hoàn trước khi tính tổng.
