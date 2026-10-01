# Luật hiện tại — Cờ tỷ phú Classic

Bản ghi này mô tả code hiện tại sau cập nhật luật và giao diện ngày 01/10/2026:
chủ đất ở tù không thu tiền thuê; xây một cấp khi quay lại đất phố đã sở hữu.
Dùng bản này để đọc và đề xuất sửa luật tiếp. Số tiền là đơn vị quy ước trong game, dù giao diện hiển thị ký hiệu ₫.

Nguồn đối chiếu:

- [Khởi tạo, lượt chơi và các thao tác](../games/co-ty-phu-classic/src/game/CoTyPhuClassicGame.ts).
- [Di chuyển, tiền thuê, thẻ và phá sản](../games/co-ty-phu-classic/src/game/rules.ts).
- [Bàn cờ và dữ liệu người chơi](../games/co-ty-phu-classic/src/game/model.ts).
- [Hai bộ thẻ](../games/co-ty-phu-classic/src/game/cards.ts).
- [Quyết định của máy](../games/co-ty-phu-classic/src/game/bot.ts).
- [Điều kiện hiện nút quản lý đất](../games/co-ty-phu-classic/src/scenes/tileActions.ts).

## 1. Người chơi, khởi đầu và thắng ván

- Một phòng có **2–4 người**, gồm người thật và máy. Khi tạo phòng có thể chọn **0–3 máy**.
- Mỗi người bắt đầu với **1.500 tiền mặt**, đứng tại ô **0 — Xuất phát**, chưa có đất hoặc thẻ.
- Toàn bộ tài sản ban đầu thuộc ngân hàng, chưa xây dựng và chưa thế chấp.
- Người ở ghế đầu tiên đi trước; lượt tiếp theo theo thứ tự ghế, bỏ qua người đã phá sản.
- Hai bộ Cơ hội và Cộng đồng được xáo riêng một lần ở đầu ván. Thứ tự thẻ không công khai.
- Khi chỉ còn **một người chưa phá sản**, người đó thắng ván.
- Chưa có giới hạn số lượt, giới hạn thời gian cả ván hoặc cách thắng theo tổng tài sản.
- Tùy chọn phòng hiện chỉ có số máy; chưa tùy chỉnh tiền khởi đầu hoặc các luật kinh tế.

## 2. Một lượt chơi

1. Người đang có lượt gieo **hai xúc xắc**, mỗi viên từ 1 đến 6.
2. Đi theo chiều tăng số ô, số bước bằng tổng hai viên; sau ô 39 quay về ô 0.
3. Xử lý ô vừa đến: mua/đấu giá, trả tiền thuê hoặc xác nhận sự kiện.
4. Nếu ra đôi và không bị đưa vào tù, xử lý xong ô rồi gieo tiếp trong cùng lượt.
5. Nếu không được gieo thêm, chọn **Kết thúc lượt** để chuyển sang người tiếp theo.

**Xúc xắc đôi:** ra đôi ba lần liên tiếp trong cùng lượt thì bị đưa vào tù ở lần thứ ba,
không đi theo tổng xúc xắc lần đó. Việc vào tù được áp dụng sau bước xác nhận sự kiện.

**Thưởng Xuất phát:** đi qua hoặc dừng ở Xuất phát nhận **200** từ ngân hàng. Khi thẻ đưa
người chơi đi tiến qua Xuất phát cũng nhận thưởng. Chuyển thẳng vào tù không có thưởng cho
chặng chuyển tới tù; khoản thưởng đã nhận khi đi tới ô rút thẻ trước đó vẫn được giữ.

## 3. Các ô đặc biệt và xác nhận sự kiện

| Ô | Hiệu lực |
| --- | --- |
| Xuất phát | Nhận 200 khi đi qua hoặc dừng ở đây |
| Cơ hội | Rút một thẻ Cơ hội |
| Cộng đồng | Rút một thẻ Cộng đồng |
| Thuế thu nhập | Nộp ngân hàng 200 cố định |
| Thuế xa xỉ | Nộp ngân hàng 100 cố định |
| Nhà tù / Thăm | Đến bằng di chuyển thông thường chỉ là ghé thăm, không bị giam |
| Bãi đỗ miễn phí | Không nhận tiền và không có tác động khác |
| Vào tù | Chuyển tới ô 10, bị giam và mất quyền gieo thêm |

