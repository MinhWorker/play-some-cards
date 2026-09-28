# Cờ Tướng

Cờ Tướng cho hai người theo [Luật Cờ Tướng Thế giới 2018 của WXF](https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf),
chơi với bạn bè hoặc với máy. Game đang ở trạng thái `wip`. Xem [kế hoạch Cờ Tướng](PLAN.md) về
hoạt ảnh và cut-in tên thế cờ; [kế hoạch âm thanh](../../docs/xiangqi-audio.md) ghi âm thanh nào
phát khi nào.

## Luật chơi

- Bàn 9 đường dọc × 10 đường ngang, quân đi trên giao điểm. Đỏ đi trước.
- **Tướng** đi một bước ngang/dọc trong cung. **Sĩ** đi một bước chéo trong cung. **Tượng** đi
  chéo hai bước, không qua sông, bị cản nếu có quân ở giữa (mắt tượng). **Xe** đi thẳng bao xa
  cũng được. **Mã** đi chữ L, bị cản nếu có quân sát bên cạnh theo hướng đi (chân mã). **Pháo**
  đi như Xe, nhưng ăn quân phải nhảy qua đúng một quân (ngòi). **Tốt** đi thẳng một bước; qua
  sông thì được đi ngang, không bao giờ đi lùi.
- Không được đi nước để Tướng mình bị chiếu, và hai Tướng không được đối mặt trên một cột trống.
- **Thua** khi tới lượt mà không còn nước đi hợp lệ (bị chiếu bí, hoặc hết nước dù không bị
  chiếu), khi đầu hàng, hoặc khi rời bàn giữa ván.
- **Lặp lại thế cờ** (cùng một thế xuất hiện lần thứ ba):
  - bên nào nước nào cũng chiếu (chiếu dai) thì thua;
  - bên nào nước nào cũng đuổi bắt một quân (đuổi dai) thì thua; chiếu dai gặp đuổi dai thì bên
    chiếu thua;
  - không ai phạm, hoặc cả hai cùng phạm như nhau, thì hoà.

  "Đuổi" là nước tạo ra mối đe doạ mới ăn một quân không được bảo vệ, hoặc dùng Mã/Pháo doạ ăn
  Xe (dù Xe có được bảo vệ). Tướng và Tốt doạ ăn thì không tính là đuổi; doạ ăn Tốt chưa qua sông
  cũng không tính.
- **Hoà** khi hai bên đồng ý (một bên bấm "Xin hoà", bên kia bấm "Đồng ý hoà"; đi một nước là
  từ chối), khi 60 nước mỗi bên liền không ai ăn quân, hoặc khi cả hai bên đều không còn Xe, Mã,
  Pháo, Tốt.
- Chưa có đồng hồ: mỗi nước nghĩ bao lâu cũng được.

## Tạo phòng

Mọi tuỳ chọn nằm trong một form: **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó) và
**Bạn cầm quân** (Đỏ đi trước, hoặc Đen). Chủ phòng đổi các tuỳ chọn này giữa hai ván bằng
"Tuỳ chỉnh". Người cầm Đen thấy bàn cờ xoay ngược để quân mình luôn ở dưới.

Mỗi loại quân ăn theo kiểu riêng: Tốt lùi lấy đà rồi húc, Sĩ xoay một vòng khi lướt chéo, Tượng
nhảy chéo thật mạnh, Mã nhảy hai nhịp chữ L và lộn nhào, Xe lao thẳng rồi phanh gấp, Pháo bay
qua ngòi rồi nện xuống, Tướng nhấc cao rồi giáng xuống. Quân bị ăn bị hất lên rồi vỡ thành mảnh
ngọc.

Nút **Hiệu ứng** bên phải bàn bật/tắt hiệu ứng trên máy đang dùng (nhớ trong trình duyệt): khi tắt,
quân chuyển thẳng tới chỗ mới, quân bị ăn biến mất ngay, không nhấc, không bụi, không rung.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  client.ts                 đầu vào phía trình duyệt: form tạo phòng và bàn cờ
  game/model.ts             dữ liệu: State, View, tuỳ chọn phòng
  game/rules.ts             quân đi thế nào, chiếu, nước hợp lệ (dùng chung cho server, máy và màn hình)
  game/referee.ts           phân xử lặp thế cờ: chiếu dai, đuổi dai, hoà
  game/bot.ts               máy chơi (tìm kiếm alpha-beta theo giá trị quân)
  game/XiangqiGame.ts       các sự kiện: move, offer-draw, decline-draw, resign
  scenes/XiangqiView.ts     bàn cờ: chọn quân, chấm nước đi, pha ăn quân, nút xin hoà/đầu hàng
  scenes/shatter.ts         quân bị ăn vỡ thành mảnh (cắt từ chính ảnh quân)
  scenes/Setup.ts           form tạo phòng
  scenes/theme.ts           tên quân, màu, câu kết quả ván
assets/                     hình (.webp) và âm thanh (.wav/.mp3), dùng theo tên file
sources/                    file gốc tuỳ chọn; `npm run assets -- xiangqi` biến chúng thành assets/
```

`board.webp` là ảnh sinh (prompt trong `sources/prompts.json`), đường kẻ do game vẽ theo `BOARD`
trong `scenes/theme.ts`. `piece-<red|black>-<kind>.webp`, bóng
chung `piece-shadow.webp` và `river.webp` (楚河 漢界) render từ Blender. `button.webp` lấy từ Tiến Lên. `xiangqi-move.wav` và `xiangqi-shatter.wav`
tổng hợp bằng code.

Test: `npm run check` (gồm perft đếm nước đi từ thế khai cuộc, chiếu bí, hết nước, lặp thế cờ).
Chơi thử một mình: http://localhost:5033/?play=xiangqi&players=2 (khi đang chạy `npm run dev`).
