# Kế hoạch Cờ Vây

## Đích đến

Hai người chơi một ván Cờ Vây trọn vẹn, từ đặt quân tới đếm điểm, trên bàn dễ đọc ở điện thoại
(cả bàn 19 × 19), trong phong cách đảo trời, gỗ và giấy của ứng dụng; hoặc chơi với máy ở ba mức.

## Đã xong (game chơi được)

- Luật Trung Quốc: bắt quân, cấm tự sát, cấm lặp thế (superko), bỏ lượt, đếm theo diện tích với
  7,5 điểm bù, đầu hàng, rời bàn.
- Đếm điểm sau hai lần bỏ lượt: máy đoán sẵn quân chết bằng các ván ngẫu nhiên, hai bên sửa và
  cùng đồng ý, hoặc đánh tiếp.
- Máy chơi ba mức theo kinh nghiệm, biết bỏ lượt khi bàn đã ngã ngũ; nghĩ khoảng 0,1 giây mỗi
  nước ở bàn 19 × 19.
- Form tạo phòng (đối thủ, mức máy, cỡ bàn, màu quân), bàn cờ vẽ bằng code, tỉ số và số quân bắt.
- Kịch bản e2e `scripts/e2e/scenarios/go.mjs`.

## Còn lại

1. **Hình** (`sources/prompts.json`, `npm run gen:asset`):
   - `island.webp`: đảo Cờ Vây trên bản đồ (hiện là đảo mẫu).
   - `board.webp`: mặt gỗ kaya; đường kẻ vẫn do game vẽ theo cỡ bàn.
   - `stone-black.webp`, `stone-white.webp` (đá phiến và vỏ sò), cỡ ảnh ít nhất 2,3 × cỡ hiển thị
     ở bàn 9 × 9 (docs/ui-guide.md). Bàn tự dùng hình khi file có mặt.
2. **Âm thanh** (`go-*.wav`) và nhạc nền (`music-go-*.mp3`): bắt đầu ván, đặt quân, bắt quân, bỏ
   lượt, vào đếm điểm, thắng; ghi vào `docs/go-audio.md`.
3. **Chơi hay hơn**: toạ độ quanh bàn, chấp quân và điểm bù tuỳ chọn, đồng hồ, máy mạnh hơn (tìm
   kiếm theo ván ngẫu nhiên) nếu chạy đủ nhanh trên server.
4. **Rà soát để phát hành**: chơi trọn ván trên điện thoại và máy tính ở cả ba cỡ bàn, thử khán
   giả và kết nối lại, rồi đổi `meta.status` sang `'ready'`.
