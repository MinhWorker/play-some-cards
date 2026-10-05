# Cờ Vây

Cờ Vây cho hai người theo luật Trung Quốc, trên bàn chuẩn **19 × 19**, chơi với bạn bè hoặc
với máy ở ba mức. Trắng được 7,5 điểm bù; đếm theo diện tích.

[Luật chơi](RULES.md)

## Tạo phòng

Form gồm **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó) và **Bạn cầm quân**
(Đen đi trước, hoặc Trắng). Mọi ván đều dùng bàn 19 × 19; không có tuỳ chọn cỡ bàn.
Chủ phòng đổi các tuỳ chọn giữa hai ván bằng "Tuỳ chỉnh".

Trên điện thoại, giữ và rê ngón tay để xem trước giao điểm trong kính phóng đại, thả tay để
đặt quân; rê ra khỏi bàn để huỷ. Bàn tận dụng khoảng trống giữa hai cụm HUD và chiếm gần hết
chiều cao màn hình ngang; người chơi và nút điều khiển nằm hai bên.
Quân vừa đặt có vòng đỏ, điểm cướp có ô vuông. Khi đếm điểm,
quân chết mờ đi và ô vuông nhỏ đen/trắng cho biết giao điểm đó tính cho ai. Hai bên sửa đánh dấu,
cùng "Đồng ý" để kết thúc, hoặc "Đánh tiếp" để trở lại ván.

Máy chơi theo kinh nghiệm: bắt quân, cứu nhóm còn một khí, chiếm đường 3–4 lúc đầu, tránh lấp
mắt mình và ước lượng vùng chắc bằng các ván ngẫu nhiên. Chưa có đồng hồ và chấp quân.

## Thành phần

| Thành phần | File |
| --- | --- |
| Bàn chuẩn, màu quân và tuỳ chọn | `src/game/model.ts` |
| Đặt quân, bắt quân, cướp, đếm điểm và đoán quân chết | `src/game/rules.ts` |
| Lượt, bỏ lượt, đồng ý, đánh tiếp và đầu hàng | `src/game/GoGame.ts` |
| Máy chơi | `src/game/bot.ts` |
| Bàn, quân, hiệu ứng và âm thanh | `src/scenes/GoView.ts` |
| Nền vải xanh trầm | `src/scenes/GoBackground.ts` |
| Form tạo phòng | `src/scenes/Setup.ts` |

`src/index.ts` đăng ký game phía server; `src/client.ts` đăng ký giao diện.
`assets/` chứa hình và âm thanh dùng trực tiếp; `sources/` chứa script và prompt tạo tài nguyên.
Test nằm cạnh phần logic với đuôi `.test.ts`; e2e ở `scripts/e2e/scenarios/go.mjs`.

## Phát triển

Chạy `npm run dev` ở gốc repo rồi mở http://localhost:5033/?play=go&players=2.
Kiểm tra bằng `npm run check`, `npm run e2e -- --changed origin/main` và
`npm run shots -- --path '/?play=go&players=2' --audit`.
Hướng dẫn SDK: [tạo game](../../docs/making-a-game.md).

## Hình và âm thanh

- Bàn gỗ kaya viền mỏng, quân đá phiến đen/đá trắng ngà mài bóng, nền vải và nút gỗ kết xuất bằng
  Blender: `blender -b -t 8 --python games/go/sources/render_assets.py`. Góc nhìn thẳng từ trên
  xuống, ánh sáng mềm từ trên trái. Đường kẻ và chín sao do Phaser vẽ để khớp giao điểm.
- Đảo Cờ Vây trên bản đồ tạo bằng Image Gen; prompt ở `sources/prompts.json`. Sinh lại bằng `npm run gen:asset -- go/island`.
- Ba tiếng đặt quân là các đoạn va chạm trong bản ghi của dự án
  `assets/audio/sfx/psc-wood-marker-place-veo.mp3`, được cắt, lọc phần ù thấp và làm đuôi ngắn.
  Tiếng bắt quân ghép vài va chạm nhỏ; tiếng bỏ lượt/đánh dấu nhẹ hơn. Không thêm tiếng trống
  hay cộng hưởng ống vào tiếng đặt quân.
- Tiếng mở ván, vào đếm điểm và kết thúc dùng lại `caro-start`, `caro-line-complete`, `caro-win`
  từ Cờ Caro; nhạc nền dùng lại `music-xiangqi-a.mp3` từ Cờ Tướng.
- Tạo lại âm thanh: `python games/go/sources/prepare_audio.py` (cần ffmpeg, numpy, scipy;
  tải bản ghi nguồn bằng Git LFS). Hiệu ứng mono PCM 16-bit WAV 48 kHz; nhạc MP3 128 kbps.
  Tài nguyên theo [giấy phép của dự án](../../LICENSE-ASSETS.md).

Hiệu ứng đặt quân hạ nhẹ xuống bàn; quân bị bắt mờ rồi được nhấc khỏi bàn. Vòng vàng cạnh màu
quân chỉ lượt hiện tại. Nước đi và âm thanh dùng runtime SDK: ván mới, đổi ghế, kết nối lại và
rời bàn huỷ hiệu ứng cũ; dựng lại bàn không phát lại nước đi hoặc nhạc kết thúc.