Thẻ, thuế và sự kiện bị đưa vào tù có bước **Xác nhận** trước khi áp dụng hiệu lực. Chỉ người
đang có lượt được xác nhận. Có thể xác nhận sớm; không cần chờ hết thời hạn.

Với người thật, khi còn ít nhất hai người chưa phá sản:

- Thời hạn tự xác nhận là **8 giây**, bắt đầu khi giao diện báo thông báo đã sẵn sàng.
- Nếu giao diện chưa báo sẵn sàng trong **30 giây**, server bắt đầu thời hạn 8 giây dự phòng.
- Máy tự xác nhận bằng quyết định của máy, không dùng thời hạn này.
- Sandbox chỉ có một ghế không có thời hạn tự xác nhận.

Cơ hội và Cộng đồng có nhịp rút thẻ trước khi công bố nội dung: bộ thẻ dạng nét mực
in trên mặt bàn, lá trên trượt ra rồi xoay/lật. Tiếng chia và đánh bài được dùng lại từ
Tiến Lên. Thời hạn 8 giây bắt đầu sau khi nhịp này hoàn tất và nút Xác nhận hiện ra.

Tiền thuê và thưởng Xuất phát được xử lý ngay, không cần xác nhận. Nếu hiệu lực thẻ dẫn đến
một ô sự kiện khác, ô mới tiếp tục có bước xác nhận riêng.

Các bước gieo, mua, đấu giá, trả nợ, trao đổi và kết thúc lượt hiện **không có thời hạn tự
quyết định cho người thật**. Tốc độ trình bày 1×/2× không đổi luật hay thời hạn của server.

## 4. Mua tài sản và đấu giá

Tài sản mua được gồm **đất phố, ga, điện và nước**.

### Mua trực tiếp

- Đến tài sản chưa có chủ thì phải xử lý bước mua: **Mua** theo giá niêm yết hoặc **Đấu giá**.
- Chỉ người đang có lượt được mua trực tiếp, và phải có đủ tiền mặt trả toàn bộ giá.
- Nếu không đủ tiền, có thể quản lý tài sản để lấy tiền hoặc mở đấu giá.
- Không có thao tác bỏ qua tài sản chưa có chủ mà không đấu giá.

### Đấu giá

- Người vừa đến ô là người trả giá đầu tiên. Tất cả người chưa phá sản đều được tham gia,
  kể cả người đã từ chối mua trực tiếp.
- Giá mở đầu là **0**. Mỗi lần trả phải cao hơn giá hiện tại ít nhất **1**, là số nguyên và
  không vượt tiền mặt của người trả. Giới hạn đầu vào của một lần trả là **100.000**.
- Giao diện có các nút tăng **1 / 10 / 50** so với giá cao nhất hiện tại.
- Sau mỗi lần trả hoặc bỏ giá, chuyển sang người tiếp theo chưa bỏ cuộc.
- Đã bỏ cuộc thì không được quay lại phiên đó.
- Người đang giữ giá cao nhất không được bỏ giá của chính mình.
- Khi chỉ còn người giữ giá cao nhất chưa bỏ cuộc, người đó trả tiền cho ngân hàng và nhận
  tài sản. Nếu mọi người bỏ mà chưa có ai trả giá, tài sản vẫn thuộc ngân hàng.
- Không được xây, bán nhà, thế chấp, chuộc hoặc mở trao đổi trong lúc đấu giá.
- Sau phiên đấu giá, người vừa đến ô tiếp tục gieo nếu trước đó ra đôi; nếu không thì kết
  thúc lượt.

## 5. Tiền thuê

