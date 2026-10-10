# Bom Nguyên Tố

Minigame đặt bom trong khu vườn đồ chơi, 1–4 bạn nhỏ nguyên tố, sinh tồn hoặc đấu đội 2v2.
[Luật chơi hiện tại](RULES.md).

## Thành phần

- `src/game/model.ts`: trạng thái, nguyên tố, tuỳ chọn phòng và hằng số.
- `src/game/arena.ts`: va chạm liên tục, bom, vùng nổ, kỹ năng, vật phẩm và thu hẹp.
- `src/game/bot.ts`: BFS theo không gian/thời gian và dự đoán phản ứng dây chuyền.
- `src/game/BomNguyenToGame.ts`: mô phỏng server với timer 100 ms, chọn nhân vật,
  sự kiện điều khiển, loại người chơi và kết quả đội.

Nhân vật dùng khung hình thật ở bốn hướng: nghỉ (có chớp mắt), đi bộ, đặt bom, dùng kỹ năng,
trúng đòn, đóng băng, bị loại và xuất hiện. Bom và vụ nổ cũng đổi khung hình; không biến dạng
nhân vật để giả chuyển động. Luật chơi và máy chạy trên server. Máy bổ sung vào đấu trường khi
thiếu ghế không chiếm ghế phòng dành cho người thật.

## Bàn chơi

`godot/main.gd` dựng màn chơi theo bố cục **Hành động**: đấu trường ở giữa;
thẻ bạn nhỏ của mình (HP, bom còn đặt được, tầm nổ) ở trên trái dưới nút ☰; đồng hồ ở giữa hàng
trên, thẻ những người khác hai bên; D-pad gỗ ở dưới trái; **Bom**, **Kỹ năng**, **Lướt** xếp dọc
ở dưới phải (vòng tối quay lại khi đang hồi, số giây thay cho tên). Bàn phím: WASD hoặc phím
mũi tên, Space, E, Shift. Mỗi ngón tay xử lý riêng, nên vừa giữ hướng vừa bấm Bom được.
Trước trận có bảng **Chọn bạn nhỏ** với năm bạn và nút **Sẵn sàng**; kết quả do hub hiện, kèm
số lần hạ gục và thùng quà đã mở.

- `godot/arena.gd`: ô cỏ/đất, hàng rào, khối đá, thùng quà, bom, vụ nổ, vật phẩm và nhân vật
  sắp lớp theo hàng. Nhân vật của mình đi trước snapshot (server đi theo vị trí màn hình gửi
  kèm `input`), nhân vật khác trượt dần tới vị trí server. Ô sắp nổ sáng theo màu nguyên tố rồi
  đỏ nhấp nháy, vòng sắp bị lấp nhấp nháy đỏ.
- `godot/rules.gd`: đi theo lối, vùng nổ, phản ứng dây chuyền và vòng thu hẹp (chép từ
  `model.ts`, `arena.ts`, `bot.ts`).
- `godot/atlas.gd`: đọc atlas `art/*.json` thành các chuỗi khung hình.
- `godot/card.gd`, `godot/pad.gd`, `godot/action.gd`: thẻ người chơi, D-pad, nút hành động.
- Hình ở `godot/art/`, âm thanh ở `godot/sounds/`; test: `godot/test/`.

## Phát triển và kiểm tra

Từ thư mục gốc repo:

```sh
npm run godot:export -- --debug
npm run dev
npm run check
npm run godot:check
npm run e2e -- --only godot-bom-nguyen-to
```

Sandbox: `http://localhost:5033/?play=bom-nguyen-to` (một máy dễ, trên server thật). Kịch bản
trình duyệt nằm ở `scripts/e2e/scenarios/godot-bom-nguyen-to.mjs`.

## Hình và âm thanh

Toàn bộ hình vẽ tay do Codex tạo riêng cho game theo `sources/prompts.json`
(`npm run gen:asset -- bom-nguyen-to/<tên>`): logo, nền vườn, chân dung, biểu tượng, nút, D-pad,
bảng đồng hồ, ô cỏ/đất, khối đá, thùng quà, cọc rào, bom, vụ nổ và vật phẩm. Không dùng tài
sản trích xuất từ game khác.

Khung hình nhân vật được vẽ lại từ chân dung (tư thế đứng), rồi từng tư thế được sửa từ tư thế
đứng để giữ đúng thiết kế. Codex vẽ mỗi khung một cỡ, nên `sources/pack-sprites.py` cắt nền,
đưa nhân vật về cùng chiều cao (theo tỉ lệ từng tư thế trong `POSE_HEIGHT`), đặt chân trên một
đường và lật hình nghiêng phải thành nghiêng trái, rồi gộp thành atlas:

```sh
python games/bom-nguyen-to/sources/pack-sprites.py           # cả nhân vật và arena-fx
python games/bom-nguyen-to/sources/pack-sprites.py fire ice  # chỉ vài nhân vật
python games/bom-nguyen-to/sources/pack-sprites.py arena     # bom, vụ nổ, vật phẩm
python games/bom-nguyen-to/sources/pack-sprites.py tiles     # ô cỏ/đất làm dịu màu và chi tiết
```

Ô cỏ và ô đất được giảm độ đậm màu và làm mờ chi tiết bề mặt (`TILES` trong script), để khối
đá và thùng quà nổi bật trên nền đường.

Script đọc ảnh gốc `sources/<tên>.png`; ảnh xem trước nằm ở `.blender/bom-nguyen-to/`.
Hiệu ứng phụ nhỏ (mảnh thùng, bụi, vệt lướt, lớp băng, sao choáng, vòng kỹ năng, pháo giấy) là
hình vector trong `sources/bake-effects.mjs`, xuất thành atlas `cartoon-fx`:

```sh
node games/bom-nguyen-to/sources/bake-effects.mjs
```

Âm thanh tổng hợp riêng bằng `python games/bom-nguyen-to/sources/synthesize.py`.
