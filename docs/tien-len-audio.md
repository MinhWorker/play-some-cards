# Kế hoạch âm thanh Tiến Lên

Bộ âm thanh dùng tiếng bài ngắn, có cảm giác chạm tay, và các âm có cao độ ấm áp hợp với một ván
bài vui. Không có giọng nói. Bảng tổng kết có nhạc riêng (`tien-len-standings`) thay cho `game-win`
/ `game-lose` chung của ứng dụng (`showsResult` tắt chúng).

| Khoảnh khắc | Âm thanh | Khi nào phát |
| --- | --- | --- |
| Bài được chia | `tien-len-deal` | Một lần khi tay bài vừa chia hiện ra lần đầu; bỏ qua khi kết nối lại. |
| Chọn hoặc bỏ chọn một lá | `tien-len-card-select` | Khi đổi lựa chọn trên máy mình. Để nhỏ tiếng nếu có thể chọn liên tục. |
| Bài rời tay | `tien-len-throw` | Mỗi lần có người đánh, lúc bài bắt đầu bay về giữa bàn. |
| Đánh một lá lẻ | `tien-len-card-play` | Một lần sau khi server chấp nhận nước đánh một lá. Nước đánh nhiều lá dùng âm thanh bộ. |
| Bỏ lượt | `tien-len-pass` | Một lần sau khi server chấp nhận bỏ lượt. |
| Tới lượt người chơi trên máy này | `tien-len-turn` | Chỉ khi chuyển sang lượt người chơi trên máy này, không phát lúc vào phòng. |
| Có người còn một lá | `tien-len-last-card` | Một lần mỗi ván, lúc lần đầu có người còn một lá. |
| Đôi, ba hoặc sảnh thường | `tien-len-combo` | Thay cho âm thanh lá lẻ sau khi một bộ được chấp nhận. |
| Chặt hợp lệ | `tien-len-special-cut` | Thay cho âm thanh lá lẻ khi một nước đặc biệt chặt vòng hiện tại, theo biến thể luật được chọn. |
| Chặt bằng tứ quý | `tien-len-bomb` | Thay `tien-len-special-cut` khi đánh tứ quý. |
| Mọi người bỏ lượt, bắt đầu vòng mới | `tien-len-trick-clear` | Một lần khi quyền đánh quay về người dẫn vòng, cùng lúc bài của vòng cũ bị gạt vào chồng úp ở mép bàn (4 đợt, khớp 4 tiếng quẹt). |
| Người chơi trên máy này về nhất một vòng | `tien-len-win` | Cùng lúc chữ "Về nhất!" nhảy lên. |
| Sảnh dài (7 lá trở lên) | `tien-len-special-hand` | Thay cho âm thanh bộ, cùng chữ "Sảnh dài!" / "Sảnh rồng!". |
| Bảng tổng kết ván đấu | `tien-len-standings` | Một lần cho mọi người khi bảng "Tổng kết" hiện ra (hết vòng cuối, hoặc bàn còn dưới 2 người). |

Bộ hiện có 13 hiệu ứng trong `games/tien-len/assets/`, cộng nhạc tổng kết.
Tiếng chát của mỗi âm nằm ngay đầu file, và phát trong callback lúc lá bài chạm bàn (`land`),
nên đổi tốc độ bay vẫn khớp. `TienLenView` phát chúng trong `onStart` (chia bài), `onPlay` (theo bộ: lẻ, bộ, tứ quý/đôi thông,
chặt, còn một lá), `onPass`, và `onState` (hết vòng, tới lượt mình). Khi có ai về nhất, sảnh dài
hay bảng tổng kết, xem bảng trên.