Đến tài sản của người khác thì trả tiền thuê cho chủ sở hữu. Không trả khi đó là tài sản của
mình, tài sản đang thế chấp hoặc tài sản có **chủ đang bị giam trong tù**. Quy tắc chủ ở tù
áp dụng cho đất phố, ga, điện và nước. Khi chủ ra tù, các ô đó thu thuê bình thường trở lại.
Thuế thu nhập/xa xỉ vẫn nộp ngân hàng theo mức cố định.

### Đất phố

- Đất trống tính theo cột **Trống** ở bảng mục 12.
- Nếu một người sở hữu toàn bộ nhóm màu, tiền thuê đất trống trong nhóm **gấp đôi**.
- Từ một nhà trở lên, dùng trực tiếp mức thuê tương ứng, không nhân đôi thêm.
- Điều kiện nhân đôi hiện chỉ kiểm tra quyền sở hữu cả nhóm: một ô khác cùng nhóm đang thế
  chấp không làm mất mức thuê gấp đôi ở ô chưa thế chấp.

### Ga

| Số ga cùng chủ | Tiền thuê |
| --- | ---: |
| 1 | 25 |
| 2 | 50 |
| 3 | 100 |
| 4 | 200 |

Số ga cùng chủ được tính gồm cả ga đang thế chấp. Bản thân ga đang thế chấp không thu thuê.
Thẻ **Tới Ga gần nhất** làm tiền thuê ga đó **gấp đôi** nếu ga thuộc người khác.

### Điện và nước

- Chủ có một đơn vị: tiền thuê bằng **4 × tổng xúc xắc**.
- Chủ có cả Điện lực và Cấp nước: tiền thuê bằng **10 × tổng xúc xắc**.
- Việc sở hữu cả hai vẫn được tính nếu đơn vị còn lại đang thế chấp; ô đang thế chấp không
  thu thuê.
- Thẻ **Tới Điện lực hoặc Cấp nước gần nhất** áp dụng **10 × tổng xúc xắc**, kể cả chủ chỉ có
  một đơn vị.
- Tổng xúc xắc dùng ở đây là tổng của lần gieo dẫn tới việc rút thẻ; **không gieo lại** khi
  thẻ đưa tới điện/nước.

## 6. Xây nhà, khách sạn và bán nhà

### Xây dựng

- Chỉ xây trên **đất phố của mình, chưa thế chấp**, không cần sở hữu đủ bộ màu.
- Chỉ người đang có lượt, vừa **quay lại đúng ô đất đã sở hữu**, được xây tại ô đó. Mỗi lần
  quay lại cho phép tăng **một cấp**; lần vừa mua hoặc thắng đấu giá chưa được xây.
- Quyền xây của lần ghé đó hết khi đã xây, gieo tiếp hoặc kết thúc lượt. Nếu không đủ tiền,
  có thể bán/thế chấp tài sản khác để lấy tiền trước khi rời ô.
- Mỗi lần xây tăng một cấp: **0 → 1 → 2 → 3 → 4 nhà → 1 khách sạn**.
- Mỗi bước đều trả một lần giá xây của ô, kể cả bước đổi 4 nhà thành khách sạn.
- Số công trình trên từng ô độc lập; không cần xây đều với các ô cùng màu và không bị
  chặn bởi việc ô khác trong nhóm màu đang thế chấp.
- Ngân hàng có **32 nhà và 12 khách sạn**. Thiếu loại công trình cần dùng thì không xây được.
- Đổi 4 nhà thành khách sạn trả lại 4 nhà cho nguồn cung ngân hàng.
- Không xây trên ga, điện hoặc nước.

### Bán công trình

- Mỗi thao tác bán giảm một cấp và nhận **một nửa giá xây** từ ngân hàng.
- Được bán trên từng ô độc lập, không cần bán đều trong bộ màu.
- Bán một cấp khách sạn đổi khách sạn thành **4 nhà**, nhận nửa giá xây. Ngân hàng phải có
  đủ 4 nhà để đổi; nếu thiếu thì thao tác bị từ chối.
- Không có thao tác bán thẳng cả khách sạn về đất trống khi ngân hàng thiếu nhà.

### Khi nào được quản lý tài sản?

