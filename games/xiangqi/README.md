# Cờ Tướng

Cờ Tướng cho hai người, chơi với bạn hoặc máy.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Nước đi, chiếu và nước hợp lệ | `src/game/rules.ts` |
| Lặp thế cờ, chiếu dai và đuổi dai | `src/game/referee.ts` |
| Lượt, xin hoà, đầu hàng và kết thúc | `src/game/XiangqiGame.ts` |
| Máy và tuỳ chọn | `src/game/bot.ts`, `model.ts` |
| Bàn chơi: cảnh đình, bàn, đường kẻ, quân, vỡ quân, cuộn chiếu tướng, `room_setup()` và `result_detail()` | `godot/main.gd`, `godot/main.tscn` (test: `godot/test/`) |
| Hình, âm thanh và nhạc của bàn | `godot/art/`, `godot/sounds/`, `godot/music/` |

`src/index.ts` đăng ký game phía server. `assets/` chứa hình và âm thanh cỡ đầy đủ (bàn chép bản
cần dùng vào `godot/`), `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo rồi mở
http://localhost:5033/?play=xiangqi (chơi với máy trên server thật). Kiểm tra bằng
`npm run check` và `npm run godot:check`; kịch bản trình duyệt ở
`scripts/e2e/scenarios/godot-xiangqi.mjs`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

Bàn có cảnh đình, bàn, đường kẻ, chữ 楚河 漢界, quân và bóng, vòng chiếu tướng nhấp nháy, cột
thống kê và các nút. Quân bị ăn bị đánh văng, xoay rồi tan; thông báo chiếu là một cuộn giấy mở ra
rồi cuộn lại. Quân là từng ảnh cắt từ atlas `assets/pieces.webp`, chưa có đèn normal map. Nước đi
hợp lệ lấy từ `moves` trong view của server (chỉ có khi tới lượt mình), nên luật chỉ nằm ở
TypeScript.

## Tài nguyên

Hình bàn gỗ óc chó viền nổi mỏng và cảnh đình lúc hoàng hôn sinh bằng Image Gen từ prompt
trong `sources/prompts.json`; đường bàn vẽ bằng code trong `godot/main.gd`.
Quân cờ là model đĩa đá trắng ngà dựng bằng Blender, thân dày và mép thẳng không bo tròn.
Bán kính giảm nhẹ để các quân đứng cạnh nhau thoáng hơn. Chữ Hán và vòng viền được khoét
lõm vào mặt quân; màu Đỏ/Đen nằm ở đáy rãnh, còn thành rãnh giữ màu ngà.
Màu trắng ngà nằm ngay trong vật liệu, giữ nguyên khi di chuyển, vỡ quân, chiếu tướng và trên
bảng kết quả. Cặp atlas `pieces.webp`/`pieces.normal.webp` cùng `pieces.json` chứa 14 quân
Đỏ/Đen; normal map raw, lossless và đục được giữ cùng atlas. Chữ trên sông kết xuất bằng
Blender. `assets/` còn có hai nút kết xuất sẵn (xin hoà mặt giấy ngà, đầu hàng sơn đỏ sẫm, khung
gỗ óc chó); bàn Godot dùng nút chung của bộ giao diện.

Tái tạo quân, bóng và nút bằng `npm run blender -- xiangqi`; chỉ bake atlas bằng
`npm run blender -- xiangqi pieces`, hoặc hai nút bằng
`npm run blender -- xiangqi button-draw button-resign`.
Cần phông Noto Sans CJK Bold (SIL Open Font License),
mặc định ở `/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc`; có thể chọn phông CJK khác
bằng `XOMDAO_XIANGQI_FONT`. Script nằm ở `sources/render_pieces.py` và `sources/render_buttons.py`, PNG trung gian ở
`.blender/xiangqi/`; xem [hướng dẫn Blender](../../docs/making-a-game.md#kết-xuất-blender-và-normal-map).
Tiếng di chuyển, vỡ quân và nhạc thắng tổng hợp bằng code.
Thông báo chiếu tướng/chiếu bí: một cuộn giấy có quân đang chiếu mở ra trên bàn rồi cuộn lại,
vẽ bằng code (`_cut_in` trong `godot/main.gd`).
Âm thanh chép từ `assets/` vào `godot/sounds/`.

## Bố cục bàn chơi

Bố cục **Bàn** ([experience.md](../../docs/experience.md)): bàn gỗ óc chó ở giữa, cao gần trọn
khung, trước cảnh đình. Cột bên trái có hai người chơi (mình ở dưới, đối thủ dưới nút ☰ của hub)
và số nước giữa họ; cột bên phải có trạng thái và các nút Xin hoà, Đầu hàng, Hiệu ứng. Bên Đen
thấy bàn xoay ngược.
