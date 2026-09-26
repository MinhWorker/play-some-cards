# Caro

Xếp quân thành hàng trên bàn cờ vuông, chơi với bạn hoặc với máy (Dễ / Vừa / Khó): 3 quân liền
trên bàn 3×3, 4 quân trên 6×6, 5 quân trên 9×9. Giữa các ván, chủ phòng có thể đổi cỡ bàn hoặc
đổi màu (X đỏ luôn đi trước).

Viết bằng hai lớp `Game` (server) và `GameView` (trình duyệt): các hook vòng đời, một `ctx` chứa
cả phòng, sự kiện đi giữa hai bên. `games/counter` là ví dụ nhỏ nhất; game này thêm tuỳ chọn
phòng, người chơi máy và màn cài đặt.

## Bắt đầu từ đây

```
src/
  index.ts          đầu vào phía server: meta, game: new CaroGame(), tuỳ chọn phòng
  client.ts         đầu vào phía trình duyệt: màn cài đặt và màn hình game
  game/             phần logic: không Phaser (chạy trên server)
    model.ts          ★ đọc trước: State và Options
    CaroGame.ts       sự kiện và hook: onStart, onPlace, bot
    board.ts          hàm tiện ích cho lưới (hàng thắng, chuỗi quân, ô trống)
    bot.ts            bộ não của máy: đánh vào ô nào
    *.test.ts         test, viết bằng testGame (npm run check)
  scenes/           những gì người chơi thấy (chỉ trên trình duyệt)
    CaroView.ts       màn hình game: onCreate, onLayout, onPlace, onState, onEnd
    Setup.ts          màn cài đặt: "Tạo phòng", và "Tuỳ chỉnh" trong phòng
    theme.ts          quân cờ, màu và sắc độ dùng chung giữa các màn
assets/             hình và âm thanh, dùng theo tên file (this.sprite('tile'), this.sfx('mark-drop'))
sources/            ảnh gốc (Git LFS) và prompts.json
```

## Chuyện gì xảy ra

Server không có vòng lặp game: nó chờ sự kiện, mỗi sự kiện chạy một hook trả về state kế tiếp.
(Trình duyệt có vòng lặp khung hình, chỉ để làm hiệu ứng.)

| Khi | Server (`CaroGame`) | Mọi màn hình (`CaroView`) |
| --- | --- | --- |
| "Tạo phòng" / "Tuỳ chỉnh" | tuỳ chọn được `optionsSchema` kiểm tra, phòng giữ lại | `Setup.ts` gọi `submit(options)` |
| "Bắt đầu", "Chơi ván mới" | `onStart(ctx)` → state đầu tiên | `onStart` (âm thanh bắt đầu), `onState` |
| Bấm vào một ô trống | `send('place', { cell })` → `onPlace(ctx)`: kiểm tra, rồi trả state mới (hoặc `reject`) | `onPlace` (quân hiện ra), `onState` |
| Tới lượt máy | `bot(ctx)` → sự kiện `place`, sau một khoảng dừng ngắn | như khi người bấm |
| Ba (bốn, năm) quân liền / hết ô | `ctx.finish(winners)` trong `onPlace` | `onEnd` (hàng thắng sáng lên, âm thanh), bảng kết quả |
| Chủ phòng bấm cỡ bàn hoặc ⇄ sau một ván | `onStart` kế tiếp dùng tuỳ chọn mới | `changeOptions(...)` |

Chơi thử một mình: http://localhost:5033/?play=tic-tac-toe (khi đang chạy `npm run dev`). Nút
"Tuỳ chỉnh" trong sandbox mở màn cài đặt; các nút ghế đổi góc nhìn sang người chơi khác.

## Ghi công

Hình tạo bằng Codex (`sources/prompts.json`). Âm thanh: xem `assets/audio.json` ở thư mục gốc repo.
