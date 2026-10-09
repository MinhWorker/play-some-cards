# ADR 0001: Client viết bằng Godot, luật giữ bằng TypeScript trên server

- Trạng thái: Đã chấp nhận (Phase 0)
- Ngày: 2026-10-09

## Bối cảnh

Client hiện tại là React + Vite cho giao diện và Phaser 4 cho thế giới và bàn chơi. Dự án đổi
hướng thành Xóm Đảo ([vision.md](../vision.md)): hub phải là một game, hình ảnh phải đẹp như game
thật, và nội dung mới (trò, sự kiện) được thêm liên tục.

Ràng buộc:

- Điện thoại trước, chạy trên trình duyệt.
- Chỉ có chủ dự án và agent làm việc. Agent làm gần như mọi thứ, nên công cụ phải điều khiển được
  bằng dòng lệnh và file chữ.
- Miễn phí, mã nguồn mở.

## Quyết định

1. **Client mới viết bằng Godot 4, ngôn ngữ GDScript**, xuất bản web. Godot là engine duy nhất
   cho hub và mọi trò.
2. **Luật chơi vẫn viết bằng TypeScript và chạy trên server** (`games/<id>/src/game`,
   `@xomdao/sdk`). Server vẫn quyết định mọi thứ; Godot chỉ hiển thị và gửi nước đi.
3. **Một dự án Godot** (`apps/client`). Mỗi trò xuất thành một gói `.pck` riêng, hub chỉ tải gói
   khi người chơi vào đảo.
4. **Godot nói chuyện với server qua WebSocket thuần + JSON.** Server mở cổng này song song với
   Socket.IO cho tới khi bỏ client Phaser.
5. **Protocol có một nguồn duy nhất**: schema zod trong `packages/shared`, sinh ra class GDScript.
6. **Bản xuất web đơn luồng (single-threaded)**, bật PWA.

## Vì sao

- **Godot**: miễn phí, nhẹ hơn Unity, có sẵn hạt, shader, animation, theme UI và editor. Scene
  (`.tscn`) và script (`.gd`) là file chữ nên agent đọc và sửa trực tiếp. Chạy headless được, nên
  agent và CI tự kiểm tra được.
- **GDScript, không C#**: Godot 4 chưa xuất bản web cho dự án C#.
- **Giữ luật TS**: luật của 13 trò đã có test, chạy trên server. Viết lại là tốn công không cần
  thiết; đổi engine chỉ thay phần hiển thị.
- **Một engine, nhiều gói**: engine web nặng khoảng 8–10 MB sau nén. Tải lại engine cho từng trò
  quá chậm trên điện thoại.
- **WebSocket thuần**: Godot có sẵn `WebSocketPeer`; Socket.IO cần addon bên thứ ba.
- **Đơn luồng**: không cần header COOP/COEP, ít lỗi hơn trên Safari iOS.

## Hệ quả

- Phải làm lại phần hiển thị của từng trò. Làm dần, không có hạn chót.
- Mất công cụ đang dựa vào DOM và Phaser: sandbox `?play=`, e2e, `npm run shots`. Phải làm lại:
  e2e điều khiển Godot qua cầu nối test `window.xomdao`; sandbox tạo phòng thật trên dev server có
  bot ngồi ghế trống.
- Người làm dự án cần Godot. Lệnh cài đặt tải đúng phiên bản vào `.tools/`.
- Rủi ro lớn nhất là tốc độ tải và Safari iOS. Phase 1 phải đo trên máy thật trước khi làm hub;
  nếu không đạt, xem lại quyết định này.

## Phương án đã cân nhắc

- **Giữ Phaser, chỉ làm art đẹp hơn**: rẻ nhất. Hình đẹp phần lớn đến từ art. Nhưng Phaser thiếu
  editor và công cụ dựng cảnh, nên agent phải viết tay mọi hiệu ứng.
- **Unity**: nặng hơn trên web, giấy phép phức tạp hơn, khó điều khiển bằng file chữ.
- **Mỗi trò một bản Godot riêng**: tách biệt tốt, nhưng mỗi lần vào đảo lại tải engine.
- **Viết lại luật bằng GDScript, chạy trên client**: mất tính "server quyết định", dễ gian lận.
