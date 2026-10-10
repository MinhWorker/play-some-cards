# Cờ Vây

Cờ Vây cho hai người theo luật Trung Quốc, trên bàn chuẩn **19 × 19**, chơi với bạn bè hoặc
với máy ở ba mức. Trắng được 7,5 điểm bù; đếm theo diện tích.

Game đã mở trên bản chính thức; chọn đảo Cờ Vây để tạo phòng và chơi.

[Luật chơi](RULES.md)

## Tạo phòng

Bảng Tạo phòng gồm **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó) và **Bạn cầm quân**
(Đen đi trước, hoặc Trắng). Mọi ván đều dùng bàn 19 × 19; không có tuỳ chọn cỡ bàn.

## Chơi

Bố cục **Bàn** ([experience.md](../../docs/experience.md)): bàn gỗ ở giữa, cao gần trọn khung.
Cột bên trái có hai người chơi (mình ở dưới, đối thủ dưới nút ☰ của hub), mỗi người một hộp quân
và một nắp đựng quân đã bắt. Cột bên phải có trạng thái, số nước hoặc số đếm, và các nút Bỏ lượt,
Đồng ý, Đánh tiếp, Đầu hàng.

Tới lượt mình, quân sắp đặt đi theo chuột; khi ngón tay (hoặc chuột) giữ trên bàn, kính lúp hiện
các giao điểm quanh đó, thả tay là đặt quân. Quân vừa đặt có vòng đỏ, điểm cướp có ô vuông. Quân
bị bắt bay vào nắp của bên bắt. Sau hai lần bỏ lượt thì vào đếm điểm: quân chết mờ đi và mỗi
giao điểm thuộc về một bên có ô vuông nhỏ màu bên đó; chạm một nhóm quân để đánh dấu chết hoặc
sống, "Đồng ý" để kết thúc, "Đánh tiếp" để trở lại ván. "Đầu hàng" hỏi lại trước.

Kết thúc ván, bảng kết quả của hub thêm lý do kết thúc và số liệu của ván (`result_detail()`);
khi hai bên đồng ý đếm điểm, điểm Đen và Trắng hiện riêng, đã gồm điểm bù của Trắng.

Máy chơi theo kinh nghiệm: bắt quân, cứu nhóm còn một khí, chiếm đường 3–4 lúc đầu, tránh lấp
mắt mình và ước lượng vùng chắc bằng các ván ngẫu nhiên. Chưa có đồng hồ và chấp quân.

## Thành phần

| Thành phần | File |
| --- | --- |
| Bàn chuẩn, màu quân và tuỳ chọn | `src/game/model.ts` |
| Đặt quân, bắt quân, cướp, đếm điểm và đoán quân chết | `src/game/rules.ts` |
| Lượt, bỏ lượt, đồng ý, đánh tiếp và đầu hàng | `src/game/GoGame.ts` |
| Máy chơi | `src/game/bot.ts` |
| Bàn chơi: bàn, quân, kính lúp, đếm điểm, hộp và nắp, `room_setup()` và `result_detail()` | `godot/main.gd`, `godot/main.tscn` (test: `godot/test/`) |
| Hình, âm thanh và nhạc của bàn | `godot/art/`, `godot/sounds/`, `godot/music/` |

`src/index.ts` đăng ký game phía server. `assets/` chứa hình và âm thanh cỡ đầy đủ (bàn chép bản
cần dùng vào `godot/`); `sources/` chứa script và prompt tạo tài nguyên.
Test nằm cạnh phần logic với đuôi `.test.ts`; e2e ở `scripts/e2e/scenarios/godot-go.mjs`.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo rồi mở
http://localhost:5033/?play=go. Kiểm tra bằng `npm run check`, `npm run godot:check`,
`npm run e2e -- --only godot-go` và `npm run shots -- --path '/?play=go'`.
Hướng dẫn SDK: [tạo game](../../docs/making-a-game.md).

Điểm được đi lấy từ `moves` trong view của server (chỉ có khi tới lượt mình), số đếm lấy từ
`count`, nên luật chỉ nằm ở TypeScript. Chưa có đèn normal map.

## Hình và âm thanh

- Bàn gỗ kaya viền mỏng, quân đá phiến đen/đá trắng ngà mài bóng, nền vải và nút gỗ kết xuất bằng
  Blender: `npm run blender -- go`. Helper chung ở `tools/blender/xomdao_bake/`;
  cũng dùng được Python với bpy như [hướng dẫn](../../docs/making-a-game.md#kết-xuất-blender-và-normal-map). Góc nhìn thẳng từ trên
  xuống, ánh sáng mềm từ trên trái. Nền vải liền mép là tile 256×256 POT lát kín màn hình;
  tái tạo bằng `npm run blender -- go cloth`. Đường kẻ và chín sao vẽ bằng code để khớp giao điểm.
- Hộp và nắp mây đan được dựng riêng theo ảnh tham khảo, kết xuất trong suốt bằng
  `npm run blender -- go bowl bowl-lid`; chồng quân và bóng tròn vẽ bằng code.
- Tranh đảo Cờ Vây (`island`) tạo bằng Image Gen; prompt ở `sources/prompts.json`. Sinh lại bằng `npm run gen:asset -- go/island`.
- Ba tiếng đặt quân là các đoạn va chạm trong bản ghi của dự án
  `assets/audio/sfx/xomdao-wood-marker-place-veo.mp3`, được cắt, lọc phần ù thấp và làm đuôi ngắn.
  Tiếng bắt quân ghép vài va chạm nhỏ; tiếng bỏ lượt/đánh dấu nhẹ hơn. Không thêm tiếng trống
  hay cộng hưởng ống vào tiếng đặt quân.
- Tiếng mở ván, vào đếm điểm và kết thúc dùng lại `caro-start`, `caro-line-complete`, `caro-win`
  từ Cờ Caro; nhạc nền dùng lại `music-xiangqi-a.mp3` từ Cờ Tướng.
- Tạo lại âm thanh: `python games/go/sources/prepare_audio.py` (cần ffmpeg, numpy, scipy;
  tải bản ghi nguồn bằng Git LFS). Hiệu ứng mono PCM 16-bit WAV 48 kHz; nhạc MP3 128 kbps.
  Tài nguyên theo [giấy phép của dự án](../../LICENSE-ASSETS.md).
