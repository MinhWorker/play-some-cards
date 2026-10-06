# Cờ Vây

Cờ Vây cho hai người theo luật Trung Quốc, trên bàn chuẩn **19 × 19**, chơi với bạn bè hoặc
với máy ở ba mức. Trắng được 7,5 điểm bù; đếm theo diện tích.

Game đã mở trên bản chính thức; chọn đảo Cờ Vây để tạo phòng và chơi.

[Luật chơi](RULES.md)

## Tạo phòng

Form gồm **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó) và **Bạn cầm quân**
(Đen đi trước, hoặc Trắng). Mọi ván đều dùng bàn 19 × 19; không có tuỳ chọn cỡ bàn.
Chủ phòng đổi các tuỳ chọn giữa hai ván bằng "Tuỳ chỉnh".

Trên điện thoại, giữ và rê ngón tay để xem trước giao điểm trong kính phóng đại, thả tay để
đặt quân; rê ra khỏi bàn để huỷ. Bàn tận dụng khoảng trống giữa hai cụm HUD và chiếm gần hết
chiều cao màn hình ngang; người chơi và nút điều khiển nằm hai bên.
Người 1 ở góc dưới phải, người 2 ở góc trên trái, kể cả khi đổi màu quân. HUD không có khung:
ảnh đại diện bên trái, tên và số quân đã bắt bên phải; vòng vàng quanh avatar chỉ bên đang có lượt.
Hai cụm chừa chỗ cho thanh phòng và nút cài đặt chung. Trạng thái lượt và số nước nằm bên phải bàn.
Nút "Bỏ lượt" ở bên trái bàn. Đầu hàng là nút lá cờ trắng nằm riêng bên phải, dưới trạng thái
lượt; chạm vào mở hộp xác nhận "Đầu hàng?" với hai nút "Chơi tiếp" và "Đầu hàng" (chạm ra ngoài
hộp cũng là chơi tiếp).
Mỗi người có hộp mây và nắp riêng: đầu ván nắp trượt mở, hộp chứa 181 quân Đen hoặc 180 quân Trắng.
Quân được đặt xuống bàn ngay, số quân trong hộp vơi dần; quân bắt được bay lên nắp của người bắt.
Quân vừa đặt có vòng đỏ, điểm cướp có ô vuông. Khi đếm điểm,
quân chết mờ đi và ô vuông nhỏ đen/trắng cho biết giao điểm đó tính cho ai. Hai bên sửa đánh dấu,
cùng "Đồng ý" để kết thúc, hoặc "Đánh tiếp" để trở lại ván.

Kết thúc ván, panel giữa bàn thông báo "Chiến thắng!" hoặc "Thua rồi" theo người đang xem;
khán giả thấy màu quân thắng. Panel hiển thị người thắng, lý do kết thúc, số nước, quân đã bắt
và thời gian chơi. Khi hai bên đồng ý đếm điểm, điểm Đen và Trắng được hiển thị riêng, đã gồm
điểm bù của Trắng. Nút riêng "Xem bàn cờ" ẩn panel, "Tổng kết" mở lại; không có khung kết quả
phụ. Chủ phòng mở ván tiếp bằng "Chơi ván mới" ở giữa thanh trên, cạnh "Tuỳ chỉnh".
Khi kết nối lại hoặc đổi ghế, bàn và số quân trong hộp/nắp được dựng lại đúng trạng thái;
ở ván đã kết thúc, panel hiện lại không phát âm thanh.

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
| Thông báo chiến thắng và thống kê cuối ván | `src/scenes/ResultPanel.ts` |
| Nút lá cờ trắng và hộp xác nhận đầu hàng | `src/scenes/ResignDialog.ts` |
| Hộp, nắp và các chồng quân theo số lượng | `src/scenes/StoneBowl.ts` |
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
- Hộp và nắp mây đan được dựng riêng theo ảnh tham khảo, kết xuất trong suốt bằng
  `blender -b -t 4 --python games/go/sources/render_bowls.py`; chồng quân và bóng tròn do Phaser vẽ.
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

Quân đặt xuống bàn ngay, không bay từ hộp; hộp vơi dần, quân bị bắt chuyển sang nắp đối thủ, hộp/nắp rung nhẹ.
Nước đi và âm thanh dùng runtime SDK: ván mới, đổi ghế, kết nối lại và
rời bàn huỷ hiệu ứng cũ; dựng lại bàn không phát lại nước đi hoặc nhạc kết thúc.
