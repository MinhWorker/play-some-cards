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
| Bàn chơi | `godot/main.gd` (bàn, ghế, hiệu ứng), `hand.gd` (bài trên tay), `card.gd` (lá bài, dựa trên `XomDaoCard` của SDK; chiếu là `XomDaoMat`), `rules.gd` (bộ và chặn, chép từ `cards.ts`); test: `godot/test/` |

`src/index.ts` đăng ký game phía server. `assets/` chứa hình và âm thanh cỡ đầy đủ (bàn chép bản
cần dùng vào `godot/`), `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo rồi mở
`http://localhost:5033/?play=tien-len` (ba máy, ba vòng, trên server thật).
Kiểm tra bằng `npm run check` và `npm run godot:check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Hình tạo bằng Codex (`sources/prompts.json`); vân chiếu tạo bằng `scripts/mat-texture.mjs`.
Âm thanh ở `assets/`, bản gốc ở `assets/games/tien-len/audio/`. Bàn giữ bản sao của hình và âm
thanh nó dùng trong `godot/art/` và `godot/sounds/`, vì gói của trò chỉ được đọc thư mục của nó.
Nguồn Pixabay và giấy phép ghi ở
[LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).
