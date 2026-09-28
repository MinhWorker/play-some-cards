# Kế hoạch âm thanh Cờ Tướng

Bộ âm thanh Cờ Tướng dùng tiếng quân gỗ khô với điểm nhấn chuông tiết chế. Không có giọng nói hay
âm thanh nền của bàn cờ.

| Khoảnh khắc | Âm thanh | Khi nào phát |
| --- | --- | --- |
| Bàn cờ và người chơi sẵn sàng | `xiangqi-start` | Một lần khi ván mới hiện ra lần đầu; bỏ qua khi kết nối lại. |
| Chọn một quân | `xiangqi-piece-select` | Khi đổi lựa chọn trên máy mình. |
| Đi một nước thường | `xiangqi-move` | Lúc quân nện xuống bàn sau nước đi không ăn quân (âm tổng hợp bằng code). |
| Ăn quân | `xiangqi-capture` | Thay `xiangqi-move` sau khi server chấp nhận nước ăn quân. |
| Ăn quân quan trọng | `xiangqi-capture-heavy` | Thay `xiangqi-capture` cho nước ăn đặc biệt quan trọng. |
| Quân bị ăn vỡ | `xiangqi-shatter` | Lúc quân bị ăn vỡ thành mảnh, ngay sau tiếng ăn quân (âm tổng hợp bằng code). |
| Chiếu tướng đối phương | `xiangqi-check` | Một lần khi state chuyển sang bị chiếu. |
| Tới lượt người chơi trên máy này | `xiangqi-turn` | Khi chuyển sang lượt người chơi trên máy này, không phát lúc vào phòng hay kết nối lại. |
| Server từ chối nước đi | `xiangqi-illegal` | Một lần khi nước đi bị từ chối, nếu giao diện có phản hồi đó. |
| Nước đi quyết định thắng | `xiangqi-decisive-move` | Một lần sau khi nước cuối được chấp nhận. |
| Chiếu bí | `xiangqi-checkmate` | Một lần khi ván chuyển sang kết quả chiếu bí. |
| Hoà | `xiangqi-draw` | Một lần khi kết quả do server quyết định là hoà. |
| Người chơi trên máy này thắng | `xiangqi-game-win` hoặc `game-win` dùng chung | Chọn một âm thanh kết quả để tiếng chiến thắng không chồng lên nhau. |

Bộ hiện có 13 hiệu ứng trong `games/xiangqi/assets/`. Bàn Cờ Tướng (`scenes/XiangqiView.ts`)
đã phát các âm thanh bắt đầu, chọn quân, đi quân, ăn quân (`xiangqi-capture-heavy` khi ăn Xe), quân vỡ (chỉ khi bật hiệu ứng),
chiếu, tới lượt, chiếu bí, hoà và thắng; `xiangqi-illegal` khi chạm vào điểm quân đang chọn không
đi tới được. Bàn tự hiện kết quả nên app không phát thêm `game-win` dùng chung. Chưa dùng
`xiangqi-decisive-move`.
