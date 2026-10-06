# Tiến Lên

Tiến Lên miền Nam cho 2–4 người, chơi nhiều vòng và tính điểm theo hạng.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Lá bài, bộ và chặn | `src/game/cards.ts` |
| Lượt, chia bài, đồng hồ | `src/game/TienLenGame.ts` |
| Điểm và xếp hạng | `src/game/match.ts` |
| Dữ liệu và tuỳ chọn | `src/game/model.ts` |
| Máy | `src/game/bot.ts` |
| Điều phối bàn | `src/scenes/TienLenView.ts` |
| Chiếu và thẻ người chơi | `src/scenes/Mat.ts`, `Seat.ts`, `PlayerList.ts` |
| Lá bài và kiểu mặt bài | `src/scenes/Card.ts`, `deck.ts` |
| Kết quả và thông báo | `src/scenes/Standings.ts`, `Callout.ts` |
| Tạo phòng | `src/scenes/Setup.ts` |

`src/index.ts` đăng ký game phía server; `src/client.ts` đăng ký giao diện.
`assets/` chứa hình và âm thanh dùng trực tiếp, `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run dev` ở gốc repo rồi mở `http://localhost:5033/?play=tien-len&players=4`.
Kiểm tra bằng `npm run check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Hình tạo bằng Codex (`sources/prompts.json`); vân chiếu tạo bằng `scripts/mat-texture.mjs`.
Kiểu mặt bài khai báo trong `src/scenes/deck.ts`. Âm thanh dùng trực tiếp từ `assets/`;
bản gốc ở `assets/games/tien-len/audio/`. Nguồn Pixabay và giấy phép ghi ở
[LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).
