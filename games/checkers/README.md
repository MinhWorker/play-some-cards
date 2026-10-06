# Cờ Đam

Cờ Đam cho hai người, chơi với bạn bè hoặc máy ở ba mức, dùng duy nhất bàn **8 × 8 theo luật Anh**.
Game ở trạng thái `ready`. Xem [luật chơi](RULES.md).

## Chơi

Form tạo phòng có **Đối thủ**, **Máy chơi** và **Lượt đi**. Đen đi trước, mỗi bên 12 quân;
người đi sau thấy bàn xoay ngược. Chủ phòng đổi tuỳ chọn giữa hai ván bằng “Tuỳ chỉnh”.

Quân đi được có vòng vàng. Chọn quân rồi chọn ô có chấm xanh; với nước ăn nhiều quân, chọn lần
lượt từng ô đáp. Ô nước vừa đi tô vàng, đường đang chọn tô xanh. Quân di chuyển từng bước, quân
bị ăn bay về cột thống kê, phong Vua có vòng sáng và dấu vương miện vàng trên quân.

Cột trái hiển thị tên, chủ phòng, số ván thắng, số quân đã ăn và số nước. Viền vàng đánh dấu
người đang đi. Bên phải có trạng thái, **Xin hoà**, **Đầu hàng** (xác nhận lần hai trong ba giây)
và **Hiệu ứng: Bật/Tắt**, lưu trên máy. Tắt hiệu ứng giữ âm thanh; loa chung điều khiển âm thanh
và nhạc. Kết thúc ván có bảng kết quả, thời gian, số lượt và quân đã ăn; **Xem bàn cờ** đóng bảng,
**Kết quả** mở lại.

## Thành phần

| Thành phần | File |
| --- | --- |
| Đăng ký game, tuỳ chọn phòng | `src/index.ts`, `src/game/model.ts` |
| Luật đi quân, bắt buộc ăn và phong Vua | `src/game/rules.ts` |
| Máy chơi alpha-beta | `src/game/bot.ts` |
| Lượt đi, xin hoà, đầu hàng | `src/game/CheckersGame.ts` |
| Bàn, quân, thống kê, hiệu ứng và âm thanh | `src/scenes/CheckersView.ts` |
| Bảng kết quả | `src/scenes/ResultPanel.ts` |
| Nền vải, nút và form tạo phòng | `src/scenes/CheckersBackground.ts`, `buttons.ts`, `Setup.ts` |

## Hình và âm thanh

- Bốn quân đam trắng ngà/đen gỗ có rãnh, Vua có dấu vương miện và vòng vàng, cùng canvas 384 px.
  Đảo riêng có bàn 8 × 8 và bốn quân. Kết xuất bằng Blender:
  `npm run blender -- checkers`. Thêm `island` hoặc `piece-black-king` sau id để chỉ kết xuất
  một hình. Helper vật liệu, hình học và đèn dùng chung ở `tools/blender/psc_bake/`; có thể
  chạy Python với bpy như [hướng dẫn](../../docs/making-a-game.md#kết-xuất-blender-và-normal-map).
  PNG trung gian ở `.blender/checkers/`; WebP trực tiếp ở `assets/`.
- Bàn walnut/maple, nền vải xanh đêm và hai nút nine-slice dùng lại tài nguyên Blender của
  Cờ Vua (`games/chess/assets/{board,cloth,button,button-secondary}.webp`). Mặt chơi chiếm 94%
  ảnh bàn, khớp lề 3% trong scene; nút dùng slice 32. Nền vải là tile 256×256 POT liền mép,
  vẽ bằng `TileSprite`; tái tạo bằng `npm run blender -- checkers cloth`.
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

## Phát triển và vòng đời

Chạy `npm run dev`, chơi thử http://localhost:5033/?play=checkers&players=2.
Kiểm tra bằng `npm run check`, `npm run e2e -- --changed origin/main` và
`npm run shots -- --path '/?play=checkers&players=2' --audit`.
Test gồm perft khai cuộc tới độ sâu 6 (36768), ăn liên tiếp, phong Vua, Vua đi lùi, hoà và máy chơi.
Kịch bản trình duyệt ở `scripts/e2e/scenarios/checkers*.mjs`.

Chuyển động, âm thanh và xác nhận đầu hàng dùng runtime SDK. Ván mới, kết nối lại, đổi người xem,
bật/tắt hiệu ứng hoặc rời bàn huỷ tác vụ cũ. Dựng lại bàn từ trạng thái hiện tại không phát lại
nước đi hay âm thanh bắt đầu/kết thúc. Bảng kết quả đợi chuỗi ăn và phong Vua hoàn tất.
