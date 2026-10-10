# Caro

Hai người chơi Caro trên bàn mở rộng, với bạn hoặc máy.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Luật và lượt | `src/game/CaroGame.ts` |
| Hàng thắng, hoà và bàn mở rộng | `src/game/board.ts` |
| Dữ liệu và tuỳ chọn | `src/game/model.ts` |
| Máy | `src/game/bot.ts` |
| Bàn và tạo phòng | `src/scenes/CaroView.ts`, `Setup.ts` |
| Màu quân | `src/scenes/theme.ts` |
| Bàn trong client Godot: ô gỗ, quân, bàn mở rộng, hàng thắng, Đổi quân, `room_setup()` và `result_detail()` | `godot/main.tscn`, `godot/main.gd` (test: `godot/test/`) |
| Hình, âm thanh và nhạc của bản Godot | `godot/art/`, `godot/sounds/`, `godot/music/` |

`src/index.ts` đăng ký game phía server; `src/client.ts` đăng ký giao diện.
`assets/` chứa hình và âm thanh dùng trực tiếp, `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run dev` ở gốc repo rồi mở `http://localhost:5033/?play=tic-tac-toe&players=2`.
Bản Godot: `npm run godot:export -- --debug` rồi mở `http://localhost:5033/godot/?play=tic-tac-toe`
(chơi với máy trên server thật).
Kiểm tra bằng `npm run check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Ô gỗ mật ong, quân X sơn mài đỏ, quân O sơn mài xanh và nền vải kết xuất bằng Blender theo
[hướng nghệ thuật](../../docs/art-direction.md): `npm run blender -- tic-tac-toe` chạy
`sources/render_assets.py` (nắng trên trái). Bản Godot dùng cùng các ảnh này trong `godot/art/`:
quân hiện ra kèm tiếng, bàn lớn thêm thì ô mới hiện dần và bàn trượt cho vừa, năm ô thắng chuyển
vàng và quân nảy lên; chủ phòng đổi quân cho ván sau bằng **Đổi quân**. Hình đảo tạo bằng Codex,
prompt trong `sources/prompts.json`. Âm thanh dùng trực tiếp từ `assets/`;
bản gốc ở `assets/games/tic-tac-toe/` tại gốc repo.
