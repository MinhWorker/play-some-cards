# Cờ Vua

Cờ Vua cho hai người theo [luật hiện tại](RULES.md), chơi với bạn bè hoặc máy ở ba mức.
Bàn gỗ và quân Staunton trắng ngà/đen đá được kết xuất bằng Blender, đặt trên nền vải xanh đêm.
Đảo trên bản đồ tạo bằng Image Gen.

## Chơi

Form tạo phòng có **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó) và **Bạn cầm quân**
(Trắng đi trước, hoặc Đen). Chủ phòng đổi tuỳ chọn giữa hai ván bằng “Tuỳ chỉnh”. Người cầm Đen
thấy bàn xoay ngược, quân mình ở dưới.

Chạm quân của mình để chọn, rồi chạm ô có chấm để đi; vòng tròn đánh dấu quân ăn được. Ô nước
vừa đi tô vàng, Vua bị chiếu tô đỏ. Khi Tốt tới hàng cuối, bảng **Phong cấp** cho chọn Hậu, Xe,
Tượng hoặc Mã. Hai nút **Xin hoà** và **Đầu hàng** ở bên phải; đầu hàng cần chạm xác nhận lần hai
trong ba giây. Chơi với máy không có nút xin hoà.

Cột trái có hai thẻ người chơi: tên, màu quân, số ván thắng và số quân đã ăn;
vạch đồng đánh dấu người đang đi. Số nước nằm giữa hai thẻ. Kết thúc
ván có bảng kết quả, thời gian, số lượt đi và số quân mỗi bên ăn được. **Xem bàn cờ** đóng bảng;
**Kết quả** mở lại. **Hiệu ứng: Bật/Tắt** lưu trên máy, tắt chuyển động nhưng giữ âm thanh;
âm thanh và nhạc điều khiển bằng nút loa chung của ứng dụng.

## Thành phần

| Thành phần | File |
| --- | --- |
| Đăng ký game và tuỳ chọn phòng | `src/index.ts`, `src/game/model.ts` |
| Luật, nhập thành, bắt tốt qua đường, phong cấp | `src/game/rules.ts` |
| Máy chơi alpha-beta | `src/game/bot.ts` |
| Lượt, xin hoà, đầu hàng | `src/game/ChessGame.ts` |
| Bàn, quân, chọn nước, hiệu ứng và âm thanh | `src/scenes/ChessView.ts` |
| Bảng kết quả | `src/scenes/ResultPanel.ts` |
| Thẻ người chơi và thống kê bên trái | `src/scenes/PlayerInfo.ts` |
| Kiểu nút xanh đêm và ngà | `src/scenes/buttons.ts` |
| Nền vải | `src/scenes/ChessBackground.ts` |
| Form tạo phòng | `src/scenes/Setup.ts` |
| Tên quân, màu và câu kết quả | `src/scenes/theme.ts` |

`src/client.ts` đăng ký bàn, form và nền phía trình duyệt. `assets/` là tài nguyên dùng trực tiếp;
`sources/` giữ prompt gốc và script tái tạo.

## Hình và âm thanh

- Bàn 8 × 8 ô có mặt phẳng chơi chiếm đúng 94% ảnh, viền walnut mỏng có đường khảm đồng;
  12 quân Staunton có cùng canvas và điểm neo, góc chụp cao gần nhìn thẳng từ trên xuống,
  ánh sáng mềm từ trên trái. Tái tạo bằng
  `blender -b -t 4 --python games/chess/sources/render_assets.py`. Thêm `-- board` hoặc
  `-- piece-white-knight` để chỉ kết xuất một hình. PNG trung gian nằm ở `.blender/chess/`;
  WebP dùng trực tiếp nằm trong `assets/`. Toạ độ, chấm nước đi và màu đánh dấu do Phaser vẽ.
- Đảo Cờ Vua: Image Gen, prompt trong `sources/prompts.json`. PNG gốc khoảng 2 MB được lưu
  bằng Git thường theo ngoại lệ trong `.gitattributes`, vì kết nối hiện tại không xác thực
  được dịch vụ upload Git LFS.
  Sinh lại bằng `npm run gen:asset -- chess/island`. Đảo dùng bàn đúng 8 hàng × 8 cột và chỉ
  sáu quân để thấy rõ lưới.
- Nút riêng kết xuất bằng Blender: `button.webp` xanh đêm và `button-secondary.webp` ngà,
  viền đồng mảnh, co giãn nine-slice. Tái tạo bằng script trên với `-- button button-secondary`.
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

## Phát triển và vòng đời

Chạy `npm run dev` từ gốc repo, chơi thử http://localhost:5033/?play=chess&players=2.
Kiểm tra bằng `npm run check`, `npm run e2e -- --changed origin/main` và
`npm run shots -- --path '/?play=chess&players=2' --audit`.
Test logic có perft khai cuộc, Kiwipete, tàn cuộc và phong cấp; chiếu hết, hết nước, lặp thế,
50 nước, xin hoà và máy chơi. Kịch bản trình duyệt nằm trong `scripts/e2e/scenarios/chess*.mjs`.

Hoạt ảnh, âm thanh và xác nhận đầu hàng dùng runtime SDK. Ván mới, đổi người xem, kết nối lại,
bật/tắt hiệu ứng và rời bàn huỷ tác vụ cũ. Dựng lại bàn từ trạng thái hiện tại không phát lại
nước đi, âm thanh bắt đầu hoặc kết thúc.