**Xây** chỉ được thực hiện trong lượt mình, ở lần quay lại ô đủ điều kiện nêu trên.
**Bán nhà, thế chấp và chuộc** được phép trên tài sản của mình **kể cả ngoài lượt mình**,
trong các bước gieo, mua, nợ hoặc kết thúc lượt. Các thao tác này bị khóa khi đang xác nhận
sự kiện, đấu giá hoặc trao đổi. Mỗi thao tác vẫn phải thỏa điều kiện về quyền sở hữu, tiền,
số công trình và nguồn cung.

## 7. Thế chấp và chuộc

- Phải bán hết công trình **trên chính ô đất đó** trước khi thế chấp; công trình trên các
  ô khác cùng màu không ảnh hưởng.
- Thế chấp nhận **50% giá niêm yết**; tài sản vẫn thuộc người đang sở hữu.
- Tài sản thế chấp không thu tiền thuê.
- Chuộc trả **110% khoản thế chấp**, làm tròn lên tới số nguyên.
- Không có lãi tăng theo thời gian hoặc thời hạn bắt buộc chuộc.
- Tài sản thế chấp vẫn được trao đổi. Khi chuyển chủ bằng trao đổi hoặc phá sản, trạng thái
  thế chấp được giữ; người nhận chưa phải trả phí nhận tài sản hay tiền chuộc ngay.

Ví dụ: đất giá 350 thế chấp nhận 175; chuộc phải trả `ceil(175 × 1,1) = 193`.

## 8. Nhà tù

Người chơi bị giam khi đến ô Vào tù, rút thẻ vào tù hoặc ra đôi ba lần trong cùng lượt.
Quân chuyển tới ô 10; không nhận thưởng cho chặng chuyển thẳng này, chuỗi đôi bị xóa và
lượt đó chuyển sang bước kết thúc.

Đầu lượt khi đang ở tù có ba lựa chọn:

1. **Trả bảo lãnh 50** nếu đủ tiền mặt, rồi gieo và di chuyển bình thường. Sau khi đã trả
   bảo lãnh, nếu gieo đôi thì được gieo thêm theo luật bình thường.
2. **Dùng thẻ ra tù miễn phí**, rồi gieo bình thường. Thẻ được trả xuống cuối bộ đã rút.
3. **Thử gieo đôi** để ra tù:
   - Ra đôi: ra tù, đi theo tổng xúc xắc, xử lý ô đến; **không được gieo thêm** vì lần đôi này.
   - Không ra đôi ở lần thử thứ nhất hoặc thứ hai: ở nguyên trong tù, kết thúc lượt.
   - Không ra đôi ở lần thử thứ ba: bắt buộc trả **50**, ra tù và đi theo tổng vừa gieo.
     Nếu chưa đủ tiền, xử lý nợ 50 trước, sau khi trả mới di chuyển.

Trong tù **không thu tiền thuê**. Vẫn có thể bán công trình, thế chấp hoặc chuộc tài sản
theo các điều kiện ở mục 6–7. Có thể
đề nghị trao đổi nếu đang có lượt và không ở bước bị khóa.

## 9. Cơ hội và Cộng đồng

Mỗi bộ có **12 thẻ**, rút từ đầu bộ. Sau khi xác nhận, thẻ thông thường được đưa xuống cuối
bộ, không xáo lại. Thẻ ra tù được giữ ngoài bộ cho đến khi dùng hoặc được trả về do phá sản.
Một người có thể giữ thẻ ra tù của cả hai bộ; khi dùng, game lấy thẻ được nhận trước.

Thẻ di chuyển đưa quân tới ô đích và xử lý ô đó như bình thường: mua/đấu giá, trả thuê hoặc
rút thẻ tiếp. Thẻ tới ga/điện/nước chọn ô gần nhất **ở phía trước**; nếu không còn ô phù hợp
phía trước thì đi vòng qua Xuất phát. Các thẻ vào tù chuyển thẳng, không nhận thưởng cho
chặng đó.

### Bộ Cơ hội

