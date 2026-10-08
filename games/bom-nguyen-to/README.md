# Bom Nguyên Tố

Minigame đặt bom nguyên tố, 1–4 nhân vật, sinh tồn hoặc đấu đội 2v2.
[Luật chơi hiện tại](RULES.md).

## Thành phần

- `src/game/model.ts`: trạng thái, nguyên tố, tuỳ chọn phòng và hằng số.
- `src/game/arena.ts`: va chạm liên tục, bom, vùng nổ, kỹ năng, vật phẩm và thu hẹp.
- `src/game/bot.ts`: BFS theo không gian/thời gian và dự đoán phản ứng dây chuyền.
- `src/game/BomNguyenToGame.ts`: mô phỏng server với timer 100 ms, chọn nhân vật,
  sự kiện điều khiển, loại người chơi và kết quả đội.
- `src/scenes/BomNguyenToView.ts`: phép chiếu isometric, nội suy và dự đoán di chuyển,
  sprite có chiều sâu, HUD, chọn nhân vật, kết quả và điều khiển nhiều ngón.
- `src/scenes/Setup.ts`: chế độ, số nhân vật, ghế máy, độ khó và nguyên tố ban đầu.
- `src/scenes/theme.ts`: màu xanh đậm, giấy kem, viền vàng và chữ Baloo 2.
- `assets/`: hình WebP và âm thanh WAV dùng trực tiếp.
- `sources/synthesize.py`: tạo lại bốn âm thanh gốc.

Đấu trường và nhân vật có hình ảnh 3D dựng sẵn, được Phaser ghép thành thế giới
isometric bằng sprite và sắp lớp theo chiều sâu; không dùng engine 3D thời gian thực.
Luật chơi và bots chạy trên server, cùng luật trong sandbox. Máy bổ sung vào
đấu trường khi thiếu ghế không chiếm ghế phòng dành cho người thật.

## Phát triển và kiểm tra

Từ thư mục gốc repo:

```sh
npm install
npm run dev
npm run check
npm run e2e -- --changed origin/main
python games/bom-nguyen-to/sources/synthesize.py
```

Sandbox: `http://localhost:5033/?play=bom-nguyen-to&players=1`.
Chọn **Tuỳ chỉnh** để đổi chế độ, độ khó và số nhân vật; sau đó chọn nguyên tố
và **Sẵn sàng**. Có thể dùng 2–4 ghế sandbox để thử nhiều người hoặc xem với
**Khán giả**. Kịch bản browser nằm ở `scripts/e2e/scenarios/bom-nguyen-to.mjs`.

## Hình ảnh và âm thanh

Hình nhân vật, đá, thùng, bom, hiệu ứng và phông đền do OpenAI Image Gen tạo
riêng cho game; mô tả trong `sources/prompts.json`. Không dùng tài sản trích xuất
của Genshin Impact. Hiệu ứng âm thanh tổng hợp riêng bằng `synthesize.py`.
HUD, cảnh báo, điều khiển và mọi chữ được vẽ bằng code, không dùng ảnh giao diện.
