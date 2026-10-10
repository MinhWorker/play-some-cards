# Trung Thu: câu cá

Sự kiện mẫu (`kind: 'event'`): một người thả câu 5 lượt dưới trăng rằm, gom điểm sự kiện và nhận
quà theo mốc. Nó cho thấy cách một sự kiện khai báo ngày mở và đóng, mốc thưởng, màu bảng chi tiết,
và cho điểm.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Meta: ngày, mốc thưởng, màu, `rewardCap` | `src/index.ts` |
| Thứ câu được, điểm, số lượt | `src/game/model.ts` |
| Lượt câu, cộng điểm sự kiện (`EVENT_POINTS`) | `src/game/FishingGame.ts` (+ test) |
| Màn chơi trong client Godot | `godot/main.gd`; test: `godot/test/` |

## Thử

Ngày của sự kiện là Trung Thu 2026, nên bình thường nó không hiện. Để thử, dời đồng hồ sự kiện của
server vào trong khoảng đó:

- chạy `XOMDAO_NOW=2026-09-25T20:00:00+07:00 npm run dev`, hoặc
- ở chế độ dev, gửi `dev:clock { at: '2026-09-25T20:00:00+07:00' }` (`at: null` trả về giờ thật).

Rồi mở `http://localhost:5033/` (sau `npm run godot:export -- --debug`): đảo Sự kiện sáng lên,
banner cột phải là sự kiện. Kịch bản e2e: `scripts/e2e/scenarios/godot-event.mjs`.

Muốn dùng làm sự kiện thật, đổi `opensAt` và `closesAt` trong `src/index.ts`.

## Hình và âm thanh

Chưa có hình riêng: ao, trăng, đèn lồng và cá đều vẽ bằng code. `assets/island.webp` là hình mẫu
của bộ khởi tạo.