| Thẻ | Hiệu lực |
| --- | --- |
| Tiến về Xuất phát. Nhận 200. | Tới ô 0, nhận 200 |
| Tới Ga gần nhất. | Tới ga phía trước gần nhất; thuê gấp đôi nếu thuộc người khác |
| Tới Điện lực hoặc Cấp nước gần nhất. | Tới đơn vị phía trước gần nhất; thuê bằng 10 × tổng xúc xắc vừa gieo nếu thuộc người khác |
| Tới Phố Đi Bộ. | Tới ô 39, xử lý ô đích |
| Tới Tràng Tiền. | Tới ô 18, nhận 200 nếu đi qua Xuất phát, xử lý ô đích |
| Ngân hàng trả lãi 50. | Nhận 50 từ ngân hàng |
| Nhận cổ tức 100. | Nhận 100 từ ngân hàng |
| Nộp phạt chạy quá tốc độ 15. | Nộp ngân hàng 15 |
| Sửa chữa: 25 mỗi nhà, 100 mỗi khách sạn. | Nộp ngân hàng tổng phí trên công trình của mình |
| Vào tù ngay. | Chuyển thẳng vào tù |
| Giữ thẻ ra tù miễn phí. | Giữ thẻ để dùng sau |
| Được thưởng 150. | Nhận 150 từ ngân hàng |

### Bộ Cộng đồng

| Thẻ | Hiệu lực |
| --- | --- |
| Tiến về Xuất phát. Nhận 200. | Tới ô 0, nhận 200 |
| Ngân hàng chia lợi nhuận 200. | Nhận 200 từ ngân hàng |
| Hoàn thuế 20. | Nhận 20 từ ngân hàng |
| Nhận quà 100. | Nhận 100 từ ngân hàng |
| Phí khám bệnh 50. | Nộp ngân hàng 50 |
| Phí học tập 50. | Nộp ngân hàng 50 |
| Bán cổ phiếu, nhận 50. | Nhận 50 từ ngân hàng |
| Được thừa kế 100. | Nhận 100 từ ngân hàng |
| Sửa chữa: 40 mỗi nhà, 115 mỗi khách sạn. | Nộp ngân hàng tổng phí trên công trình của mình |
| Vào tù ngay. | Chuyển thẳng vào tù |
| Giữ thẻ ra tù miễn phí. | Giữ thẻ để dùng sau |
| Trúng giải thưởng 10. | Nhận 10 từ ngân hàng |

Phí sửa chữa tính mỗi khách sạn một lần theo giá khách sạn, không cộng thêm phí của 4 nhà
đã thay thế. Chỉ tính công trình thuộc người rút thẻ.

## 10. Trao đổi

- Chỉ người **đang có lượt** được mở đề nghị, tại bước gieo, mua hoặc kết thúc lượt.
- Không mở trao đổi khi đang xác nhận sự kiện, đấu giá, xử lý nợ hoặc chờ một trao đổi khác.
- Mỗi đề nghị giữa hai người còn trong ván có thể gồm **tối đa một tài sản mỗi bên** và một
  khoản tiền mỗi bên. Có thể chỉ chuyển tiền hoặc chỉ chuyển tài sản; đề nghị hoàn toàn
  trống bị từ chối.
- Đất đưa ra phải thuộc bên tương ứng và **chính ô đất đem đổi** phải không còn nhà hoặc
  khách sạn. Công trình trên các ô khác cùng màu không chặn trao đổi.
- Hai bên phải có đủ tiền mặt cho khoản tiền riêng mình đưa ra **trước khi trao đổi**; chưa
  được dùng khoản tiền sắp nhận để bù khoản tiền đưa ra.
- Giao diện chỉnh tiền bằng bước **50**, tối đa theo số dư. Server chấp nhận số nguyên từ
  **0–100.000** cho mỗi bên.
- Người nhận chọn chấp nhận hoặc từ chối. Người gửi có thể hủy trước khi được chấp nhận.
- Trong lúc chờ, quản lý tài sản bị khóa; ván chờ câu trả lời, không có tự hết hạn.
- Khi chấp nhận, đổi chủ tài sản và chuyển tiền hai chiều, sau đó trở lại bước trước đề nghị.
- Không có trao đổi thẻ ra tù, nhiều tài sản cùng lúc hoặc bán riêng đất cho ngân hàng.

