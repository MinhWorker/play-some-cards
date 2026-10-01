# Âm thanh Cờ tỷ phú Classic

Nhạc nền `music-tycoon.mp3` và các hiệu ứng dưới đây được tạo bằng
`games/co-ty-phu-classic/sources/make_audio.py`. Chạy lại script bằng Python và `ffmpeg` để
tạo đúng các tệp trong `games/co-ty-phu-classic/assets/`. Hiệu ứng là WAV mono 16 bit;
nhạc nền và tiếng thắng là MP3.

| Tệp | Khi phát |
| --- | --- |
| `tycoon-turn.wav` | Bắt đầu ván và tới lượt người xem |
| `tycoon-dice.wav` | Xúc xắc lăn |
| `tycoon-step.wav` | Bắt đầu mỗi cú nhảy sang ô kế tiếp |
| `tycoon-coin.wav` | Người chơi nhận tiền |
| `tycoon-rent.wav` | Người chơi trả tiền |
| `tycoon-buy.wav` | Mua hoặc chuộc đất |
| `tycoon-auction.wav` | Chốt đấu giá thành công |
| `tycoon-card.wav` | Rút thẻ Cơ hội hoặc Cộng đồng |
| `tycoon-build.wav` | Xây nhà hoặc khách sạn |
| `tycoon-jail.wav` | Bị đưa vào tù |
| `tycoon-bankrupt.wav` | Phá sản |
| `tycoon-win.mp3` | Nhạc kết thúc ván |

Người chơi có thể điều chỉnh âm lượng hiệu ứng và nhạc bằng cài đặt chung của ứng dụng.

## Bộ nghe thử mới

Bộ 12 hiệu ứng được dựng bằng
`games/co-ty-phu-classic/sources/make_audio_preview.py`. Chạy script bằng Python và ffmpeg để tạo lại
thư mục `sources/audio-preview/`; các âm thanh đã chọn cũng được dùng trong game.

Mở [trang nghe thử](../games/co-ty-phu-classic/sources/audio-preview/index.html) bằng trình
duyệt để nghe riêng từng tiếng. `00-all-effects.wav` phát cả bộ theo thứ tự, cách nhau
1,1 giây; `co-ty-phu-sfx-preview.zip` chứa đủ WAV và trang nghe thử để tải về.

12 tiếng gồm: đến lượt, tung xúc xắc, bước quân, nhận tiền, trả tiền, mua đất/giao dịch,
xây nhà, rút thẻ, chốt đấu giá, vào tù, phá sản và chiến thắng. Tiếng bước quân nhỏ hơn
các tiếng khác để nghe lặp lại dễ chịu hơn. Hiệu ứng là WAV mono 16 bit, 44.100 Hz.
Tiếng nhận tiền, mua đất và vào tù dùng các tệp Pixabay do người dùng cung cấp, chuyển
sang WAV và cân mức âm. Nhạc thắng lấy từ `games/tien-len/assets/tien-len-standings.mp3`.
Âm thanh giao dịch bắt đầu cùng hoạt ảnh chuyển tiền; mua hoặc chuộc đất chỉ phát tiếng mua,
không chồng thêm tiếng trả tiền.

Tiếng xúc xắc ở bộ nghe thử dùng các va chạm khô, ngắn, hạn chế cộng hưởng rỗng.
