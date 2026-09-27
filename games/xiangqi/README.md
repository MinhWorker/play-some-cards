# Cờ Tướng

Game đang ở trạng thái `wip`: luật và màn hình hiện vẫn là game mẫu “đua tới 21”. Xem
[kế hoạch Cờ Tướng](PLAN.md) về phiên bản luật, model 3D, hoạt ảnh và cut-in tên thế cờ;
[kế hoạch âm thanh](../../docs/xiangqi-audio.md) liệt kê các hiệu ứng đã chuẩn bị.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta (tên, số người, đảo) + phần logic
  client.ts                 đầu vào phía trình duyệt: hiện những màn nào
  game/XiangqiGame.ts      phần logic (server): State, sự kiện và hook của chúng
  game/XiangqiGame.test.ts test (npm run check)
  scenes/XiangqiView.ts    màn hình (trình duyệt): hook và đối tượng
assets/                     hình (.webp/.png) và âm thanh (.wav/.mp3), dùng theo tên file
sources/                    file gốc tuỳ chọn; `npm run assets -- xiangqi` biến chúng thành assets/
```

Một game là hai lớp có các hook vòng đời, giống script trong Unity. Một lần bấm gọi
`this.send('add', { amount })` trong view; server chạy `onAdd(ctx)` trong game và trả về state kế
tiếp; rồi mọi màn hình nhận `onAdd(ctx, event)` và `onState(ctx)`. games/counter liệt kê mọi hook;
games/tic-tac-toe thêm tuỳ chọn phòng, màn "Tạo phòng" và người chơi máy.

Thêm file từ mẫu: `npm run new -- logic|view|setup xiangqi [Tên]`.

Chơi thử một mình: http://localhost:5033/?play=xiangqi&players=2 (khi đang chạy `npm run dev`).
