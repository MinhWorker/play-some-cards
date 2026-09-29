# Cờ Vây

Cờ Vây cho hai người theo luật Trung Quốc (đếm theo diện tích, Trắng được 7,5 điểm bù), trên bàn
9 × 9, 13 × 13 hoặc 19 × 19, chơi với bạn bè hoặc với máy. Game đang ở trạng thái `wip`: luật,
máy chơi, đếm điểm và bàn cờ đã chơi được; hình và âm thanh làm sau, xem
[kế hoạch Cờ Vây](PLAN.md).

## Luật chơi

- Đen đi trước; hai bên lần lượt đặt một quân lên một giao điểm trống, hoặc **bỏ lượt**.
- Các quân cùng màu nằm cạnh nhau (ngang, dọc) thành một **nhóm**. Giao điểm trống sát nhóm là
  **khí**. Nhóm hết khí thì bị bắt, nhấc khỏi bàn.
- Không được đặt quân vào chỗ mà nhóm của mình hết khí, trừ khi nước đó bắt được quân đối phương.
- **Cướp (ko)** và lặp thế: không được đi một nước làm bàn cờ trở lại đúng một thế đã có trước đó
  trong ván. Nên sau khi một quân vừa bắt một quân trong thế cướp, bên kia phải đánh chỗ khác
  trước rồi mới bắt lại được.
- Hai bên **bỏ lượt liên tiếp** thì dừng đánh và **đếm điểm**:
  - máy đoán sẵn các nhóm đã chết (mờ đi); người chơi chạm một nhóm để đánh dấu chết hoặc sống lại;
  - mỗi lần đổi đánh dấu, cả hai phải bấm "Đồng ý" lại; hai bên cùng đồng ý thì đếm;
  - không thống nhất được thì bấm "Đánh tiếp" để chơi tiếp cho rõ.
- **Điểm** của mỗi bên = số quân còn sống trên bàn + số giao điểm trống chỉ quân mình bao quanh
  (quân chết bị nhấc ra trước khi đếm). Trắng cộng thêm 7,5 điểm. Bên nhiều điểm hơn thắng; không
  bao giờ hoà.
- Cũng thua khi đầu hàng hoặc rời bàn giữa ván. Chưa có đồng hồ và chấp quân.

## Tạo phòng

Mọi tuỳ chọn nằm trong một form: **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó),
**Bàn cờ** (9 × 9, 13 × 13, 19 × 19) và **Bạn cầm quân** (Đen đi trước, hoặc Trắng). Chủ phòng
đổi các tuỳ chọn này giữa hai ván bằng "Tuỳ chỉnh".

Chạm giao điểm trống để đặt quân. Quân vừa đặt có vòng đỏ, điểm cướp có ô vuông. Khi đếm điểm,
ô vuông nhỏ đen/trắng cho biết giao điểm đó tính cho ai.

Máy chơi theo kinh nghiệm (bắt quân, cứu nhóm bị dồn còn một khí, không tự chui vào chỗ còn một
khí, chiếm đường 3–4 lúc đầu, không lấp mắt mình) và ước lượng vùng đã chắc bằng các ván ngẫu
nhiên. Nó bỏ lượt khi không còn nước đáng đi. Lúc đếm, máy giữ đúng phần đoán quân chết ban đầu
rồi đồng ý.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  client.ts                 đầu vào phía trình duyệt: form tạo phòng và bàn cờ
  game/model.ts             dữ liệu: State, View, tuỳ chọn phòng, điểm bù
  game/rules.ts             đặt quân, bắt quân, cướp, đếm điểm, đoán quân chết bằng ván ngẫu nhiên
                            (dùng chung cho server, máy và màn hình)
  game/bot.ts               máy chơi
  game/GoGame.ts            các sự kiện: place, pass, mark, accept, resume, resign
  scenes/GoView.ts          bàn cờ: đặt quân, đếm điểm, nút bỏ lượt/đồng ý/đánh tiếp/đầu hàng
  scenes/Setup.ts           form tạo phòng
assets/                     hình (.webp) và âm thanh (.wav/.mp3), dùng theo tên file
```

Bàn, đường kẻ, sao và quân tạm đều vẽ bằng code; khi có `assets/stone-black.webp` và
`assets/stone-white.webp` thì bàn tự dùng hình đó. `island.webp` là đảo mẫu của `npm run new:game`;
`button.webp` lấy từ Tiến Lên.

Test: `npm run check`. Chơi thử một mình: http://localhost:5033/?play=go&players=2 (khi đang chạy
`npm run dev`).
