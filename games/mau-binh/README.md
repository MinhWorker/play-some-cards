# Mậu Binh

Mậu Binh cho 2–4 người: xếp 13 lá thành ba chi, so bài và cộng điểm qua nhiều vòng.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Bộ bài, so sức mạnh và binh lủng | `src/game/cards.ts` |
| Điểm và tới trắng | `src/game/scoring.ts` |
| Xếp bài tự động | `src/game/arrange.ts` |
| Chia, nộp, lật bài và đồng hồ | `src/game/MauBinhGame.ts` |
| Xếp hạng và tuỳ chọn | `src/game/match.ts`, `model.ts` |
| Bàn chơi | `godot/main.gd` (bàn, ghế, xếp bài, lật chi), `rules.gd` (bộ, binh lủng và Tự xếp, chép từ `cards.ts`, `scoring.ts`, `arrange.ts`); test: `godot/test/` |

`src/index.ts` đăng ký game phía server. `assets/` chứa hình và âm thanh cỡ đầy đủ (bàn chép bản
cần dùng vào `godot/`), `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo rồi mở
`http://localhost:5033/?play=mau-binh` (ba máy, ba vòng, trên server thật). Chạm hai lá để đổi
chỗ; lá bài và chiếu là `XomDaoCard`, `XomDaoMat` của SDK.
Kiểm tra bằng `npm run check` và `npm run godot:check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Hình tạo bằng Codex, prompt trong `sources/prompts.json`. Hình chất bài và nút dùng lại từ Tiến Lên.
Âm thanh trong `assets/mau-binh-*` là các bản sao đổi tên từ Tiến Lên, theo cùng nguồn và
[giấy phép](../../LICENSE-ASSETS.md). Bàn giữ bản sao âm thanh trong `godot/sounds/`.
