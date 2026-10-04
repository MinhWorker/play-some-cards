# Cờ Tướng

Cờ Tướng cho hai người, chơi với bạn hoặc máy.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Nước đi, chiếu và nước hợp lệ | `src/game/rules.ts` |
| Lặp thế cờ, chiếu dai và đuổi dai | `src/game/referee.ts` |
| Lượt, xin hoà, đầu hàng và kết thúc | `src/game/XiangqiGame.ts` |
| Máy và tuỳ chọn | `src/game/bot.ts`, `model.ts` |
| Điều phối bàn | `src/scenes/XiangqiView.ts` |
| Vỡ quân và thông báo chiếu | `src/scenes/shatter.ts`, `cutin.ts` |
| Kết quả, tạo phòng và màu | `src/scenes/ResultPanel.ts`, `Setup.ts`, `theme.ts` |

`src/index.ts` đăng ký game phía server; `src/client.ts` đăng ký giao diện.
`assets/` chứa hình và âm thanh dùng trực tiếp, `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run dev` ở gốc repo rồi mở `http://localhost:5033/?play=xiangqi&players=2`.
Kiểm tra bằng `npm run check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Hình bàn sinh từ prompt trong `sources/prompts.json`; đường bàn vẽ theo `src/scenes/theme.ts`.
Quân cờ, bóng và chữ trên sông kết xuất bằng Blender. Nút dùng lại từ Tiến Lên.
Tiếng di chuyển, vỡ quân và nhạc thắng tổng hợp bằng code.
Âm thanh dùng trực tiếp từ `assets/`.
