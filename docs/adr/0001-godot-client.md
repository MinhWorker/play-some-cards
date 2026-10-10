# ADR 0001: Client viết bằng Godot, luật giữ bằng TypeScript trên server

- Trạng thái: Đã chấp nhận (Phase 0), xác nhận sau khi đo ở Phase 1
- Ngày: 2026-10-09

> **Cập nhật 2026-10-10:** client Phaser (`apps/web`) và cổng Socket.IO đã bị xoá (#127). Client
> Godot là client duy nhất, phục vụ ở `/`; server chỉ còn WebSocket thuần + JSON ở `/ws`. Phần
> dưới đây giữ nguyên như lúc quyết định.

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

## Số đo (Phase 1, Caro tracer #113)

Đo bằng `npm run godot:measure` ngày 2026-10-10, Godot 4.7.2, bản web đơn luồng có PWA. Chromium
không giao diện giả lập điện thoại 800 × 360 @3, mạng "Fast 4G" (9 Mbit/s, 60 ms) và CPU chậm 4
lần; máy chủ tĩnh nén brotli như Vercel. Đây là số giả lập: số trên máy thật do chủ dự án đo.

Dung lượng (brotli, thứ trình duyệt thật sự tải):

| File | Gốc | Tải về |
| --- | --- | --- |
| `index.wasm` (engine) | 37,7 MB | 7,6 MB |
| `index.pck` (lõi: hub, SDK, bộ giao diện, font, icon, âm thanh) | 1,3 MB | 1,2 MB |
| `index.js`, `index.html` | 0,3 MB | 0,1 MB |
| `content/tic-tac-toe.<mã băm>.pck` (gói Caro) | 8 KB | 8 KB |

| Lần vào | Tải qua mạng | Engine chạy | Chơi được (đã kết nối, đăng nhập) | Bấm "Chơi với máy" tới lúc thấy bàn |
| --- | --- | --- | --- | --- |
| Lần đầu | 9,0 MB | 12,5 s | 14,5 s | 1,8 s |
| Lần sau (PWA cache) | 0 MB | 6,1 s | 7,5 s | 2,5 s |
| Lần đầu, không giới hạn mạng và CPU | 9,0 MB | 1,5 s | 1,9 s | 0,8 s |

Nhận xét:

- Phần lớn dung lượng là engine (7,6 MB), đúng như ước tính 8–10 MB. Một trò chỉ thêm vài KB
  khi chưa có art.
- Lần sau không tải gì: service worker của PWA giữ engine, gói trò nằm trong `user://`.
- Lần sau vẫn mất khoảng 6 s trên CPU chậm: phần lớn là biên dịch WebAssembly và khởi động
  engine, không phải mạng.
- "Engine chạy" và cột chơi được đo trên bản debug (có cầu nối test); bản release khởi động
  nhanh hơn một chút (12,5 s so với 13,6 s lần đầu).

Trên máy thật, chủ dự án đã cho hai máy Android Chrome và iPhone Safari chơi Caro với nhau qua bản
xem trước Vercel. Cả hai đều chạy được, thời gian chờ tải chấp nhận được.

**Kết luận (2026-10-10): đi tiếp với Godot.** Thời gian tải không phải trở ngại lớn.

## Phương án đã cân nhắc

- **Giữ Phaser, chỉ làm art đẹp hơn**: rẻ nhất. Hình đẹp phần lớn đến từ art. Nhưng Phaser thiếu
  editor và công cụ dựng cảnh, nên agent phải viết tay mọi hiệu ứng.
- **Unity**: nặng hơn trên web, giấy phép phức tạp hơn, khó điều khiển bằng file chữ.
- **Mỗi trò một bản Godot riêng**: tách biệt tốt, nhưng mỗi lần vào đảo lại tải engine.
- **Viết lại luật bằng GDScript, chạy trên client**: mất tính "server quyết định", dễ gian lận.
