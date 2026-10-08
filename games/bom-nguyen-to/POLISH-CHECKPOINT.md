# Checkpoint đồ họa hoạt hình

## Đã lưu

- Đấu trường top-down nghiêng nhẹ theo trục Y; hàng ngang/dọc không xoay chéo.
  Mọi hàng có cùng chiều rộng. Viền chữ nhật liên tục làm rõ hai mép ngang bằng nhau.
- HUD gọn ở cạnh trái và phía trên; ba nút hành động xếp dọc cạnh phải.
  Bàn tận dụng chiều cao còn lại; nút điều khiển nằm ngoài tâm các ô đi được.
- Nền cỏ phẳng; cột đá xanh, thùng quà và tường viền có mặt trước và bóng chân.
- Năm linh thú nguyên tố, atlas bốn hướng cho nghỉ/đi/đặt bom/kỹ năng/trúng đòn/
  đóng băng/bị loại/xuất hiện; bom, vật phẩm và hiệu ứng có chuỗi khung hình thật.
- Khung giấy, nút và bóng môi trường được raster hóa và tái sử dụng; texture được
  dọn khi scene đóng. Âm thanh hành động và kết quả được tổng hợp riêng.
- Luật chơi, timer server, bots và các kỹ năng giữ nguyên.

## Bằng chứng hiện có

- Biome và typecheck riêng game đã đạt trước chỉnh sửa cuối của viền/nút.
- 20 unit tests của game đã đạt trong lượt polish.
- Đã xem hình desktop 1672×941, điện thoại 844×390, tablet 1024×768 và màn tuỳ chỉnh.
- Kịch bản browser trước đó đã qua camera, cảm ứng, cảnh báo Thủy, luật và 2v2;
  lần chạy bị ngắt bởi Vite reload khi đang tạo tài khoản, nên chưa tính là đạt toàn bộ.
- Chẩn đoán Chromium dùng SwiftShader: cập nhật trạng thái khoảng 0,3–1,3 ms,
  không có layout lặp hay upload texture liên tục. Render ở mật độ desktop chỉ khoảng
  1–2 FPS trong môi trường này; chưa chứng minh hiệu năng trên GPU phần cứng.
- CI đầy đủ của bản gameplay trước polish (`c1b2b11`) đã đạt; không áp dụng kết quả
  đó cho các thay đổi đồ họa mới.

## Cần hoàn tất để nghiệm thu polish

- Chạy xong `npm run check`, production build và CI tại commit mới.
- Chạy lại toàn bộ kịch bản `bom-nguyen-to`, gồm phòng thật và vòng đời atlas.
- Kiểm tra lại viền bằng nhau, nút hành động và các khung Lôi vừa sửa.
- Xem crop ở DPR 2/3 và kiểm tra gameplay trên renderer có tốc độ đủ để đo hoạt ảnh.
- Đối chiếu hình cuối với concept: màu pastel, bàn gỗ, nền phẳng, khối nổi,
  linh thú, HUD và nút; ghi rõ sai khác còn lại trong PR.

Mã nguồn dựng atlas, âm thanh và cắt hình môi trường nằm trong `sources/`;
các lệnh tạo lại được ghi trong [README](README.md).

## Tiếp tục sau checkpoint `141ed9d`

- Biome toàn repo, typecheck SDK/game và production build đạt. Kiểm tra toàn repo
  cục bộ vướng hai ngưỡng tốc độ có sẵn của Checkers/Go trên máy 2 CPU; CI `check`
  của `141ed9d` đã qua toàn bộ unit tests và build.
- Vòng đời atlas đã qua bằng input thật trên Canvas fallback: nghỉ, đi bốn hướng,
  kỹ năng, đặt bom, ngòi bom, vụ nổ, đóng băng, trúng đòn, bị loại và chơi lại.
- CI WebGL đã qua các luồng phòng thật và hoạt ảnh tới đòn cuối. Bài kiểm tra đặt
  bom trong lửa cũ khiến bom nổ dây chuyền ngay lúc còn miễn sát thương; đã sửa
  để đợi vùng nổ và miễn sát thương kết thúc. Đang chạy lại CI tại head mới.
- `rasterizeGraphics` được chuyển vào `@psc/sdk/client` để game khác có thể tái sử
  dụng, có `RasterBounds`, giới hạn texture và dọn tài nguyên theo scene.
- Thử tắt MSAA không cải thiện đáng kể SwiftShader, nên giữ cấu hình render của app.
