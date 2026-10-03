# Cờ Vua

Cờ Vua cho hai người theo [Luật Cờ Vua của FIDE](https://handbook.fide.com/chapter/E012023),
chơi với bạn bè hoặc với máy. Game đang ở trạng thái `wip`: luật, máy chơi và bàn cờ đã chơi
được; hình và âm thanh làm sau, xem [kế hoạch Cờ Vua](PLAN.md).

## Luật chơi

- Bàn 8 × 8 ô, Trắng đi trước. **Vua** đi một ô mọi hướng. **Hậu** đi thẳng hoặc chéo bao xa cũng
  được. **Xe** đi thẳng, **Tượng** đi chéo, **Mã** đi chữ L và nhảy qua quân khác. **Tốt** đi
  thẳng một ô (hai ô ở nước đầu), ăn chéo một ô.
- **Nhập thành**: Vua đi hai ô về phía Xe, Xe nhảy qua đứng cạnh Vua. Chỉ được khi Vua và Xe đó
  chưa đi, giữa hai quân trống, Vua không đang bị chiếu và không đi qua hay tới ô bị khống chế.
- **Bắt tốt qua đường**: Tốt đối phương vừa đi hai ô và dừng cạnh Tốt mình thì Tốt mình được ăn
  nó như thể nó chỉ đi một ô, nhưng chỉ ngay nước kế tiếp.
- **Phong cấp**: Tốt tới hàng cuối thành Hậu, Xe, Tượng hoặc Mã (bàn cờ hỏi chọn quân nào).
- Không được đi nước để Vua mình bị chiếu.
- **Thua** khi bị chiếu hết, khi đầu hàng, hoặc khi rời bàn giữa ván.
- **Hoà** khi:
  - tới lượt mà không còn nước đi hợp lệ dù không bị chiếu (hết nước);
  - cùng một thế cờ xuất hiện lần thứ ba (cùng quân, cùng bên đi, cùng quyền nhập thành và bắt tốt
    qua đường);
  - 50 nước mỗi bên liền không ai ăn quân, không ai đi Tốt;
  - không bên nào còn đủ quân để chiếu hết (chỉ còn Vua, Vua với một Tượng hoặc một Mã, hoặc chỉ
    còn các Tượng cùng màu ô);
  - hai bên đồng ý (một bên bấm "Xin hoà", bên kia bấm "Đồng ý hoà"; đi một nước là từ chối).
- Lặp thế cờ và 50 nước tự động xử hoà, không cần xin. Chưa có đồng hồ: mỗi nước nghĩ bao lâu cũng
  được.

## Tạo phòng

Mọi tuỳ chọn nằm trong một form: **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó) và
**Bạn cầm quân** (Trắng đi trước, hoặc Đen). Chủ phòng đổi các tuỳ chọn này giữa hai ván bằng
"Tuỳ chỉnh". Người cầm Đen thấy bàn cờ xoay ngược để quân mình luôn ở dưới.

Chạm một quân của mình để thấy nó đi được đâu (chấm tròn; vòng tròn trên quân ăn được), rồi chạm
ô muốn đi. Ô của nước vừa đi tô vàng, Vua đang bị chiếu tô đỏ.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  client.ts                 đầu vào phía trình duyệt: form tạo phòng và bàn cờ
  game/model.ts             dữ liệu: State, View, tuỳ chọn phòng
  game/rules.ts             quân đi thế nào, chiếu, nhập thành, bắt tốt qua đường, phong cấp
                            (dùng chung cho server, máy và màn hình)
  game/bot.ts               máy chơi (tìm kiếm alpha-beta theo giá trị quân)
  game/ChessGame.ts         các sự kiện: move, offer-draw, decline-draw, resign
  scenes/ChessView.ts       bàn cờ: chọn quân, chấm nước đi, chọn quân phong cấp, nút xin hoà/đầu hàng
  scenes/Setup.ts           form tạo phòng
  scenes/theme.ts           tên quân, màu, câu kết quả ván
assets/                     hình (.webp) và âm thanh (.wav/.mp3), dùng theo tên file
```

Bàn cờ và ô vẽ bằng code. Quân tạm là ký hiệu cờ vua (♚ ♛ ♜ ♝ ♞ ♟) vẽ bằng chữ; khi có
`assets/piece-<white|black>-<king|queen|rook|bishop|knight|pawn>.webp` thì bàn tự dùng hình đó.
`island.webp` là đảo mẫu của `npm run new:game`; `button.webp` lấy từ Tiến Lên.

Test: `npm run check` (gồm perft đếm nước đi từ thế khai cuộc và các thế mẫu, chiếu hết, hết nước,
lặp thế cờ). Chơi thử một mình: http://localhost:5033/?play=chess&players=2 (khi đang chạy
`npm run dev`).

## Vòng đời bàn chơi

Hoạt ảnh và thời gian xác nhận đầu hàng dùng runtime của SDK. Khi mở ván mới, kết nối lại
hoặc rời bàn, các hiệu ứng cũ được huỷ; kết nối lại dựng bàn từ trạng thái hiện tại,
không phát lại nước đi trước đó.
