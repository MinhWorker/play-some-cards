# Bắn Tàu

Bắn Tàu (Battleship) cho hai người, chơi với bạn bè hoặc với máy ở ba mức. Game ở trạng thái
`ready`, có đảo quân cảng riêng, biển và hạm đội, hiệu ứng bắn/chìm cùng âm thanh và nhạc nền.
Xem [luật chơi](RULES.md).

## Luật chơi

- Mỗi bên có một vùng biển 10 × 10 ô (cột A–J, hàng 1–10) và một hạm đội năm tàu nằm thẳng
  hàng, ngang hoặc dọc: Tàu sân bay (5 ô), Thiết giáp hạm (4), hai Tuần dương hạm (3) và Khu trục
  hạm (2). Không ai thấy tàu của đối phương.
- **Xếp tàu**: hạm đội được xếp ngẫu nhiên sẵn; mỗi người sửa lại tuỳ ý rồi bấm "Sẵn sàng". Mặc
  định các tàu không được nằm sát nhau (kể cả chéo); phòng có thể cho phép sát nhau. Tàu không bao
  giờ được chồng lên nhau.
- **Bắn**: hai bên lần lượt chọn một ô ở biển đối phương. Kết quả là **trượt**, **trúng**, hoặc
  **chìm** khi mọi ô của một tàu đều đã trúng (lúc đó cả con tàu hiện ra). Mặc định bắn trúng
  được bắn tiếp; phòng có thể chọn đổi lượt sau mỗi phát.
- **Thắng** khi đánh chìm cả hạm đội đối phương. Cũng thua khi đầu hàng hoặc rời trận.
- Hết trận, cả hai hạm đội hiện ra.

## Tạo phòng

Mọi tuỳ chọn nằm trong bảng Tạo phòng: **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó),
**Xếp tàu** (không sát nhau hoặc được sát nhau), **Bắn trúng** (được bắn tiếp hoặc đổi lượt) và
**Lượt bắn** (bạn bắn trước hoặc đối thủ bắn trước).

Máy chơi: Dễ bắn ngẫu nhiên và hay bắn quanh chỗ vừa trúng; Vừa bắn theo ô cờ rồi lần theo
đường thẳng để đánh chìm tàu; Khó tính xem các tàu còn lại có thể nằm ở đâu và bắn vào ô có nhiều
khả năng nhất. Máy chỉ biết những gì người chơi biết (ô đã bắn, trúng hay trượt, tàu đã chìm).

## Bàn chơi

`godot/main.gd` dựng bàn theo bố cục **Bàn**: biển lớn ở giữa, cột người chơi bên trái (biển của
bạn thu nhỏ giữa hai ô người chơi khi vào trận), trạng thái, phát bắn vừa rồi, hạm đội đối phương
và các nút bên phải. Xếp tàu: kéo thả tàu với ô đích xanh/đỏ, chạm chọn, chạm lần nữa để xoay,
chạm ô trống để dời; **Xếp lại**, **Sẵn sàng**. Vào trận chạm ô biển đối phương để bắn; trượt có
cột nước, trúng có chớp lửa, **Đầu hàng** hỏi lại một lần. `godot/sea.gd` vẽ một vùng biển,
`godot/rules.gd` kiểm tra vị trí tàu (chép từ `rules.ts`); hình ở `godot/art/`, âm thanh ở
`godot/sounds/`, nhạc ở `godot/music/`; test: `godot/test/`.

Chạy: `npm run godot:export -- --debug` và `npm run dev`, rồi mở
`http://localhost:5033/?play=battleship` (đấu máy Dễ, trên server thật). Kiểm tra bằng
`npm run check` và `npm run godot:check`.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  game/model.ts             dữ liệu: State, View (giấu hạm đội đối phương), tuỳ chọn phòng
  game/rules.ts             tàu, kiểm tra hạm đội, xếp ngẫu nhiên, phần biển mỗi người được thấy
  game/bot.ts               máy bắn (ba mức)
  game/BattleshipGame.ts    các sự kiện: arrange (bí mật), shuffle, ready, fire, resign
godot/
  main.tscn, main.gd        bàn: hai vùng biển, xếp tàu, bắn, trúng/trượt/chìm
  sea.gd, rules.gd          một vùng biển; kiểm tra vị trí tàu
  art/, sounds/, music/     hình, âm thanh và nhạc bàn dùng
assets/                     hình (.webp) và âm thanh (.wav/.mp3) cỡ đầy đủ
```

Âm thanh riêng cho đặt tàu, sẵn sàng, bắn, trượt, trúng, chìm và thắng, cùng một bản nhạc nền
nhẹ.

## Hình và âm thanh

Đảo quân cảng tạo bằng image generation của Codex, lấy đảo Tiến Lên và Bài Cào làm mẫu:
chất liệu 3D mềm, ánh sáng ấm, cỏ xanh, dây leo và khối đá lơ lửng thuôn nhọn. Prompt ở
`sources/prompts.json`; ảnh WebP cắt khoảng trống trong suốt và có cạnh dài nhất 640 px,
cùng chuẩn với các đảo khác. Khi tạo lại bằng `npm run gen:asset`, PNG gốc được lưu vào
`sources/island.png` (Git LFS).

Các hình trên bàn và âm thanh là tác phẩm gốc tạo bằng code trong `sources/render_assets.py`.
Asset phát hành theo giấy phép MIT của repo, không dùng mẫu tải ngoài.
Hình WebP có nền trong suốt (trừ biển), hiệu ứng WAV mono 16-bit 44,1 kHz, nhạc MP3 128 kbps.
Bàn dùng bản sao trong `godot/art/`, `godot/sounds/` và `godot/music/`. Tạo lại từ thư mục gốc (cần `npm install`, Python 3 và ffmpeg):

```sh
python3 games/battleship/sources/render_assets.py
npm run assets -- battleship
```

Tạo lại đảo bằng image generation: `npm run gen:asset -- battleship/island`.
Script Python chỉ tạo hình trên bàn và âm thanh, không ghi đè đảo.
