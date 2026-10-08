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

## Bằng chứng tại checkpoint ban đầu

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

## Nghiệm thu ở code head `7584aab`

- CI: `npm run check`, production build và 40/40 kịch bản e2e đạt; tổng 46 checks đạt.
- Kịch bản WebGL của Bom Nguyên Tố qua chọn nhân vật, camera, cảm ứng, kỹ năng,
  đồng bộ phòng thật, kết quả đội, atlas bốn hướng, đóng băng, trúng đòn, bị loại và chơi lại.
- Kịch bản đầy đủ cũng đạt cục bộ trên Canvas fallback bằng UI và socket thật,
  không sửa trạng thái game để vượt qua bước kiểm tra.
- SDK/game typecheck, 38 SDK tests, 20 game tests, Biome và production build cục bộ đạt.
- Hai ngưỡng tốc độ có sẵn của Checkers/Go không đạt trên máy cục bộ 2 CPU;
  cùng kiểm tra toàn repo đã đạt trên CI.
- SwiftShader vẫn chậm ở desktop; không có GPU phần cứng trong môi trường này
  nên chưa xác nhận FPS trên thiết bị thật. Không đổi độ phân giải hoặc chất lượng
  của app để che giới hạn đó.

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
  để đợi vùng nổ và miễn sát thương kết thúc. CI WebGL tại head mới đã đạt.
- `rasterizeGraphics` được chuyển vào `@psc/sdk/client` để game khác có thể tái sử
  dụng, có `RasterBounds`, giới hạn texture và dọn tài nguyên theo scene.
- Thử tắt MSAA không cải thiện đáng kể SwiftShader, nên giữ cấu hình render của app.