## 11. Nợ, phá sản và rời ván

### Nợ

- Nếu thiếu tiền mặt để trả một khoản bắt buộc, game ghi **toàn bộ số tiền phải trả** làm nợ.
  Chưa chuyển tiền từng phần và chưa trừ tiền mặt ngay.
- Người đang nợ có thể bán công trình hoặc thế chấp, rồi chọn **Trả** khi có đủ tiền.
- Không được trao đổi trong bước nợ; không có trả góp hoặc vay khác ngoài thế chấp.
- Sau khi trả, trở lại bước gieo tiếp hoặc kết thúc lượt theo kết quả trước đó. Nợ bảo lãnh
  ở lần thử thứ ba được trả xong thì tiếp tục di chuyển bằng xúc xắc đã gieo.

### Phá sản

- Chỉ người đang có lượt và đang nợ được chọn **Phá sản**.
- Nếu tiền mặt đã đủ trả nợ thì không được phá sản. Nếu tiền mặt chưa đủ, được phá sản ngay,
  **không bắt buộc bán hết nhà hoặc thế chấp hết đất trước**.
- Công trình của người phá sản bị xóa và ngân hàng trả tiền thanh lý: nhà bằng nửa giá xây
  mỗi nhà; khách sạn hiện tính bằng **5 × nửa giá xây**.
- Nếu chủ nợ là một người còn trong ván:
  - Toàn bộ tiền mặt còn lại, gồm tiền thanh lý công trình, chuyển cho chủ nợ.
  - Toàn bộ đất và thẻ ra tù chuyển cho chủ nợ; đất giữ trạng thái thế chấp.
  - Không thu phí nhận đất thế chấp và không mở đấu giá đất của người phá sản.
- Nếu chủ nợ là ngân hàng:
  - Tiền mặt còn lại trả về ngân hàng; đất trở lại chưa có chủ và bỏ trạng thái thế chấp.
  - Thẻ ra tù trở về cuối bộ tương ứng.
  - Không đấu giá ngay số đất được trả lại; người tới các ô này về sau có thể mua/đấu giá.
- Người phá sản bị bỏ qua trong các lượt sau; nếu còn một người thì ván kết thúc.

### Rời ván

- Rời ván đang chơi được xử lý như phá sản với **ngân hàng**, kể cả đang nợ một người khác.
- Nếu đó là người đang có lượt thì chuyển sang người chưa phá sản tiếp theo.
- Nếu người nhận hoặc gửi đề nghị trao đổi rời ván, đề nghị bị hủy.
- Nếu một người tham gia đấu giá rời ván, người đó bị loại khỏi phiên; nếu đang giữ giá cao
  nhất thì giá cao nhất bị đặt lại thành 0, không khôi phục giá trước đó của người khác.

## 12. Bàn cờ, giá mua và tiền thuê

Giá mua được in trực tiếp trên mặt các ô tài sản; hai ô thuế in số tiền phải nộp.
Nút **Gieo xúc xắc** nằm giữa bàn, dùng asset vàng cam riêng có hai viên xúc xắc.

Số ô dưới đây theo chỉ số trong code, từ **0 đến 39**. Dấu `—` nghĩa là ô đó không có giá
mua. Giá ga là 200; giá điện/nước là 150.

