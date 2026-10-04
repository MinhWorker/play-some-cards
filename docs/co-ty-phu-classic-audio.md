# Âm thanh Cờ tỷ phú Classic

Nhạc nền `music-tycoon.mp3` và phần lớn các hiệu ứng dưới đây được tạo bằng
`games/co-ty-phu-classic/sources/make_audio.py`. Chạy lại script bằng Python và `ffmpeg` để
tạo đúng các tệp trong `games/co-ty-phu-classic/assets/`. Hiệu ứng là WAV mono 16 bit;
nhạc nền, tiếng thắng và hai tiếng thông báo sao chép nguyên bản là MP3.

| Tệp | Khi phát |
| --- | --- |
| `tycoon-turn.wav` | Bắt đầu ván và tới lượt người xem |
| `tycoon-dice.wav` | Xúc xắc lăn |
| `tycoon-step.wav` | Bắt đầu mỗi cú nhảy sang ô kế tiếp |
| `tycoon-plane.wav` | Máy bay bắt đầu bay ngang bàn từ Sân bay; dừng khi máy bay rời bàn hoặc hoạt ảnh bị hủy |
| `tycoon-coin.wav` | Người nhận tiền nghe tiếng tiền vào; tiền từ ngân hàng thì cả bàn cùng nghe |
| `tycoon-rent.wav` | Khi một người trả tiền, mọi người còn lại nghe tiếng tiền ra, kể cả khán giả |
| `tycoon-buy.wav` | Xây nhà hoặc khách sạn; cả bàn nghe tiếng mua |
| `tycoon-auction.wav` | Giữ trong bộ nghe thử |
| `tycoon-card.wav` | Bắt đầu trượt lá Cơ hội/Khí vận; dùng lại tiếng chọn lá trên tay `tien-len-card-select.wav` |
| `tycoon-card-flip.wav` | Lật lá trước khi công bố; dùng lại `tien-len-card-play.wav` |
| `tycoon-build.wav` | Giữ trong bộ nghe thử |
| `tycoon-jail.wav` | Bị đưa vào tù |
| `tycoon-trade-request.mp3` | Người nhận vừa được đề nghị trao đổi; sao chép nguyên tệp `freesound_gamestudio-material-buy-success-394517.mp3` do người dùng cung cấp |
| `tycoon-item-receive.mp3` | Nhận thẻ ra tù; sao chép nguyên tệp `freesound_community-item-pick-up-38258.mp3` do người dùng cung cấp |
| `tycoon-bankrupt.wav` | Phá sản |
| `tycoon-win.mp3` | Nhạc kết thúc ván |

Người chơi có thể điều chỉnh âm lượng hiệu ứng và nhạc bằng cài đặt chung của ứng dụng.

Tiếng máy bay được cắt từ `assets/audio/sfx/pixabay-plane.mp3` (Pixabay, do người dùng
cung cấp): đoạn từ 3,8 đến 7 giây, dài 3,2 giây, WAV mono 16 bit ở 44.100 Hz.
Đầu tiếng tăng dần trong 0,25 giây, cuối tiếng giảm dần trong 0,8 giây; âm lượng
bằng 60% bản gốc. Cả bàn nghe khi chuyến bay bắt đầu, theo cài đặt âm lượng hiệu ứng.
Ở tốc độ trình bày nhanh, tiếng dừng cùng máy bay và không kéo sang nhịp đến ô.

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
Âm thanh giao dịch bắt đầu cùng hoạt ảnh chuyển tiền. Người nhận nghe tiếng tiền vào;
người trả, những người khác và khán giả nghe tiếng tiền ra. Nếu ngân hàng trả tiền,
cả bàn nghe tiếng tiền vào. Quy tắc này áp dụng cả tiền thuê, thuế, mua/chuộc đất,
đấu giá và trao đổi; mỗi giao dịch chỉ phát một tiếng trên mỗi máy. Riêng xây nhà hoặc
khách sạn phát tiếng mua `tycoon-buy`, không chồng tiếng tiền ra.

Tiếng xúc xắc ở bộ nghe thử dùng các va chạm khô, ngắn, hạn chế cộng hưởng rỗng.

Âm thanh rút thẻ hiện tại được sao chép từ hai asset game Tiến Lên nêu trên, giữ nguyên
chất lượng và thời lượng. `make_audio.py` sao chép lại hai tiếng đã chọn khi dựng bộ âm thanh.
Hai tiếng rút/lật đi cùng flow rút thẻ, không phát lại khi
vào lại ván hoặc đổi người xem.

Tiếng vào tù đi cùng chuyển động của quân bị giam. Nếu người đó xác nhận và kết thúc lượt
trong khi màn hình người khác còn chạy xúc xắc, chuyển động vào tù vẫn được xếp hàng và
phát tiếng đúng một lần. Gieo không ra đôi khi đang ở tù không phát lại tiếng vào tù.

Hai tiếng thông báo chỉ phát lúc phát sinh: trao đổi chỉ người nhận nghe; nhận thẻ ra tù
phát sau nhịp công bố thẻ. Đổi ghế, cập nhật lặp, vào lại ván và resync không phát lại.
Nút trên máy tính sáng khi hover và phát tiếng `button-hover` mặc định của nền tảng;
chạm trên điện thoại không phát tiếng hover.
