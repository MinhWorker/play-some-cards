# Caro

Xếp 5 quân liền thành hàng (ngang, dọc hoặc chéo), chơi với bạn hoặc với máy (Dễ / Vừa / Khó).
Bàn bắt đầu 9×9. Khi ai đó đánh vào ô ở mép bàn mà ván chưa xong, bàn mở rộng thêm 3 hàng hoặc
3 cột về phía mép đó (ô góc mở cả hai phía) và khung nhìn trượt mượt tới bàn mới. Mỗi chiều mở
rộng tối đa tới 15 ô. Khi bàn đã 15×15 mà không còn hàng 5 ô nào một người có thể lấp đầy (mọi
hàng 5 ô đều có quân của cả hai bên) thì ván hoà. Giữa các ván, chủ phòng có thể đổi màu (X đỏ
luôn đi trước).

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
    board.ts          hàm tiện ích cho bàn (mở rộng bàn, hàng thắng, xét hoà, chuỗi quân, ô trống)
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
| Bấm vào một ô trống | `send('place', { x, y })` → `onPlace(ctx)`: kiểm tra, mở rộng bàn nếu ô ở mép, rồi trả state mới (hoặc `reject`) | `onPlace` (quân hiện ra), `onState` (ô mới hiện dần, khung nhìn trượt tới) |
| Tới lượt máy | `bot(ctx)` → sự kiện `place`, sau một khoảng dừng ngắn | như khi người bấm |
| Năm quân liền / không ai còn thắng được | `ctx.finish(winners)` trong `onPlace` | `onEnd` (hàng thắng sáng lên, âm thanh), bảng kết quả |
| Chủ phòng bấm ⇄ sau một ván | `onStart` kế tiếp dùng tuỳ chọn mới | `changeOptions(...)` |

Chơi thử một mình: http://localhost:5033/?play=tic-tac-toe (khi đang chạy `npm run dev`). Nút
"Tuỳ chỉnh" trong sandbox mở màn cài đặt; các nút ghế đổi góc nhìn sang người chơi khác.

## Ghi công

Hình tạo bằng Codex (`sources/prompts.json`). Âm thanh: file trong `assets/`, bản gốc lưu trong `assets/games/tic-tac-toe/` ở gốc repo.
