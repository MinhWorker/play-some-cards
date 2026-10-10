# Cờ Vua

Cờ Vua cho hai người theo [luật hiện tại](RULES.md), chơi với bạn bè hoặc máy ở ba mức.
Bàn gỗ và quân Staunton trắng ngà/đen đá được kết xuất bằng Blender, đặt trên nền vải xanh đêm
dạng tile 256×256. Tranh đảo tạo bằng Image Gen.

## Chơi

Bảng Tạo phòng có **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó) và **Bạn cầm quân**
(Trắng đi trước, hoặc Đen). Người cầm Đen thấy bàn xoay ngược, quân mình ở dưới.

Bố cục **Bàn** ([experience.md](../../docs/experience.md)): bàn gỗ ở giữa, cao gần trọn khung.
Cột bên trái có hai người chơi (mình ở dưới, đối thủ dưới nút ☰ của hub) và số nước giữa họ; cột
bên phải có trạng thái và các nút **Xin hoà**, **Đầu hàng**, **Hiệu ứng**.

Chạm quân của mình để chọn, rồi chạm ô có chấm để đi; vòng tròn đánh dấu quân ăn được. Ô nước
vừa đi tô vàng, Vua bị chiếu tô đỏ. Quân trượt tới ô mới (Xe cũng trượt khi nhập thành), quân bị
ăn bay về ghế của bên ăn. Khi chiếu tướng (hoặc chiếu hết), một dải ruy-băng đỏ thẫm mang quân
đang chiếu hiện trên bàn với chữ “CHIẾU TƯỚNG!” (hoặc “CHIẾU HẾT!”). **Hiệu ứng: Tắt** bỏ chuyển
động nhưng giữ âm thanh. Khi Tốt tới hàng cuối, bảng **Phong cấp** cho chọn Hậu, Xe, Tượng hoặc Mã.

Kết thúc ván, bảng kết quả của hub thêm số liệu của ván (`result_detail()`); **Xem bàn** đóng
bảng, **Kết quả** mở lại.

## Thành phần

| Thành phần | File |
| --- | --- |
| Đăng ký game và tuỳ chọn phòng | `src/index.ts`, `src/game/model.ts` |
| Luật, nhập thành, bắt tốt qua đường, phong cấp | `src/game/rules.ts` |
| Máy chơi alpha-beta | `src/game/bot.ts` |
| Lượt, xin hoà, đầu hàng | `src/game/ChessGame.ts` |
| Bàn chơi: bàn, quân, phong cấp, cut-in, thống kê, `room_setup()` và `result_detail()` | `godot/main.gd`, `godot/main.tscn` (test: `godot/test/`) |
| Hình, âm thanh và nhạc của bàn | `godot/art/`, `godot/sounds/`, `godot/music/` |

`assets/` là tài nguyên cỡ đầy đủ (bàn chép bản cần dùng vào `godot/`); `sources/` giữ prompt gốc
và script tái tạo.

## Hình và âm thanh

- Bàn 8 × 8 ô có mặt phẳng chơi chiếm đúng 94% ảnh, viền walnut mỏng có đường khảm đồng;
  12 quân Staunton có cùng canvas và điểm neo, góc chụp cao gần nhìn thẳng từ trên xuống,
  ánh sáng mềm từ trên trái. Tượng có cổ hai tầng, đầu mũ nhọn và rãnh chéo sâu,
  phân biệt rõ với đầu tròn của Tốt ở góc nhìn cao. Tái tạo bằng
  `npm run blender -- chess pieces`. `npm run blender -- chess board` kết xuất bàn;
  `npm run blender -- chess piece-white-knight` sửa riêng Mã rồi ghép lại atlas. PNG trung gian
  nằm ở `.blender/chess/`; cặp `assets/pieces.webp`/`pieces.normal.webp` và `pieces.json`
  chứa 12 khung cùng điểm neo. Bake riêng hai màu Tượng bằng
  `npm run blender -- chess piece-white-bishop piece-black-bishop`. Normal map raw, lossless, đục (không alpha) và hướng đèn trên trái. Bàn và nút vẫn
  dùng bộ đèn cũ (`LEGACY_RIG`) để kết xuất lại khớp hình đã có.
  Có thể dùng Python 3.13 với `bpy==5.1.2` qua `XOMDAO_BLENDER_PYTHON`; xem
  [hướng dẫn Blender](../../docs/making-a-game.md#kết-xuất-blender-và-normal-map). Toạ độ, chấm
  nước đi và màu đánh dấu vẽ bằng code.
- Đảo Cờ Vua: Image Gen, prompt trong `sources/prompts.json`. PNG gốc khoảng 2 MB được lưu
  bằng Git thường theo ngoại lệ trong `.gitattributes`, vì kết nối hiện tại không xác thực
  được dịch vụ upload Git LFS.
  Sinh lại bằng `npm run gen:asset -- chess/island`. Đảo dùng bàn đúng 8 hàng × 8 cột và chỉ
  sáu quân để thấy rõ lưới.
- `assets/` còn có hai nút kết xuất bằng Blender (`button.webp` xanh đêm, `button-secondary.webp`
  ngà; `npm run blender -- chess button button-secondary`); bàn Godot dùng nút chung của bộ giao
  diện.
- Nền vải liền mép 256×256 POT lát kín màn hình; tái tạo bằng `npm run blender -- chess cloth`.
- Âm thanh dùng lại của dự án theo bảng dưới; không dùng nguồn
  ngoài. Tái tạo bằng `python3 games/chess/sources/prepare_audio.py` (cần ffmpeg).
  Hiệu ứng mono PCM 16-bit WAV 48 kHz; nhạc MP3 128 kbps.

| Asset Cờ Vua | Nguồn trong game khác |
| --- | --- |
| `chess-start`, `chess-select` | Cờ Tướng: `xiangqi-start`, `xiangqi-piece-select` |
| `chess-move`, `chess-capture`, `chess-castle` | Cờ Vây: `go-place-1`, `go-capture`, `go-place-3` |
| `chess-promote`, `chess-check`, `chess-mate` | Cờ Tướng: `xiangqi-decisive-move`, `xiangqi-check`, `xiangqi-checkmate` |
| `chess-draw`, `chess-win` | Cờ Tướng: `xiangqi-draw`, `xiangqi-game-win` |
| `music-chess` | Cờ Vây: `music-go` (gốc `music-xiangqi-a`) |

Tài nguyên theo [giấy phép của dự án](../../LICENSE-ASSETS.md).

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` từ gốc repo, chơi thử
http://localhost:5033/?play=chess. Kiểm tra bằng `npm run check`, `npm run godot:check`,
`npm run e2e -- --only godot-chess` và `npm run shots -- --path '/?play=chess'`.
Test logic có perft khai cuộc, Kiwipete, tàn cuộc và phong cấp; chiếu hết, hết nước, lặp thế,
50 nước, xin hoà và máy chơi; test GUT ở `godot/test/`.

Quân là từng ảnh cắt từ atlas `assets/pieces.webp`, chưa có đèn normal map. Nước đi hợp lệ lấy
từ `moves` trong view của server (chỉ có khi tới lượt mình), nên luật chỉ nằm ở TypeScript.
