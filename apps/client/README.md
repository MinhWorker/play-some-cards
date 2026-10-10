# Client Godot

Client mới của Xóm Đảo: một dự án Godot 4 duy nhất, viết bằng GDScript có kiểu, xuất bản web
([ADR 0001](../../docs/adr/0001-godot-client.md)). Luật chơi vẫn chạy trên server; client chỉ hiển
thị và gửi nước đi. Client Phaser cũ (`apps/web`) chạy tiếp tới khi không còn dùng.

## Cài đặt

```sh
npm install
npm run setup:godot    # Godot, template web, gdtoolkit và GUT vào .tools/ (Linux, macOS)
npm run godot:check    # kiểm tra: định dạng, lint, ranh giới, script, test
npm run godot -- --editor   # mở dự án trong editor
```

Phiên bản Godot được ghim trong `tools/godot/version.json`. Chỉ mở dự án bằng `npm run godot`:
Godot bản khác sẽ ghi lại `project.godot` và các scene.

## Thư mục

| Đường dẫn | Có gì |
| --- | --- |
| `project.godot` | Khung gốc 960 × 720, `canvas_items` + `expand`, màn hình ngang ([ui-guide.md](../../docs/ui-guide.md)) |
| `core/` | Autoload `Net` (kết nối), `Session` (token đăng nhập), `Wallet`, `ContentLoader` (tải gói trò), `TestBridge` (cầu nối test, chỉ bản debug) |
| `hub/` | Sảnh và màn của từng khối nền tảng; `hub/main.tscn` là màn đầu tiên, hiện là màn tạm của Caro |
| `addons/xomdao_sdk/` | API duy nhất phần Godot của trò được dùng: `XomDaoFrame`, `XomDaoClient` (kết nối server) |
| `addons/xomdao_sdk/ui/` | Bộ thành phần giao diện chung: theme, nút, bảng, hàng tiền, ô người chơi, thẻ trò, ô lựa chọn, thông báo nhanh, menu ☰, font, icon, âm thanh |
| `hub/gallery/` | Màn gallery liệt kê mọi thành phần: mở bằng `?gallery=<trang>` (trang 1 tới 4) |
| `addons/xomdao_sdk/generated/` | Class protocol sinh từ schema zod bằng `npm run gen:protocol`; không sửa tay |
| `content/<id>` | Symlink tới `games/<id>/godot` (`npm run godot:link` tạo, git bỏ qua) |
| `test/` | Test GUT của lõi |

Phần Godot của một trò nằm ở `games/<id>/godot/` và chỉ được dùng file trong thư mục đó cùng
`addons/xomdao_sdk`. Script phải khai kiểu đầy đủ; thiếu kiểu là lỗi.

## Giao diện chung

Mọi màn và mọi trò dựng giao diện từ bộ thành phần trong `addons/xomdao_sdk/ui/`, làm theo
[hướng nghệ thuật](../../docs/art-direction.md): nút có màu theo loại hành động, bảng gỗ ruột giấy,
hàng tiền, ô người chơi (ảnh tròn trong vòng tre, cấp, vòng thời gian, 👑), thẻ trò, ô lựa chọn,
thông báo nhanh, chấm đỏ và nút menu ☰ với bảng menu chung (rời phòng, âm thanh, cỡ giao diện, lề,
chất lượng hình, luật, biểu cảm). Font Baloo 2 và Be Vietnam Pro, icon Phosphor (Fill), âm thanh
chạm, mở bảng và xu đều nằm trong đó. Chất lượng hình mới được lưu lại, chưa đổi cách vẽ.

Xem mọi thành phần ở màn gallery: `?gallery=1` tới `?gallery=4` trên bản web, hoặc
`npm run godot -- -- --gallery=2`.

## Kết nối server

`XomDaoClient` nói chuyện với server qua WebSocket thuần + JSON ở `/ws` (cùng cổng với
Socket.IO): đăng nhập khách hoặc tài khoản, tạo phòng, vào phòng bằng mã, gửi nước đi, nhận
`state_changed`. Mất kết nối thì tự nối lại và quay về phòng. Đầu file `client.gd` ghi cách dùng.

Protocol chỉ viết một lần, bằng schema zod trong `packages/shared/src/protocol.ts`. Sửa schema
xong thì chạy `npm run gen:protocol` để sinh lại GDScript; `npm run check` báo lỗi nếu quên.
`npm run godot:net` chạy server thật (không DB) rồi chạy test GUT kết nối với nó.

## Sảnh và các màn

