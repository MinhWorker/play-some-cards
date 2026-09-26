# Kế hoạch âm thanh Cờ Cá Ngựa

16 hiệu ứng được khai báo với `"game": "co-ca-ngua"` trong `assets/audio.json` và build vào
`games/co-ca-ngua/assets/` (`npm run audio`); bàn chơi phát chúng bằng `this.sfx(name)`. Phát âm thanh theo các thay đổi state đã được chấp
nhận, để nước đi bị từ chối hoặc được phát lại không tạo hiệu ứng trùng.

| Khoảnh khắc | Âm thanh | Khi nào phát |
| --- | --- | --- |
| Cuộc đua bắt đầu | `ludo-game-start` | Một lần khi state đầu tiên xuất hiện; bỏ qua khi kết nối lại. |
| Gieo xúc xắc | `ludo-dice-roll` | Một lần cho lượt gieo được chấp nhận của người đang chơi, kết thúc khi có kết quả. |
| Xúc xắc ra sáu | `ludo-dice-six` | Sau khi biết kết quả, chồng nhẹ ở cuối tiếng gieo. |
| Ngựa ra chuồng | `ludo-token-leave` | Một lần khi ngựa vào đường đua. |
| Chọn một con ngựa | `ludo-token-select` | Khi đổi lựa chọn trên máy mình. |
| Đi một ô | `ludo-token-step` | Cho mỗi bước đã xác nhận có hoạt ảnh; nhỏ tiếng hơn với nước đi dài. |
| Dừng ở ô an toàn | `ludo-token-safe` | Một lần khi ngựa kết thúc nước đi trên ô được bảo vệ. |
| Đá ngựa đối thủ | `ludo-token-bump` | Một lần khi nước đi đá một con ngựa đối thủ. |
| Về chuồng | `ludo-token-return` | Khi hoạt ảnh con ngựa bị đá quay về chuồng. |
| Về đích | `ludo-token-finish` | Một lần khi ngựa vào ô đích. |
| Hoạt ảnh nhảy | `ludo-pawn-jump` | Dùng thay `ludo-token-step` cho nước nhảy đặc biệt. |
| Vào vòng cuối | `ludo-final-lap` | Một lần khi người chơi lần đầu vào đường về đích. |
| Đổi lượt | `ludo-turn` | Khi tới lượt người chơi trên máy này, không phát lúc vào phòng. |
| Không có nước đi | `ludo-no-move` | Một lần khi kết quả xúc xắc khiến mọi con ngựa không đi được. |
| Cuộc đua hoà | `ludo-tie` | Một lần cho kết quả hoà do server quyết định. |
| Người chơi trên máy này thắng | `ludo-win` hoặc `game-win` dùng chung | Chọn một âm thanh kết quả để tiếng chiến thắng không chồng lên nhau. |
