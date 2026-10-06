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

Mọi tuỳ chọn nằm trong một form: **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó),
**Xếp tàu** (không sát nhau hoặc được sát nhau), **Bắn trúng** (được bắn tiếp hoặc đổi lượt) và
**Lượt bắn** (bạn bắn trước hoặc đối thủ bắn trước).

Lúc xếp tàu, biển lớn là của bạn: chạm một tàu để chọn, chạm lần nữa để xoay, chạm một ô trống
để dời tàu tới đó; "Xếp lại" xếp ngẫu nhiên cả hạm đội. Vào trận, biển lớn là của đối phương
(chạm một ô để bắn khi tới lượt), biển của bạn thu nhỏ ở cột trái; cột phải liệt kê các tàu đối
phương, tàu đã chìm bị làm mờ.

Máy chơi: Dễ bắn ngẫu nhiên và hay bắn quanh chỗ vừa trúng; Vừa bắn theo ô cờ rồi lần theo
đường thẳng để đánh chìm tàu; Khó tính xem các tàu còn lại có thể nằm ở đâu và bắn vào ô có nhiều
khả năng nhất. Máy chỉ biết những gì người chơi biết (ô đã bắn, trúng hay trượt, tàu đã chìm).

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  client.ts                 đầu vào phía trình duyệt: form tạo phòng và hai vùng biển
  game/model.ts             dữ liệu: State, View (giấu hạm đội đối phương), tuỳ chọn phòng
  game/rules.ts             tàu, kiểm tra hạm đội, xếp ngẫu nhiên, phần biển mỗi người được thấy
  game/bot.ts               máy bắn (ba mức)
  game/BattleshipGame.ts    các sự kiện: arrange (bí mật), shuffle, ready, fire, resign
  scenes/BattleshipView.ts  hai vùng biển: xếp tàu, bắn, trúng/trượt/chìm
  scenes/Setup.ts           form tạo phòng
assets/                     hình (.webp) và âm thanh (.wav/.mp3), dùng theo tên file
```

`OceanBackground.ts` dựng nền biển phủ toàn màn hình. Bàn lớn và bản đồ hạm đội dùng cùng
sprite tàu nhìn từ trên xuống, xoay theo hướng tàu; tàu đã chìm sẫm màu, ô trúng có dấu lửa,
ô trượt có vòng nước. Đạn bay tới ô bắn, trượt tạo cột nước, trúng tạo chớp lửa; tàu chìm
lún xuống và rung theo chiều dài. Khán giả thấy hiệu ứng đúng vùng biển, chỉ thấy tàu đã chìm.

Âm thanh riêng cho đặt tàu, sẵn sàng, bắn, trượt, trúng, chìm và thắng. Nhạc nền nhẹ được
app phát qua kênh nhạc; hiệu ứng đi qua kênh âm thanh và tuân theo cài đặt tắt tiếng.

## Hình và âm thanh

Toàn bộ hình và âm thanh Bắn Tàu là tác phẩm gốc tạo bằng code trong
`sources/render_assets.py`, phát hành theo giấy phép MIT của repo, không dùng mẫu tải ngoài.
Hình WebP có nền trong suốt (trừ biển), hiệu ứng WAV mono 16-bit 44,1 kHz, nhạc MP3 128 kbps.
Tạo lại từ thư mục gốc (cần `npm install`, Python 3 và ffmpeg):

```sh
python3 games/battleship/sources/render_assets.py
```

Test: `npm run check`. Chơi thử một mình: http://localhost:5033/?play=battleship&players=2 (khi
đang chạy `npm run dev`).

## Vòng đời bàn chơi

Hoạt ảnh và thời gian xác nhận đầu hàng dùng runtime của SDK. Khi mở ván mới, kết nối lại
hoặc rời bàn, các hiệu ứng cũ được huỷ; kết nối lại dựng bàn từ trạng thái hiện tại,
không phát lại nước đi trước đó.
