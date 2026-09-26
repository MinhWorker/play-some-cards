# Tiến Lên

Luật chơi, và ghi công cho hình và âm thanh.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta (tên, số người, đảo) + phần logic
  client.ts                 đầu vào phía trình duyệt: hiện những màn nào
  game/TienLenGame.ts      phần logic (server): State, sự kiện và hook của chúng
  game/TienLenGame.test.ts test (npm run check)
  scenes/TienLenView.ts    màn hình (trình duyệt): hook và đối tượng
assets/                     hình (.webp/.png) và âm thanh (.wav/.mp3), dùng theo tên file
sources/                    file gốc tuỳ chọn; `npm run assets -- tien-len` biến chúng thành assets/
```

Một game là hai lớp có các hook vòng đời, giống script trong Unity. Một lần bấm gọi
`this.send('add', { amount })` trong view; server chạy `onAdd(ctx)` trong game và trả về state kế
tiếp; rồi mọi màn hình nhận `onAdd(ctx, event)` và `onState(ctx)`. games/counter liệt kê mọi hook;
games/tic-tac-toe thêm tuỳ chọn phòng, màn "Tạo phòng" và người chơi máy.

Thêm file từ mẫu: `npm run new -- logic|view|setup tien-len [Tên]`.

Chơi thử một mình: http://localhost:5033/?play=tien-len&players=2 (khi đang chạy `npm run dev`).