Màn đầu tiên là sảnh: vòng đảo thể loại trên biển (Cờ, Bài, rồi thể loại phụ; đảo Sắp có khi chưa
có thể loại phụ). Vuốt ngang hoặc chạm một đảo để xoay; chạm lại đảo đang chọn hoặc thẻ trò ở dưới
phải để mở màn chọn trò. HUD: hồ sơ trên trái, số xu và ⚙ trên phải, banner Chợ, hàng Nhà, Chợ,
Đình, Bến dưới trái (Nhà, Chợ, Đình còn "Sắp có"), thẻ trò đang chọn với **CHƠI** và **Tạo phòng**.

- **CHƠI** là ghép nhanh: vào phòng đang chờ của trò đó, không ai tới thì sau vài giây máy ngồi ghế
  trống và ván bắt đầu.
- **Tạo phòng** mở bảng tuỳ chọn do trò điền (`room_setup()`), rồi tới phòng chờ có mã, người
  chơi, "Mời bạn" (sao chép link `?room=<mã>`) và "Bắt đầu" cho chủ phòng.
- **Chọn trò**: tab thể loại, thẻ trò kéo ngang, bảng chi tiết với Chọn, Luật, Tạo phòng, Danh
  sách phòng. Chọn thẻ là gói `.pck` của trò bắt đầu tải ngầm. Trò chưa có bản Godot hiện mờ, có
  ổ khoá.
- **Bến**: gõ mã phòng rồi "Vào", hoặc chọn một phòng đang mở của trò đang chọn.
- **Trong ván** chỉ có nút ☰ (rời phòng có hỏi lại khi đang giữa ván, luật, cài đặt, biểu cảm).
- **Kết quả**: thứ hạng, phần thưởng từng người (tăng xanh, giảm đỏ), xu bay vào số dư; "Chơi
  tiếp" và "Về sảnh".

Trò đang chọn được nhớ theo tài khoản trên máy này. Lần đầu vào trò, client tải gói `.pck` của
trò đó (`ContentLoader`) và giữ nó trong `user://` cho lần sau.

Link:

- `?room=<mã>` vào thẳng phòng đó.
- `?play=<id>` (chỉ bản debug) là sandbox: tạo phòng thật trên server với máy ở ghế trống rồi bắt
  đầu luôn. Trò chọn tuỳ chọn phòng cho sandbox bằng hàm `sandbox_options()` trong scene chính.

## Chạy trên trình duyệt

`npm run dev` phục vụ bản xuất ở `http://localhost:5033/godot/` và chuyển `/ws` tới server, nên
sau `npm run godot:export -- --debug` chỉ cần mở trang đó. Xuất lại là thấy bản mới.

Bản debug có cầu nối test `window.xomdao` cho e2e và `npm run shots`: `scene()`, `tree()`,
`text(tên)`, `rect(tên)`, `click(tên)`, `state()` (xem đầu `core/test_bridge.gd`). Node nào test
cần bấm hay đọc đều có tên, ví dụ ô Caro là `Cell_<x>_<y>`.

- `npm run e2e -- --only godot-lobby`: từ sảnh bấm CHƠI, thắng máy, số dư tăng; bạn vào bằng link.
- `npm run e2e -- --only godot-caro`: hai người chơi Caro qua mã phòng ở Bến, thêm một ván sandbox.
- `npm run shots -- --path '/godot/?play=tic-tac-toe'`: ảnh chụp trên các cỡ điện thoại.

## Xuất bản

`npm run godot:export` tạo bản web đơn luồng có PWA trong `apps/client/dist/`, và mỗi trò một gói
`dist/content/<id>.<mã băm>.pck` kèm `manifest.json`. `npm run godot:smoke` mở bản đó trong
Chromium không giao diện và chụp `.shots/godot-800x360.png`. `XOMDAO_SERVER_URL` (hoặc
`VITE_SERVER_URL`) lúc xuất ghi địa chỉ server vào trang; không có thì client dùng chính địa chỉ
của trang.

`npm run godot:measure` đo dung lượng tải và thời gian tới lúc chơi được trên một cấu hình điện
thoại giả lập (mạng 4G, CPU chậm 4 lần), lần đầu và lần sau. Kết quả ghi trong
[ADR 0001](../../docs/adr/0001-godot-client.md).

Vercel dựng client cùng ứng dụng web (`tools/godot/vercel.mjs`) và phục vụ nó ở `/godot/`: bản
thật dùng bản release, bản xem trước của PR dùng bản debug (có cầu nối test và sandbox).
