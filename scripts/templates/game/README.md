# __NAME__

[Luật chơi](RULES.md). Ghi công cho hình và âm thanh ở cuối trang.

## Các thứ nằm ở đâu

```
RULES.md                    luật hiện tại (bảng Luật trong client đọc file này)
src/
  index.ts                  đầu vào phía server: meta (tên, số người, thể loại, thẻ) + logic + tuỳ chọn phòng
  game/__Name__Game.ts      phần logic (server): State, sự kiện, hook, máy chơi
  game/__Name__Game.test.ts test (npm run check)
godot/                      màn hình trong client Godot, bố cục __LAYOUT__
  main.tscn, main.gd        bàn chơi: vẽ `snapshot.view`, gửi sự kiện
  test/test_main.gd         test GUT (npm run godot:check)
assets/                     hình và âm thanh gốc cỡ lớn (godot/ chép bản cần dùng); island.webp là tranh thẻ tạm
sources/                    file gốc tuỳ chọn; `npm run assets -- __ID__` biến chúng thành assets/
```

Một lần bấm gọi `_client.send("add", {"amount": 1})` trong `godot/main.gd`; server chạy
`onAdd(ctx)` và trả về state kế tiếp; rồi client nhận `state_changed` và vẽ lại.
[Hướng dẫn tạo game](../../docs/making-a-game.md) có mọi hook và cách làm phần Godot.

Thêm file logic từ mẫu: `npm run new -- logic __ID__ [Tên]` (luật) hoặc `npm run new -- options __ID__` (tuỳ chọn phòng).

## Chơi thử

- `npm run godot:export -- --debug`, `npm run dev`, rồi mở
  http://localhost:5033/?play=__ID__ để chơi với máy.
- Kịch bản e2e: `npm run e2e -- --only godot-__ID__`.

## Ghi công

Chưa có.
