# Kế hoạch âm thanh Tiến Lên

Bộ âm thanh dùng tiếng bài ngắn, có cảm giác chạm tay, và các âm có cao độ ấm áp hợp với một ván
bài vui. Không có giọng nói hay nhạc nền. Màn kết quả dùng lại `game-win` và `game-lose` chung của
ứng dụng.

| Khoảnh khắc | Âm thanh | Khi nào phát |
| --- | --- | --- |
| Bài được chia | `tien-len-deal` | Một lần khi tay bài vừa chia hiện ra lần đầu; bỏ qua khi kết nối lại. |
| Chọn hoặc bỏ chọn một lá | `tien-len-card-select` | Khi đổi lựa chọn trên máy mình. Để nhỏ tiếng nếu có thể chọn liên tục. |
| Đánh một lá lẻ | `tien-len-card-play` | Một lần sau khi server chấp nhận nước đánh một lá. Nước đánh nhiều lá dùng âm thanh bộ. |
| Bỏ lượt | `tien-len-pass` | Một lần sau khi server chấp nhận bỏ lượt. |
| Tới lượt người chơi trên máy này | `tien-len-turn` | Chỉ khi chuyển sang lượt người chơi trên máy này, không phát lúc vào phòng. |
| Có người còn một lá | `tien-len-last-card` | Một lần mỗi ván, lúc lần đầu có người còn một lá. |
| Đôi, ba hoặc sảnh thường | `tien-len-combo` | Thay cho âm thanh lá lẻ sau khi một bộ được chấp nhận. |
| Chặt hợp lệ | `tien-len-special-cut` | Thay cho âm thanh lá lẻ khi một nước đặc biệt chặt vòng hiện tại, theo biến thể luật được chọn. |
| Chặt bằng tứ quý | `tien-len-bomb` | Thay `tien-len-special-cut` khi đánh tứ quý. |
| Bài đặc biệt hiếm | `tien-len-special-hand` | Thay cho âm thanh lá lẻ cho tay bài mạnh nhất mà biến thể luật hỗ trợ. |
| Mọi người bỏ lượt, bắt đầu vòng mới | `tien-len-trick-clear` | Một lần khi quyền đánh quay về người dẫn vòng. |
| Người chơi trên máy này thắng | `tien-len-win` | Một lần khi kết quả do server quyết định chuyển thành thắng; các kết quả khác có thể dùng `game-lose` chung. |

Bộ hiện có 12 mã hiệu ứng, build vào `games/tien-len/assets/` (`npm run audio`). Bàn Tiến Lên có thể gọi `this.sfx(name)` sau các nước đi
được chấp nhận hoặc các thay đổi state do server quyết định.
