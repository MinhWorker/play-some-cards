# Bài Cào

Bài Cào (ba cây) cho 2–6 người, chơi với bạn bè hoặc thêm tối đa 5 người chơi máy.
Game ở trạng thái `ready`.

Luật hiện tại: [Luật Bài Cào](RULES.md).

## Tạo phòng

Một form: **Chơi với máy** (không, hoặc 1–5 máy) và **Số ván** (5, 10, 20). Máy cược ngẫu nhiên
(thường là 10) và lật bài ngay.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  client.ts                 đầu vào phía trình duyệt: form tạo phòng và bàn
  game/cards.ts             lá bài, tính nút, Ba Tây, so bài
  game/model.ts             dữ liệu: State, View (giấu bài chưa lật), tuỳ chọn phòng, thời gian
  game/BaiCaoGame.ts        các sự kiện: bet, reveal; hẹn giờ: bet-over, reveal-over, next-round
  scenes/BaiCaoView.ts      ghế, chia/nặn/lật bài, phỉnh cược, tính điểm và âm thanh
  scenes/Card.ts, deck.ts   vẽ lá bài (chép từ Tiến Lên)
  scenes/Mat.ts             mặt chiếu (chép từ Tiến Lên)
  scenes/Setup.ts           form tạo phòng
assets/                     hình (.webp) và âm thanh (.wav/.mp3), dùng theo tên file
```

Mặt chiếu, lá bài, chất và nút lấy từ Tiến Lên (`mat`, `face-classic`, `back-lattice`,
`back-lotus`, `suit-*`, `button`). Đảo `island.webp` là hình riêng của Bài Cào, tạo bằng công cụ
tạo ảnh của Codex; mô tả lưu trong `sources/prompts.json`. Phỉnh `chip-5`, `chip-10`, `chip-20`
và dấu `dealer` là hình vector gốc của dự án, xuất bằng
`node games/bai-cao/sources/render_tokens.mjs`.

Test: `npm run check`. Chơi thử một mình: http://localhost:5033/?play=bai-cao&players=4 (khi đang
chạy `npm run dev`).

## Vòng đời bàn chơi

Chia bài, lật bài và hiện điểm dùng runtime của SDK. Mỗi ván con huỷ các hiệu ứng của ván
trước. Khi kết nối lại hoặc đổi kích thước bàn, bài được dựng ngay từ trạng thái hiện tại;
hiệu ứng đang chờ không lật lại bài đã thay đổi.

## Hình và âm thanh

Ba mức cược hiện bằng phỉnh xanh (5), đỏ (10), vàng (20), luôn có số để phân biệt. Nhà cái có
dấu vàng “CÁI”; chủ phòng có vương miện. Bài úp dùng mặt lưới xanh của bộ bài tây thông thường,
viền trắng. Kết quả ván con hiện tên bài và điểm được/mất cạnh từng bộ bài, đồng thời phỉnh bay từ người thua sang người thắng.

Bàn có bố cục riêng cho 2–6 người trong khung ngang 960–1600 × 720: bạn ở dưới, tối đa ba ghế
ở trên và hai ghế hai bên. Ghế trên trải theo chiều rộng; ghế hai bên và nút thao tác bám gần
mép bàn. Ba lá của bạn rộng 116–128 đơn vị, bài đối thủ rộng 64–80 đơn vị tuỳ khung, tách nhau; nút “Lật bài” cao 88
đơn vị nằm dưới bên phải. Tên, điểm, trạng thái và bài của mỗi ghế có vùng riêng.

Bảng giữa bàn luôn hiện ván, **Cái: tên người chơi**, ba nhịp **Cược → Nặn bài → So bài**,
số người đã cược/lật và đồng hồ với thanh thời gian. Ghế nhà cái có vòng vàng, dấu “CÁI” và
nhãn “Nhà cái” (khi mở bài của đối thủ thì “Cái · số nút”). Khi bạn làm cái, lúc cược hiện
“Bạn làm cái”; bạn không đặt cược. Dấu cái chuyển theo vòng bàn ở ván sau. Điểm cược là điểm
trong trò chơi; mỗi người so bài với nhà cái.

Kéo lá của mình lên hoặc sang phải để hé từ số/chất ở mép trên, mép gập đi theo ngón tay.
Thả khi chưa hé quá nửa thì úp lại; kéo đủ hoặc chạm một lần thì mở riêng lá đó bằng animation
nặn. Bộ đếm “Đã nặn x/3” theo dõi các lá đã xem; thao tác này không gửi sự kiện công khai.
“Lật bài” công khai cả ba lá, kể cả lá chưa nặn. Chia từng lượt một lá vòng quanh bàn;
lật công khai, hiện điểm và chuyển phỉnh có animation riêng. Tuỳ chọn hệ thống giảm chuyển
động bỏ hiệu ứng bay/nghiêng nhưng giữ khả năng kéo hé bài.

Có âm thanh đặt cược, chia, nặn, lật bài, thắng/thua, Ba Tây và kết thúc trận. Ba giây
cuối có tiếng nhắc nếu mình còn phải cược hoặc lật. Âm thanh và nhạc tuân theo nút âm thanh của
ứng dụng; kết nối lại và đổi kích thước dựng bàn ngay, không phát lại hiệu ứng tính điểm.

Âm thanh chia/nặn/kết thúc và nhạc nền sao chép từ Tiến Lên; lật/thắng/Ba Tây/nhắc giờ sao chép
từ Mậu Binh, giữ nguyên nguồn và giấy phép trong [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).
Tiếng phỉnh và thua được tổng hợp riêng trong `sources/prepare_audio.py`. Tạo lại toàn bộ audio:
`python3 games/bai-cao/sources/prepare_audio.py`. Hiệu ứng là WAV mono PCM 16-bit 48 kHz; nhạc là
MP3 128 kbps. File chạy trực tiếp nằm trong `assets/`, không cần tạo lại lúc build.