| Ô | Tên | Loại / nhóm màu | Giá mua |
| ---: | --- | --- | ---: |
| 0 | Xuất phát | Xuất phát | — |
| 1 | Phố Cổ | Nâu | 60 |
| 2 | Cộng đồng | Rút thẻ | — |
| 3 | Hàng Đào | Nâu | 60 |
| 4 | Thuế thu nhập | Thuế 200 | — |
| 5 | Ga Bắc | Ga | 200 |
| 6 | Bến Thành | Xanh nhạt | 100 |
| 7 | Cơ hội | Rút thẻ | — |
| 8 | Đồng Khởi | Xanh nhạt | 100 |
| 9 | Nguyễn Huệ | Xanh nhạt | 120 |
| 10 | Nhà tù / Thăm | Tù / ghé thăm | — |
| 11 | Cầu Rồng | Hồng | 140 |
| 12 | Điện lực | Điện/nước | 150 |
| 13 | Biển Mỹ Khê | Hồng | 140 |
| 14 | Sông Hàn | Hồng | 160 |
| 15 | Ga Trung | Ga | 200 |
| 16 | Đại Nội | Cam | 180 |
| 17 | Cộng đồng | Rút thẻ | — |
| 18 | Tràng Tiền | Cam | 180 |
| 19 | Sông Hương | Cam | 200 |
| 20 | Bãi đỗ miễn phí | Nghỉ | — |
| 21 | Hồ Xuân Hương | Đỏ | 220 |
| 22 | Cơ hội | Rút thẻ | — |
| 23 | Chợ Đà Lạt | Đỏ | 220 |
| 24 | Đồi Thông | Đỏ | 240 |
| 25 | Ga Nam | Ga | 200 |
| 26 | Chợ Nổi | Vàng | 260 |
| 27 | Bến Ninh Kiều | Vàng | 260 |
| 28 | Cấp nước | Điện/nước | 150 |
| 29 | Cù Lao | Vàng | 280 |
| 30 | Vào tù | Chuyển vào tù | — |
| 31 | Vịnh Hạ Long | Xanh lá | 300 |
| 32 | Đảo Cát Bà | Xanh lá | 300 |
| 33 | Cộng đồng | Rút thẻ | — |
| 34 | Bãi Cháy | Xanh lá | 320 |
| 35 | Ga Đông | Ga | 200 |
| 36 | Cơ hội | Rút thẻ | — |
| 37 | Hồ Gươm | Xanh đậm | 350 |
| 38 | Thuế xa xỉ | Thuế 100 | — |
| 39 | Phố Đi Bộ | Xanh đậm | 400 |

### Bảng xây và thuê đất phố

**Giá xây** là chi phí mỗi lần tăng một cấp. Cột **Trống** là giá gốc khi chưa trọn bộ màu;
khi sở hữu đủ bộ thì nhân đôi cột này. **KS** là một khách sạn.

| Ô | Tên | Giá xây | Trống | 1 nhà | 2 nhà | 3 nhà | 4 nhà | KS |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Phố Cổ | 50 | 2 | 10 | 30 | 90 | 160 | 250 |
| 3 | Hàng Đào | 50 | 4 | 20 | 60 | 180 | 320 | 450 |
| 6 | Bến Thành | 50 | 6 | 30 | 90 | 270 | 400 | 550 |
| 8 | Đồng Khởi | 50 | 6 | 30 | 90 | 270 | 400 | 550 |
| 9 | Nguyễn Huệ | 50 | 8 | 40 | 100 | 300 | 450 | 600 |
| 11 | Cầu Rồng | 100 | 10 | 50 | 150 | 450 | 625 | 750 |
| 13 | Biển Mỹ Khê | 100 | 10 | 50 | 150 | 450 | 625 | 750 |
| 14 | Sông Hàn | 100 | 12 | 60 | 180 | 500 | 700 | 900 |
| 16 | Đại Nội | 100 | 14 | 70 | 200 | 550 | 750 | 950 |
| 18 | Tràng Tiền | 100 | 14 | 70 | 200 | 550 | 750 | 950 |
| 19 | Sông Hương | 100 | 16 | 80 | 220 | 600 | 800 | 1000 |
| 21 | Hồ Xuân Hương | 150 | 18 | 90 | 250 | 700 | 875 | 1050 |
| 23 | Chợ Đà Lạt | 150 | 18 | 90 | 250 | 700 | 875 | 1050 |
| 24 | Đồi Thông | 150 | 20 | 100 | 300 | 750 | 925 | 1100 |
| 26 | Chợ Nổi | 150 | 22 | 110 | 330 | 800 | 975 | 1150 |
| 27 | Bến Ninh Kiều | 150 | 22 | 110 | 330 | 800 | 975 | 1150 |
| 29 | Cù Lao | 150 | 24 | 120 | 360 | 850 | 1025 | 1200 |
| 31 | Vịnh Hạ Long | 200 | 26 | 130 | 390 | 900 | 1100 | 1275 |
| 32 | Đảo Cát Bà | 200 | 26 | 130 | 390 | 900 | 1100 | 1275 |
| 34 | Bãi Cháy | 200 | 28 | 150 | 450 | 1000 | 1200 | 1400 |
| 37 | Hồ Gươm | 200 | 35 | 175 | 500 | 1100 | 1300 | 1500 |
| 39 | Phố Đi Bộ | 200 | 50 | 200 | 600 | 1400 | 1700 | 2000 |

