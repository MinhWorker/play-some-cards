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
| `addons/xomdao_sdk/` | API duy nhất phần Godot của trò được dùng |
| `content/<id>` | Symlink tới `games/<id>/godot` (`npm run godot:link` tạo, git bỏ qua) |
| `test/` | Test GUT của lõi |

Phần Godot của một trò nằm ở `games/<id>/godot/` và chỉ được dùng file trong thư mục đó cùng
`addons/xomdao_sdk`. Script phải khai kiểu đầy đủ; thiếu kiểu là lỗi.

## Xuất bản

`npm run godot:export` tạo bản web đơn luồng có PWA trong `apps/client/dist/`, và mỗi trò một gói
`dist/content/<id>.<mã băm>.pck` kèm `manifest.json`. `npm run godot:smoke` mở bản đó trong
Chromium không giao diện và chụp `.shots/godot-800x360.png`.
