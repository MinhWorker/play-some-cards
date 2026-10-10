# Cờ Cá Ngựa

Cờ cá ngựa một xúc xắc cho 2–4 người, có thể chơi với 1–3 máy. Xem [luật chơi](RULES.md). Plugin có trạng thái `ready`.

## Giao diện

Điện thoại nằm ngang:

![Bàn chơi trên điện thoại](../../docs/images/co-ca-ngua-phone.webp)

Máy tính, bốn người:

![Bàn chơi trên máy tính](../../docs/images/co-ca-ngua-desktop.webp)

## Mã nguồn

- `src/game/model.ts`: dữ liệu ngựa, nước đi, chặn đường, đá ngựa và chuồng 6–5–4–3.
- `src/game/CoCaNguaGame.ts`: server kiểm tra lượt, tung xúc xắc bằng `ctx.rng`, timer, người máy và thứ hạng.
- `godot/main.gd`: bàn chơi trong client Godot (bố cục **Bàn**): bàn vuông ở giữa, ô người chơi ở
  góc cạnh chuồng màu của họ, xúc xắc ở cột của người đang tới lượt; hiệu ứng và âm thanh.
- `godot/rules.gd`: đặt ngựa trên lưới 15 × 15 và tìm nước đi (chép từ `model.ts`).
- `godot/art/`, `godot/sounds/`, `godot/music/`: hình, âm thanh và nhạc bàn dùng; test ở
  `godot/test/`.
- `sources/render_assets.py`: dựng bàn gỗ, atlas ngựa và normals, sáu mặt xúc xắc, nút và nền nỉ bằng [Blender helper chung](../../tools/blender/xomdao_bake/__init__.py).

## Chạy và kiểm tra

```sh
npm run godot:export -- --debug
npm run dev
npm run blender -- co-ca-ngua
npm run check
npm run godot:check
npm run e2e -- --only godot-co-ca-ngua
npm run shots -- --path '/?play=co-ca-ngua'
```

Chơi thử tại `http://localhost:5033/?play=co-ca-ngua` (ba máy, trên server thật). Chạm xúc xắc
để tung; ngựa đi được có vòng vàng, chạm ngựa để đi. Ngựa nhảy từng ô, ngựa bị đá trượt về chuồng,
đội về đủ bốn ngựa nhảy múa. Bảng Tạo phòng chọn bạn bè hoặc số người máy, chế độ Thường hoặc
Phân hạng; chế độ Phân hạng tiếp tục sau khi có người hoàn thành.

Dev Console trong phòng server hỗ trợ `set-horse <seat> <horse> <position>` và `roll-dice <value>` để thử nước đi. Ghế và ngựa đánh số từ 0; vị trí `-1` là chuồng, `0–51` là đường đua theo màu mình, `52–57` là ô chuồng 1–6. `roll-dice` chỉ hoạt động khi đang chờ tung. Đây là lệnh phát triển qua SDK, không phải sự kiện người chơi gửi được trên production.

## Hình và âm thanh

Hình bàn, ngựa, xúc xắc, nút và nỉ được tạo trong Blender bằng mã nguồn của dự án; không dùng tài nguyên bên ngoài. Ngựa dùng atlas diffuse/normals cùng kích thước, normals RGB opaque và lossless, ánh sáng chung phía trên trái; bàn Godot dùng bản sao trong `godot/art/`. Bàn 1664 px đủ nét trên máy tính bảng.

Ảnh đảo giữ bộ hình hiện có trong `sources/prompts.json`. Nhạc và hiệu ứng Cờ Cá Ngựa giữ bộ âm thanh hiện có của dự án; các hiệu ứng ngắn được chỉnh tốc độ, âm lượng và fade để theo nhịp hoạt ảnh. Nguồn lưu trữ nằm trong `assets/games/co-ca-ngua/audio/`; xem [ghi công tài nguyên](../../LICENSE-ASSETS.md).