## 13. Cách máy quyết định hiện tại

Máy tuân theo cùng luật hợp lệ; các ngưỡng dưới đây là chiến lược tự động, không phải điều
kiện áp dụng cho người thật.

- **Mua:** chỉ mua trực tiếp nếu sau khi mua còn ít nhất 100; nếu không thì mở đấu giá.
- **Đấu giá:** mỗi lần tăng 10; giá tối đa là mức thấp hơn giữa tiền mặt trừ 100 và 90% giá
  niêm yết, làm tròn xuống.
- **Trong tù:** ưu tiên dùng thẻ; sau hai lần thử thất bại thì trả 50 trước lần gieo tiếp
  nếu đủ tiền; còn lại thử gieo đôi.
- **Sự kiện:** tự xác nhận thẻ, thuế và vào tù.
- **Nợ:** đủ tiền thì trả; nếu thiếu thì bán từng cấp công trình hợp lệ, tiếp đến thế chấp
  tài sản hợp lệ, hết cách mới phá sản. Ưu tiên tài sản theo thứ tự ô trên bàn.
- **Xây:** khi quay lại ô đất phố của mình, xây một cấp nếu sau đó còn ít nhất 200; thực
  hiện trước khi gieo thêm do đôi hoặc kết thúc lượt.
- **Trao đổi:** máy không tự mở đề nghị. Khi nhận đề nghị, định giá mỗi tài sản bằng 110%
  giá niêm yết, cộng tiền; chấp nhận nếu tổng nhận ít nhất bằng tổng đưa. Chưa điều chỉnh
  định giá theo thế chấp hoặc khả năng hoàn thành bộ màu.
- Máy chưa chủ động chuộc tài sản đã thế chấp.

## 14. Những điểm hiện tại cần lưu ý khi duyệt luật

Các điểm này đều đang có trong triển khai, để dễ chọn chỗ cần sửa:

1. Thẻ tới điện/nước dùng xúc xắc cũ, không gieo lại.
2. Sở hữu ô cùng nhóm đang thế chấp vẫn được tính khi xác định trọn bộ màu, số ga hoặc cặp
   điện/nước để tính thuê ở ô chưa thế chấp.
3. Bán nhà/thế chấp/chuộc được phép ngoài lượt và cả trong bước nợ; xây chỉ được một cấp
   khi quay lại ô của mình. Trao đổi vẫn bị cấm khi đang nợ.
4. Có thể tự chọn phá sản ngay khi thiếu tiền mặt dù còn tài sản có thể thanh lý.
5. Phá sản thanh lý khách sạn bằng 5 lần nửa giá xây; đất thế chấp chuyển cho chủ nợ không
   có phí nhận ngay.
6. Đất trả ngân hàng do phá sản/rời ván không được đấu giá ngay.
7. Rời ván luôn thanh lý về ngân hàng, kể cả đang nợ người khác.
8. Trao đổi chỉ hỗ trợ một tài sản mỗi bên, chưa hỗ trợ thẻ ra tù.
9. Chỉ các sự kiện đặc biệt có tự xác nhận; các quyết định khác có thể chờ người thật vô hạn.

## 15. Ghi chú sửa luật

Có thể ghi đề xuất ở bảng này và dùng số mục/ô/thẻ phía trên để chỉ đúng chỗ cần đổi.

| Mục / ô / thẻ | Luật hiện tại cần đổi | Luật mong muốn |
| --- | --- | --- |
| | | |
| | | |
| | | |
