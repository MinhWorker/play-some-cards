# Cờ Đam

Cờ Đam cho hai người, chơi với bạn bè hoặc máy ở ba mức, dùng bàn **8 × 8 với luật đơn giản hóa**:
không bắt buộc ăn quân, Vua đi nhiều ô trên cùng một đường chéo cả tiến lẫn lùi.
Game ở trạng thái `ready`. Xem [luật chơi](RULES.md).

## Chơi

Bảng Tạo phòng có **Đối thủ**, **Máy chơi** và **Lượt đi**. Đen đi trước, mỗi bên 12 quân;
người đi sau thấy bàn xoay ngược.

Quân đi được có vòng vàng. Chọn quân rồi chọn ô có chấm xanh; với nước ăn nhiều quân, chọn lần
lượt từng ô đáp. Ô nước vừa đi tô vàng, đường đang chọn tô xanh. Quân di chuyển từng bước, quân
bị ăn bay về cột thống kê, phong Vua có vòng sáng và dấu vương miện vàng trên quân.

Cột trái hiển thị tên, chủ phòng, số ván thắng, số quân đã ăn và số nước. Viền vàng đánh dấu
người đang đi. Bên phải có trạng thái, **Xin hoà**, **Đầu hàng** (xác nhận lần hai trong ba giây)
và **Hiệu ứng: Bật/Tắt**. Tắt hiệu ứng giữ âm thanh. Kết thúc ván, bảng kết quả của hub thêm số
lượt và quân đã ăn (`result_detail()`); **Xem bàn** đóng bảng, **Kết quả** mở lại.

## Thành phần

| Thành phần | File |
| --- | --- |
| Đăng ký game, tuỳ chọn phòng | `src/index.ts`, `src/game/model.ts` |
| Luật đi quân, ăn tùy chọn, Vua đi xa và phong Vua | `src/game/rules.ts` |
| Máy chơi alpha-beta | `src/game/bot.ts` |
| Lượt đi, xin hoà, đầu hàng | `src/game/CheckersGame.ts` |
| Bàn chơi: bàn, quân, thống kê, hiệu ứng, âm thanh, `room_setup()` và `result_detail()` | `godot/main.gd`, `godot/main.tscn` (test: `godot/test/`) |
| Hình, âm thanh và nhạc của bàn | `godot/art/`, `godot/sounds/`, `godot/music/` |

## Hình và âm thanh

- Bốn quân đam trắng ngà/đen gỗ có rãnh, Vua có dấu vương miện và vòng vàng, cùng canvas 384 px.
  Đảo riêng có bàn 8 × 8 và bốn quân. Kết xuất bằng Blender:
  `npm run blender -- checkers`. Thêm `island` hoặc `piece-black-king` sau id để chỉ kết xuất
  một hình. Helper vật liệu, hình học và đèn dùng chung ở `tools/blender/xomdao_bake/`; có thể
  chạy Python với bpy như [hướng dẫn](../../docs/making-a-game.md#kết-xuất-blender-và-normal-map).
  PNG trung gian ở `.blender/checkers/`; WebP ở `assets/`, bản bàn dùng chép vào `godot/art/`.
- Bàn walnut/maple là bản sao tài nguyên Blender của Cờ Vua (`games/chess/assets/board.webp`).
  Mặt chơi chiếm 94% ảnh bàn.
- Nền vải xanh đêm là tile 256×256 POT liền mép của riêng Cờ Đam, lát kín màn hình; tái tạo bằng
  `npm run blender -- checkers cloth`.
- Quân và đảo giữ thông số kết xuất cũ (96 mẫu, `LEGACY_RIG`) để kết xuất lại khớp hình đã có.
- Âm thanh lấy từ dự án, không dùng nguồn ngoài. Tái tạo bằng
  `python3 games/checkers/sources/prepare_audio.py`. Hiệu ứng mono PCM 16-bit WAV 48 kHz,
  nhạc MP3 128 kbps.

| Asset | Nguồn |
| --- | --- |
| `checkers-start`, `checkers-select` | Cờ Tướng: `xiangqi-start`, `xiangqi-piece-select` |
| `checkers-move`, `checkers-capture` | Cờ Vây: `go-place-1`, `go-capture` |
| `checkers-promote`, `checkers-draw`, `checkers-win` | Cờ Tướng: `xiangqi-decisive-move`, `xiangqi-draw`, `xiangqi-game-win` |
| `music-checkers` | Cờ Vây: `music-go` (gốc `music-xiangqi-a`) |

Tài nguyên theo [giấy phép của dự án](../../LICENSE-ASSETS.md).

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev`, rồi chơi thử
http://localhost:5033/?play=checkers. Kiểm tra bằng `npm run check`, `npm run godot:check`,
`npm run e2e -- --only godot-checkers` và `npm run shots -- --path '/?play=checkers'`.
Test gồm nước khai cuộc, ăn tùy chọn, ăn liên tiếp, phong Vua, Vua đi và ăn xa, hoà và máy chơi;
test GUT ở `godot/test/`.

Nước đi hợp lệ lấy từ `moves` trong view của server (chỉ có khi tới lượt mình), nên luật chỉ nằm
ở TypeScript.
