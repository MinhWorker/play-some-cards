# Cờ Đam

Cờ Đam cho hai người, chơi với bạn bè hoặc với máy, theo một trong hai luật chọn khi tạo phòng:
**8 × 8** (luật Anh, còn gọi là checkers) hoặc **10 × 10 quốc tế** (luật FMJD). Game đang ở
trạng thái `wip`: luật, máy chơi và bàn cờ đã chơi được; hình và âm thanh làm sau, xem
[kế hoạch Cờ Đam](PLAN.md).

## Luật chơi

Chung cho hai bàn:

- Quân đứng và đi trên các ô tối. Mỗi bên bắt đầu với 12 quân (8 × 8) hoặc 20 quân (10 × 10).
- **Quân thường** đi chéo một ô về phía trước.
- **Ăn quân** bằng cách nhảy chéo qua quân đối phương đứng sát sang ô trống ngay sau. Nhảy tới
  đâu mà còn ăn được thì phải ăn tiếp trong cùng nước. Các quân bị ăn được nhấc ra khi nước đi
  xong; không được nhảy qua một quân hai lần.
- **Bắt buộc ăn**: có nước ăn thì phải ăn.
- Quân thường đi tới hàng cuối của đối phương thì **phong Vua**.
- **Thua** khi tới lượt mà không còn quân hoặc không còn nước đi, khi đầu hàng, hoặc khi rời bàn.
- **Hoà** khi hai bên đồng ý, khi một thế cờ lặp lại lần thứ ba, hoặc khi quá lâu không ai ăn quân
  và không ai đi quân thường (xem dưới).

Bàn **8 × 8** (luật Anh):

- Đen đi trước. Quân thường chỉ ăn về phía trước.
- Vua đi và ăn chéo một ô, cả tiến lẫn lùi.
- Có nhiều cách ăn thì được chọn cách nào cũng được (nhưng phải ăn tới hết).
- Quân thường vừa phong Vua trong lúc ăn thì dừng lại ở đó.
- Hoà sau 40 nước mỗi bên không ăn quân, không đi quân thường.

Bàn **10 × 10 quốc tế**:

- Trắng đi trước. Quân thường ăn được cả về phía sau.
- **Vua bay**: đi chéo bao xa cũng được; ăn một quân ở xa trên đường chéo rồi đáp xuống bất kỳ ô
  trống nào phía sau nó.
- **Phải ăn nhiều quân nhất** có thể.
- Quân thường chỉ phong Vua nếu nước đi dừng ở hàng cuối; đi ngang qua hàng cuối trong lúc ăn
  tiếp thì không phong.
- Hoà sau 25 nước mỗi bên không ăn quân, không đi quân thường.

## Tạo phòng

Mọi tuỳ chọn nằm trong một form: **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó),
**Bàn cờ** (8 × 8 hoặc 10 × 10 quốc tế) và **Lượt đi** (bạn đi trước hoặc đối thủ đi trước).
Người đi sau thấy bàn cờ xoay ngược để quân mình luôn ở dưới.

Tới lượt bạn, các quân đi được có vòng vàng. Chạm một quân rồi chạm ô muốn đến (chấm xanh); nước
ăn nhiều quân thì chạm lần lượt từng ô đáp xuống.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  client.ts                 đầu vào phía trình duyệt: form tạo phòng và bàn cờ
  game/model.ts             dữ liệu: State, View, tuỳ chọn phòng, luật của hai bàn (RULES)
  game/rules.ts             nước đi, ăn quân, phong Vua (dùng chung cho server, máy và màn hình)
  game/bot.ts               máy chơi (tìm kiếm alpha-beta)
  game/CheckersGame.ts      các sự kiện: move, offer-draw, decline-draw, resign
  scenes/CheckersView.ts    bàn cờ: chọn quân, chọn từng ô đáp, nút xin hoà/đầu hàng
  scenes/Setup.ts           form tạo phòng
assets/                     hình (.webp) và âm thanh (.wav/.mp3), dùng theo tên file
```

Bàn và quân tạm vẽ bằng code. Khi có `assets/piece-<white|black>-<man|king>.webp`, bàn tự dùng
hình đó. `island.webp` là đảo mẫu của `npm run new:game`; `button.webp` lấy từ Tiến Lên.

Test: `npm run check` (gồm perft đếm nước đi từ thế khai cuộc của cả hai bàn). Chơi thử một
mình: http://localhost:5033/?play=checkers&players=2 (khi đang chạy `npm run dev`).
