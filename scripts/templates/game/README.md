# __NAME__

Luật chơi, và ghi công cho hình và âm thanh.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta (tên, số người, đảo) + phần logic
  client.ts                 đầu vào phía trình duyệt: hiện những màn nào
  game/__Name__Game.ts      phần logic (server): State, sự kiện và hook của chúng
  game/__Name__Game.test.ts test (npm run check)
  scenes/__Name__View.ts    màn hình (trình duyệt): hook và đối tượng
assets/                     hình (.webp/.png) và âm thanh (.wav/.mp3), dùng theo tên file
sources/                    file gốc tuỳ chọn; `npm run assets -- __ID__` biến chúng thành assets/
```

Một game là hai lớp có các hook vòng đời, giống script trong Unity. Một lần bấm gọi
`this.send('add', { amount })` trong view; server chạy `onAdd(ctx)` trong game và trả về state kế
tiếp; rồi mọi màn hình nhận `onAdd(ctx, event)` và `onState(ctx)`.
[Hướng dẫn tạo game](../../docs/making-a-game.md#các-hook) liệt kê mọi hook;
`games/tic-tac-toe` thêm tuỳ chọn phòng, màn "Tạo phòng" và người chơi máy.

Thêm file từ mẫu: `npm run new -- logic|view|setup __ID__ [Tên]`.

Chơi thử một mình: http://localhost:5033/?play=__ID__&players=2 (khi đang chạy `npm run dev`).

## Ánh sáng cho sprite

Thêm `assets/<name>.normal.webp` cạnh hình hoặc atlas `<name>`: SDK tự nạp normal map ở cả
phòng thật và sandbox. Normal map giữ nguyên kích thước và vị trí khung, đục hoàn toàn
(không alpha); lưu raw, lossless, trục X sang phải, Y lên trên, Z hướng người xem. Mặt phẳng
và chỗ trống là `(128,128,255)`.

Trong `onCreate`, gọi `this.lighting()` để bật ánh sáng nền và đèn chính ở trên trái;
`this.lighting({ pointer: true })` thêm đèn mềm đi theo chuột hoặc ngón tay khi kéo.
Có thể chỉnh `ambient`, `color`, `intensity`; kết quả có `key` và `pointer` để chỉnh đèn
bằng API Phaser. Đèn tự theo khung khi đổi kích thước và dọn listener khi rời scene.
`const pieces = this.litLayer()` tạo một `Layer`; `pieces.add(this.sprite('piece'))` bật
chiếu sáng cho quân mới thêm, `pieces.remove(obj)` lấy ra và tắt. `this.image(x, y, 'pieces',
'pawn')` lấy một khung atlas. Vị trí vẫn là đơn vị scene, depth sắp xếp bên trong layer;
`pieces.layer.setDepth(…)` xếp cả layer với UI. Hình không có normal map dùng mặt phẳng mặc định. Giữ chữ và dấu bàn ngoài layer.
Gộp nhiều quân vào một cặp atlas để tránh đổi texture làm tăng draw call.
