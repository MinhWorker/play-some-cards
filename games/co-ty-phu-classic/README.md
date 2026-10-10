# Cờ tỷ phú Classic

Hai đến bốn người mua đất, thu tiền thuê và quản lý tài sản trên bàn 40 ô có địa danh Việt Nam.

[Luật chơi, giá đất, xây dựng, tiền thuê và thẻ](RULES.md)

## Tìm thành phần để sửa

```text
src/
  index.ts                     Đăng ký luật phía server
  game/                        Luật thuần, dữ liệu bàn, thẻ, máy và đồng hồ
godot/
  main.tscn, main.gd           Bàn chơi: bố cục, hoạt ảnh, nút và gửi thao tác
  marks.gd, trade.gd, texts.gd Dấu trên bàn, bảng trao đổi, chữ trên thẻ
  rules.gd                     Dữ liệu ô và toạ độ ô trên ảnh bàn (chép từ luật TypeScript)
  art/, sounds/, music/        Hình, âm thanh và nhạc bàn dùng
assets/                        Ảnh và âm thanh cỡ đầy đủ
sources/                       Script kết xuất và nguồn ảnh
```

| Muốn sửa | File |
| --- | --- |
| Tiền khởi điểm, địa danh, giá mua/xây/thuê, nhóm màu | `src/game/model.ts` |
| Mua/xây/thế chấp/trao đổi | `src/game/CoTyPhuClassicGame.ts` |
| Thuế, di chuyển, tiền thuê và hiệu lực thẻ | `src/game/rules.ts` |
| Nội dung thẻ | `src/game/cards.ts` |
| Bố cục, hoạt ảnh, nút và gửi thao tác | `godot/main.gd` |
| Dải màu chủ đất, nhà/khách sạn, đất thế chấp, góp bến xe, ô đang chọn | `godot/marks.gd` |
| Bảng đề nghị trao đổi | `godot/trade.gd` |
| Chữ trên thẻ ô, đề nghị trao đổi và dòng trạng thái | `godot/texts.gd` |
| Dữ liệu 40 ô, toạ độ ô trên ảnh bàn, tiền thuê và thế chấp | `godot/rules.gd` (chép từ `model.ts`, `rules.ts` và toạ độ của `sources/render_board_25d.py`) |

Test đặt cạnh file được kiểm tra với đuôi `.test.ts`; test GUT ở `godot/test/`. Tọa độ bàn
được tạo bởi Blender; chỉnh script kết xuất rồi tạo lại ảnh và tọa độ cùng nhau.

## Bàn chơi

Bố cục **Bàn** ([experience.md](../../docs/experience.md)): bàn 2.5D lớn ở giữa, ô người chơi xếp
cột bên phải (bạn ở dưới cùng, chip là tiền mặt), bảng in trên bàn hiện người đang quyết định với
quân, tên và tiền. Ô xanh giữa bàn chứa thông báo, xúc xắc và các nút của lượt: Gieo, Nộp 50 /
Dùng thẻ khi ở tù, Mua / Bỏ qua, Góp / Từ bỏ ở bến xe, Trả / Bỏ khi đấu giá, Xây / Hết lượt, Trả
nợ / Phá sản. Thẻ nổi trên ô giữa hiện lá Cơ hội, Khí vận, thuế (Xác nhận), đề nghị trao đổi
(Đồng ý / Từ chối) hoặc ô vừa chạm: giá, tiền thuê, chủ, và với đất của bạn Thế chấp, Chuộc, Bán
nhà, Đấu giá. Nút Trao đổi ở góc trên phải mở bảng đề nghị: chọn người, mỗi bên một ô đất (hoặc
vé ra tù, bán riêng giá 200) và tiền. Quân đi từng ô, bay khi ra sân bay hay vào tù, tiền nổi lên
trên ô người chơi.

Giá in trên từng ô đất. Chưa có: tên in trên từng ô (chạm ô để xem), bảng thế chấp nhiều ô một
lần (thế chấp từng ô).

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo, chơi thử ở
`http://localhost:5033/?play=co-ty-phu-classic` (ba máy, trên server thật). Kiểm tra bằng
`npm run check` và `npm run godot:check`.

Hướng dẫn SDK và Dev Console: [tạo game](../../docs/making-a-game.md).

Lệnh riêng của game trong `src/game/dev.ts`: `dice`, `tp`, `cash`, `card`; danh mục `square` và
`card` dùng trong tham số `@square:…`, `@card:…`.

## Tài nguyên

`assets/` chứa ảnh và âm thanh cỡ đầy đủ (bàn chép bản cần dùng vào `godot/`); `sources/` chứa
prompt và script nguồn. `sources/render_board_25d.py` tạo `assets/board-25d.webp` cùng toạ độ các
ô; các ô không mua được dùng vật liệu kim loại xước
và ánh sáng Blender, Khí vận dùng vàng kim, Sân bay dùng cyan. Tấm kim loại mỏng có
đường bao bo góc theo mặt ô và gờ bắt sáng nhỏ. `sources/render_deed_layers.py` dùng cùng
camera và ánh sáng để tạo atlas `deed-layers.webp`/`.json` gồm 240 frame badge men màu,
nhà và khách sạn sứ trắng, cùng toạ độ của chúng. Khi sửa camera, kích thước ô
hoặc ánh sáng, chạy lần lượt hai script để ảnh và tọa độ khớp nhau:

```sh
blender -b -t 4 --python games/co-ty-phu-classic/sources/render_board_25d.py
blender -b -t 4 --python games/co-ty-phu-classic/sources/render_deed_layers.py
```

Màu bộ dùng than chì, cyan, tím lan, tím violet, magenta, bạc, tím mận và xanh dầu,
xa các tông đỏ san hô, xanh dương, xanh lá và vàng của người chơi.
`sources/render_pawns.py`, `render_plane.py` và `render_hud_icons.py` kết xuất các đối tượng.
Thêm `-- --front` khi chạy `render_pawns.py` bằng Blender để kết xuất bốn pawn chính diện,
nền trong suốt, dùng riêng cho màn nhảy chiến thắng (`pawn-front-*.webp`).
Xúc xắc dùng sáu mặt trong `godot/art/dice-*.webp` và tiếng lăn `tycoon-dice.wav`.
`sources/make_audio.py` tạo bộ âm thanh; `sources/make_audio_preview.py` tạo
[trang nghe thử](sources/audio-preview/index.html).
Tiếng rút/lật thẻ dùng lại từ Tiến Lên; nhạc thắng dùng lại `mau-binh-standings.mp3` của Mậu Binh.
Tiếng nhận tiền, mua và vào tù dùng các nguồn Pixabay trong `sources/audio-preview/`;
tiếng máy bay cắt từ `assets/audio/sfx/pixabay-plane.mp3` ở gốc repo.
`sources/make_release_audio.py` tự tổng hợp hai tiếng chốt khóa và tiếng bánh lăn cửa thép
cho `tycoon-release.wav`.
Hai tiếng thông báo trao đổi/nhận thẻ dùng các file Freesound trong `assets/audio/sfx/`.
Nguồn bên thứ ba và giấy phép: [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).
