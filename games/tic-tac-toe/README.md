# Caro

Hai người chơi Caro trên bàn mở rộng, với bạn hoặc máy.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Luật và lượt | `src/game/CaroGame.ts` |
| Hàng thắng, hoà và bàn mở rộng | `src/game/board.ts` |
| Dữ liệu và tuỳ chọn | `src/game/model.ts` |
| Máy | `src/game/bot.ts` |
| Bàn và tạo phòng | `src/scenes/CaroView.ts`, `Setup.ts` |
| Màu quân | `src/scenes/theme.ts` |

`src/index.ts` đăng ký game phía server; `src/client.ts` đăng ký giao diện.
`assets/` chứa hình và âm thanh dùng trực tiếp, `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run dev` ở gốc repo rồi mở `http://localhost:5033/?play=tic-tac-toe&players=2`.
Kiểm tra bằng `npm run check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Hình tạo bằng Codex, prompt trong `sources/prompts.json`. Âm thanh dùng trực tiếp từ `assets/`;
bản gốc ở `assets/games/tic-tac-toe/` tại gốc repo.
