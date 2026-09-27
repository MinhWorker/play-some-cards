# @psc/web

Ứng dụng web của game: React cho giao diện, Phaser 4 cho thế giới game, Vite để build.
Chạy từ thư mục gốc repo bằng `npm run dev` (web ở http://localhost:5033).

Màn hình có hai lớp. Phaser vẽ thế giới trên một canvas toàn màn hình: bầu trời, bản đồ đảo và bàn
chơi. React vẽ giao diện đè lên trên: bảng, nút và form. `src/phaser/bridge.ts` là cầu nối duy nhất
giữa hai bên.

## Thư mục

```
src/
  main.tsx            Điểm vào: style chung, rồi <App />
  App.tsx             Chọn trang và bảo Phaser vẽ gì
  pages/              Mỗi màn hình một thư mục (component + CSS + component con)
    Home/             Bản đồ đảo (bản thân các đảo do Phaser vẽ)
    GameRooms/        Danh sách phòng đang mở của một game
    RoomSetup/        Nút quay lại + tạo phòng trong lúc màn cài đặt của game chạy
    Room/             Trong phòng: thanh phòng, bảng "đang chờ", bảng kết quả
  components/
    hud/              Giao diện có ở mọi màn hình: huy hiệu hồ sơ, nút âm thanh,
                      hiệu ứng mây chuyển cảnh, thông báo, nhãn phiên bản, hộp báo
                      phiên bản mới, công cụ dev.
                      Import từ '@/components/hud'
    ui/               Khối xây dựng nhỏ (Button)
  hooks/              React hook: đăng nhập, kết nối phòng, âm thanh, trạng thái URL
  lib/                TypeScript thuần (không React): socket, đăng nhập, âm thanh, URL tài nguyên,
                      nhận ra bản web mới (newBuild.ts)
  styles/             theme.css (màu, font) và base.css (bảng, nút, hộp thoại)
  phaser/             Phía Phaser: stage, bridge, scenes/ (boot, sky, hub), objects/
  games/index.ts      Tìm mọi game trong thư mục games/ của repo (tài nguyên, code bàn chơi)
public/
  shared/             Hình và âm thanh dùng khắp ứng dụng
  audio/              Âm thanh chưa sắp xếp (thử nghiệm)
```

Import ra ngoài thư mục hiện tại dùng `@/`, nghĩa là `src/`: `import { request } from '@/lib/socket'`.

## Tìm … ở đâu

| Mình muốn đổi… | Xem ở |
| --- | --- |
| Bố cục hoặc chữ của một màn hình | `src/pages/<Page>/` |
| Huy hiệu hồ sơ, nút loa, mây chuyển cảnh, thông báo | `src/components/hud/` |
| Màu, font, kiểu nút và bảng | `src/styles/` |
| Bàn chơi trông ra sao hay phản ứng khi bấm | `games/<id>/src/scenes/` (ở gốc repo) |
| Bản đồ đảo hoặc bầu trời | `src/phaser/scenes/HubScene.ts`, `SkyScene.ts` |
| Nói chuyện với server | `src/lib/socket.ts`, `src/hooks/useRoom.ts` |
| Đăng nhập và tài khoản | `src/pages/Login/`, `src/lib/auth.ts`, `src/hooks/useAccount.ts` |
| Nhạc và hiệu ứng âm thanh | `src/lib/sound.ts` + file trong `public/shared/audio/` (sửa thẳng file) |
| Hình của ứng dụng | `assets/prompts.json` (tạo bằng AI) + `src/phaser/assets.ts` |
| Luật game | `games/<id>/src/game/<Tên>Game.ts` (ở gốc repo) |
| Công cụ dev (công tắc, ô nhập; không có trên bản thật) | `src/lib/devTools.ts` (`DEV_SETTINGS`), bảng ở `src/components/hud/DevTools.tsx` |

Xem `AGENTS.md` (gốc repo và `apps/web/AGENTS.md`) cho các quy ước và `docs/making-a-game.md` để làm game.
