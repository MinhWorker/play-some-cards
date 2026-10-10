# Bài Cào

Bài Cào (ba cây) cho 2–6 người, chơi với bạn bè hoặc thêm tối đa 5 người chơi máy.
Game ở trạng thái `ready`.

Luật hiện tại: [Luật Bài Cào](RULES.md).

## Tạo phòng

Bảng Tạo phòng có **Chơi với máy** (không, hoặc 1–5 máy) và **Số ván** (5, 10, 20). Máy cược
ngẫu nhiên (thường là 10) và lật bài ngay.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  game/cards.ts             lá bài, tính nút, Ba Tây, so bài
  game/model.ts             dữ liệu: State, View (giấu bài chưa lật), tuỳ chọn phòng, thời gian
  game/BaiCaoGame.ts        các sự kiện: bet, reveal; hẹn giờ: bet-over, reveal-over, next-round
godot/
  main.tscn, main.gd        bàn: ghế, chia/nặn/lật bài, phỉnh cược, tính điểm và âm thanh
  rules.gd                  tính nút và Ba Tây (chép từ cards.ts)
  art/, sounds/, music/     hình, âm thanh và nhạc bàn dùng
  test/                     test GUT
assets/                     hình (.webp) và âm thanh (.wav/.mp3) cỡ đầy đủ
```

Mặt chiếu, lá bài, chất và nút lấy từ Tiến Lên (`mat`, `face-classic`, `back-lattice`,
`back-lotus`, `suit-*`, `button`). Đảo `island.webp` là hình riêng của Bài Cào, tạo bằng công cụ
tạo ảnh của Codex; mô tả lưu trong `sources/prompts.json`. Phỉnh `chip-5`, `chip-10`, `chip-20`
và dấu `dealer` là hình vector gốc của dự án, xuất bằng
`node games/bai-cao/sources/render_tokens.mjs`. Lá bài và chiếu trên bàn là `XomDaoCard` và
`XomDaoMat` của SDK, dùng chung với Tiến Lên.

Chạy: `npm run godot:export -- --debug` và `npm run dev`, rồi mở
`http://localhost:5033/?play=bai-cao` (ba máy, năm ván, trên server thật). Kiểm tra bằng
`npm run check` và `npm run godot:check`.

## Bàn chơi

Bố cục **Bàn** ([experience.md](../../docs/experience.md)): chiếu cói, bạn ở dưới với ba lá ở
giữa, các ghế khác quanh bàn với bài của họ; ván, nhà cái và nhịp **Cược → Nặn bài → So bài** ở
trên; nút Cược 5 / 10 / 20 và Lật bài ở dưới bên phải.

Ba mức cược hiện bằng phỉnh xanh (5), đỏ (10), vàng (20), luôn có số để phân biệt. Nhà cái có
dấu vàng “CÁI”; chủ phòng có vương miện. Điểm cược là điểm trong trò chơi; mỗi người so bài với
nhà cái, và dấu cái chuyển theo vòng bàn ở ván sau.

Bài của bạn được chia úp. Chạm một lá để mở, hoặc kéo lên (hay sang phải) để nặn: mặt lưng trượt
đi và mặt bài hiện dần; thả sớm thì úp lại. Thao tác này không gửi sự kiện công khai. “Lật bài”
công khai cả ba lá cho mọi người. Khi so bài, tên bộ và điểm được/mất hiện ở từng ghế, phỉnh bay
giữa nhà cái và người chơi.

## Hình và âm thanh

Có âm thanh đặt cược, chia, nặn, lật bài, thắng/thua, Ba Tây và kết thúc trận. Ba giây
cuối có tiếng nhắc nếu mình còn phải cược hoặc lật.

Âm thanh chia/nặn/kết thúc và nhạc nền sao chép từ Tiến Lên; lật/thắng/Ba Tây/nhắc giờ sao chép
từ Mậu Binh, giữ nguyên nguồn và giấy phép trong [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).
Tiếng phỉnh và thua được tổng hợp riêng trong `sources/prepare_audio.py`. Tạo lại toàn bộ audio:
`python3 games/bai-cao/sources/prepare_audio.py`. Hiệu ứng là WAV mono PCM 16-bit 48 kHz; nhạc là
MP3 128 kbps. File nằm trong `assets/`; bàn dùng bản sao trong `godot/sounds/` và `godot/music/`.
