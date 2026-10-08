# @psc/web

Ứng dụng web của game: React cho giao diện, Phaser 4 cho thế giới game, Vite để build.
Chạy từ thư mục gốc repo bằng `npm run dev` (web ở http://localhost:5033).

## Cài trên điện thoại

Mở trang web bằng trình duyệt trên điện thoại rồi chọn **Cài đặt ứng dụng** trên Android hoặc
**Thêm vào Màn hình chính** trong menu Chia sẻ trên iPhone. Ứng dụng mở toàn màn hình, xoay ngang
và dùng biểu tượng riêng. Trên Android thanh trạng thái và thanh điều hướng được ẩn; iPhone tự ẩn
thanh trạng thái khi xoay ngang. Giao diện tránh tai thỏ và thanh home. Màn hình không tự tắt khi
ứng dụng đang mở ở phía trước.

Máy đã cài bản cũ (chưa toàn màn hình) có thể phải gỡ ra cài lại: Android chỉ cập nhật cách mở
ứng dụng sau một thời gian, iPhone thì không tự cập nhật.

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
    ui/               Khối xây dựng nhỏ (Button, AvatarPicture: avatar chồng khung)
  hooks/              React hook: đăng nhập, kết nối phòng, âm thanh, trạng thái URL
  lib/                TypeScript thuần (không React): socket, đăng nhập, âm thanh, URL tài nguyên,
                      nhận ra bản web mới (newBuild.ts), giữ màn hình sáng (wakeLock.ts)
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
| Huy hiệu hồ sơ, bảng hồ sơ (chọn avatar, khung, xem lịch sử đấu), nút loa, mây chuyển cảnh, thông báo | `src/components/hud/` |
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

`PhaserStage` dùng `SceneDirector` của SDK để chuyển bàn chơi, bỏ kết quả tải cũ và tạo runtime mới khi mở phòng khác. Game có thể đặt `background: false` để tắt nền trời ở bàn/sandbox hoặc cung cấp `GameBackgroundScene` dưới key `<id>:background` để thay nền. Director tải scene nền trước bàn, dừng nền khi rời bàn và khôi phục trời chung ở setup/hub; ván mới/resync giữ nền đang chạy. Nếu tải client lỗi, màn hình có nút **Thử lại**. Mục **Runtime** trong DEV hiển thị epoch, lane, tài nguyên và âm thanh đang hoạt động, không chứa bài hoặc snapshot.

Âm thanh ngắn có handle riêng để dừng khi rời scene/đổi ván; buffer vẫn dùng chung. Âm thanh chưa unlock, đang tắt, tab ẩn hoặc bắt đầu muộn hơn 250 ms được bỏ qua. Nhạc nền vẫn theo Stage và thiết lập âm lượng hiện tại.

Thanh phòng chỉ giữ các góc: nút ← (về danh sách phòng) và 🏠 ở bên trái, danh sách người chơi
(👑 cạnh chủ phòng) khi bàn không tự vẽ danh sách đó, nút cài đặt ở góc phải. Không ghi tên game
hay "Phòng của …"; màn chờ ghi tên chủ phòng. Thanh của sandbox cũng không còn nhãn "Chơi thử",
chỉ hiện ai thắng khi ván kết thúc nếu game không có panel tổng kết riêng (`showsResult`).
Sandbox dùng cùng luật và timer của server. Mỗi sự kiện Phaser và timer lấy trạng thái
mới nhất ngay tại lúc xử lý, để giữ phím di chuyển trong game thời gian thực không ghi đè
nhịp mô phỏng hoặc đưa đồng hồ về trạng thái cũ.
Cờ Vây tự vẽ HUD người chơi và tổng kết; các nút "Chơi ván mới"/"Tuỳ chỉnh" của phòng
nằm giữa thanh trên, không có khung kết quả phụ hay che người chơi ở góc dưới phải.

## Dev Console

Trong phòng thật của server chạy `npm run dev` (`PSC_DEV=1`), bật **Dev Console** trong **DEV**.
`Ctrl+/` gõ lệnh, `` Ctrl+` `` hiện/ẩn, `Esc` thoát và `?` trong ô trống mở bảng phím tắt.
Toàn bộ lớp phủ có nền tối bán trong suốt để đọc rõ trên cảnh sáng; `.opacity` chỉnh độ đậm.
Mọi chuột/chạm đi xuống game; không đổi kích thước khung chơi.
Chi tiết cú pháp, ghim và log: [hướng dẫn tạo game](../../docs/making-a-game.md#dùng-dev-console).

Mã ở `components/hud/DevConsole/`; store, socket và lệnh nằm trong `lib/devConsole.ts`, phím
vật lý ở `lib/devConsoleKeys.ts`. Công tắc tắt thì thôi theo dõi log; ẩn bằng phím vẫn giữ log.
`DevConsoleLoader` tải lớp phủ khi bật và cung cấp `window.__devCommand` / `__devRoomLogs`
cho e2e ở bản dev. Màn hình chỉ dùng bàn phím, còn chi tiết object/stack xem trong DevTools.

Ảnh phòng thật có thể dùng trạng thái đăng nhập đã lưu bằng Playwright:

```sh
npm run shots -- --state .dev/room-state.json --command 'help' --devices laptop,iphone-15
```

File trạng thái chứa thông tin đăng nhập local, để trong `.dev/` (Git bỏ qua). `--crop` chọn
vùng chi tiết 1:1 từ cùng khung hình với ảnh toàn màn hình. `npm run e2e` cần server bật dev; kịch bản lỗi lưu `.e2e/<scenario>/room.log`.
