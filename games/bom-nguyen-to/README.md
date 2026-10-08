# Bom Nguyên Tố

Minigame đặt bom nguyên tố, 1–4 nhân vật, sinh tồn hoặc đấu đội 2v2.
[Luật chơi hiện tại](RULES.md).

## Thành phần

- `src/game/model.ts`: trạng thái, nguyên tố, tuỳ chọn phòng và hằng số.
- `src/game/arena.ts`: va chạm liên tục, bom, vùng nổ, kỹ năng, vật phẩm và thu hẹp.
- `src/game/bot.ts`: BFS theo không gian/thời gian và dự đoán phản ứng dây chuyền.
- `src/game/BomNguyenToGame.ts`: mô phỏng server với timer 100 ms, chọn nhân vật,
  sự kiện điều khiển, loại người chơi và kết quả đội.
- `src/scenes/BomNguyenToView.ts`: góc top-down nghiêng nhẹ, không xoay chéo, nội suy và dự đoán di chuyển,
  đấu trường hoạt hình chiếm phần chính màn hình, HUD gọn bên trái/phía trên,
  nút hành động xếp dọc bên phải, chọn nhân vật và điều khiển nhiều ngón.
- `src/scenes/animations.ts`: đăng ký các chuỗi khung hình và thời gian chuyển trạng thái
  cho nhân vật, bom, kỹ năng, vụ nổ, thùng và vật phẩm.
- `rasterizeGraphics` từ `@psc/sdk/client`: lưu hình nền, bảng và nút vẽ bằng Graphics thành texture
  tối đa 3×, chỉ vẽ lại khi thay đổi và giải phóng texture khi đóng cảnh.
- `src/scenes/Setup.ts`: chế độ, số nhân vật, ghế máy, độ khó và nguyên tố ban đầu.
- `src/scenes/theme.ts`: màu pastel, giấy kem, viền mềm và chữ Baloo 2.
- `assets/`: hình WebP, atlas JSON và âm thanh WAV dùng trực tiếp.
- `sources/bake-cartoon-sprites.mjs`: vẽ từng tư thế SVG và đóng gói atlas hoạt hình.
- `sources/prepare-garden-art.mjs`: cắt phông và atlas sáu hình môi trường thành WebP.
- `sources/synthesize.py`: tạo lại âm thanh đồ chơi cho hành động, trúng đòn,
  vật phẩm và kết quả trận.

Đấu trường có phong cách bàn chơi hoạt hình với màu sáng và các linh thú nguyên tố.
Ô đi được là mặt cỏ xanh bạc hà phẳng; cột đá, thùng quà và tường viền có chiều
cao rõ ràng, mặt trước tối hơn và bóng tiếp đất. Bản đồ giữ hàng ngang/cột dọc,
nghiêng nhẹ về trước và tận dụng khoảng trống giữa HUD cùng các nút điều khiển.
Phaser ghép sprite và sắp lớp theo chiều sâu. Nhân vật dùng atlas khung hình thật ở bốn hướng: nghỉ,
đi bộ, đặt bom, dùng kỹ năng, trúng đòn, đóng băng, bị loại và xuất hiện.
Bom và hiệu ứng cũng dùng chuỗi khung hình trong atlas; không biến dạng nhân vật
hay dùng CSS để giả lập chuyển động trong trận.
Luật chơi và bots chạy trên server, cùng luật trong sandbox. Máy bổ sung vào
đấu trường khi thiếu ghế không chiếm ghế phòng dành cho người thật.

## Phát triển và kiểm tra

Từ thư mục gốc repo:

```sh
npm install
npm run dev
npm run check
npm run e2e -- --changed origin/main
node games/bom-nguyen-to/sources/bake-cartoon-sprites.mjs
python games/bom-nguyen-to/sources/synthesize.py
```

Mỗi atlas nhân vật có 164 khung hình; atlas hiệu ứng có 260 khung hình.
Chân dung chọn nhân vật được raster hóa từ SVG ở 320×320 để giữ nét trên màn
hình mật độ cao; khung hoạt hình dùng kích thước gốc 160×160.
Các ảnh được cắt phần alpha trống và đóng gói cùng `sourceSize`/`spriteSourceSize`
để giữ vị trí chân ổn định khi đổi khung. `animations.ts` xác định tốc độ,
chuỗi lặp và các động tác chạy một lần; tải lại trạng thái dựng lại cảnh hiện tại
mà không phát lại động tác hoặc hiệu ứng cũ.

Có thể xuất lại riêng atlas một nhân vật, giữ nguyên các ảnh còn lại:

```sh
node games/bom-nguyen-to/sources/bake-cartoon-sprites.mjs --actors --atlas-only --element=lightning
```

Sau khi tạo phông và atlas môi trường theo `sources/prompts.json`, xuất lại bằng:

```sh
node games/bom-nguyen-to/sources/prepare-garden-art.mjs garden-background.png garden-props.png
```

`garden-props.png` là atlas 3 cột × 2 hàng: ba mặt cỏ phẳng ở hàng trên;
cột đá, thùng quà và tường viền ở hàng dưới. Lệnh tạo sprite SVG và âm thanh
có thể chạy lại trực tiếp từ mã nguồn; lệnh chuẩn bị môi trường cần hai ảnh đầu vào.

Sandbox: `http://localhost:5033/?play=bom-nguyen-to&players=1`.
Chọn **Tuỳ chỉnh** để đổi chế độ, độ khó và số nhân vật; sau đó chọn nguyên tố
và **Sẵn sàng**. Có thể dùng 2–4 ghế sandbox để thử nhiều người hoặc xem với
**Khán giả**. Kịch bản browser nằm ở `scripts/e2e/scenarios/bom-nguyen-to.mjs`.
Kịch bản kiểm tra khung hình atlas tiến triển khi di chuyển, đặt bom, dùng kỹ năng,
nổ, đóng băng, trúng đòn và bị loại; đồng thời kiểm tra điều khiển cảm ứng,
đồng bộ phòng thật và làm mới trận.

## Hình ảnh và âm thanh

Nhân vật, bom và hiệu ứng được vẽ riêng bằng SVG trong `bake-cartoon-sprites.mjs`,
sau đó xuất thành ảnh WebP và atlas JSON. Phông và hình môi trường do OpenAI
Image Gen tạo riêng cho game; mô tả trong `sources/prompts.json`. Không dùng
tài sản trích xuất của Genshin Impact. Hiệu ứng âm thanh tổng hợp riêng bằng `synthesize.py`.
HUD, cảnh báo, điều khiển và mọi chữ được vẽ bằng code, không dùng ảnh giao diện.
