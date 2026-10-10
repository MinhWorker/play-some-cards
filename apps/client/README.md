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
| `core/` | Autoload `Net`, `Session`, `Wallet`, `ContentLoader` |
| `hub/` | Sảnh và màn của từng khối nền tảng; `hub/main.tscn` là màn đầu tiên |
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

## Xuất bản

`npm run godot:export` tạo bản web đơn luồng có PWA trong `apps/client/dist/`, và mỗi trò một gói
`dist/content/<id>.<mã băm>.pck` kèm `manifest.json`. `npm run godot:smoke` mở bản đó trong
Chromium không giao diện và chụp `.shots/godot-800x360.png`.
