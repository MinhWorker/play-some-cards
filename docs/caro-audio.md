# Kế hoạch âm thanh Caro

Màn Caro dùng một âm thanh gỗ-và-thuỷ-tinh riêng cho mỗi thao tác. Âm thanh nằm trong
`games/tic-tac-toe/assets/` và bàn chơi phát chúng bằng `this.sfx(name)`; `npm run audio` build lại
chúng từ bản gốc khai báo trong `assets/audio.json`.

| Khoảnh khắc | Âm thanh | Khi nào phát |
| --- | --- | --- |
| Bàn trống hiện ra cho ván mới | `caro-start` | Một lần khi bàn trống được vẽ lần đầu. |
| Người chơi chọn một ô | `caro-select` | Khi đổi ô đang chọn, nếu màn có bước chọn trước khi gửi nước đi. |
| X được chấp nhận | `mark-drop` | Khi bàn cờ do server quyết định có thêm một X. |
| O được chấp nhận | `caro-o-place` | Khi bàn cờ do server quyết định có thêm một O. |
| Hàng thắng xuất hiện | `caro-line-complete` | Một lần khi chuyển từ chưa có hàng sang có hàng. |
| Ván kết thúc có người thắng | `game-win` / `game-lose` dùng chung | Dùng hook kết quả sẵn có; tránh chồng lên `caro-win`. |
| Ván hoà | `caro-draw` | Một lần khi bàn đầy mà không có hàng thắng. |
| Nước đi bị từ chối | `caro-invalid` | Một lần, nếu màn có phản hồi cho nước đi bị từ chối. |

Màn hiện dùng `caro-start`, `mark-drop`, `caro-o-place`, `caro-line-complete` và `caro-draw`.
`caro-select` và `caro-invalid` để sẵn nếu sau này cách chơi cần tới.
