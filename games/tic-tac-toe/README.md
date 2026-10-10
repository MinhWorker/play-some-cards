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
| Bàn: ô gỗ, quân, bàn mở rộng, hàng thắng, Đổi quân, `room_setup()` và `result_detail()` | `godot/main.tscn`, `godot/main.gd` (test: `godot/test/`) |
| Hình, âm thanh và nhạc của bàn | `godot/art/`, `godot/sounds/`, `godot/music/` |

`src/index.ts` đăng ký game phía server. `assets/` chứa hình và âm thanh cỡ đầy đủ (bàn chép bản
cần dùng vào `godot/`), `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo rồi mở
`http://localhost:5033/?play=tic-tac-toe` (chơi với máy trên server thật).
Kiểm tra bằng `npm run check` và `npm run godot:check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Ô gỗ mật ong, quân X sơn mài đỏ, quân O sơn mài xanh và nền vải kết xuất bằng Blender theo
[hướng nghệ thuật](../../docs/art-direction.md): `npm run blender -- tic-tac-toe` chạy
`sources/render_assets.py` (nắng trên trái). Bàn dùng các ảnh này trong `godot/art/`:
quân hiện ra kèm tiếng, bàn lớn thêm thì ô mới hiện dần và bàn trượt cho vừa, năm ô thắng chuyển
vàng và quân nảy lên; chủ phòng đổi quân cho ván sau bằng **Đổi quân**. Hình đảo tạo bằng Codex,
prompt trong `sources/prompts.json`. Âm thanh chép từ `assets/` vào `godot/sounds/`;
bản gốc ở `assets/games/tic-tac-toe/` tại gốc repo.
