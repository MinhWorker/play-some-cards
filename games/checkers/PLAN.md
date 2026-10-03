# Kế hoạch Cờ Đam

## Đích đến

Hai người chơi một ván Cờ Đam trọn vẹn, bàn 8 × 8 hoặc 10 × 10, dễ đọc trên điện thoại, trong
phong cách đảo trời, gỗ và giấy của ứng dụng; hoặc chơi với máy ở ba mức.

## Đã xong (game chơi được)

- Luật 8 × 8 (Anh) và 10 × 10 quốc tế: bắt buộc ăn, ăn liên tiếp, phong Vua, Vua bay và ăn nhiều
  nhất (10 × 10), thua khi hết nước, hoà khi lặp thế ba lần, khi quá lâu không ăn quân và không đi
  quân thường, hoặc khi hai bên đồng ý. Có test perft cho cả hai bàn.
- Máy chơi ba mức (alpha-beta, đi tiếp các nước ăn ở cuối tìm kiếm), nghĩ dưới 0,3 giây ở mức Khó.
- Form tạo phòng, bàn cờ vẽ bằng code, chọn từng ô đáp cho nước ăn nhiều quân, quân đi theo từng
  bước nhảy, tỉ số và số quân đã ăn.
- Kịch bản e2e `scripts/e2e/scenarios/checkers.mjs`.

## Còn lại

1. **Hình**: `island.webp` (đảo Cờ Đam, hiện là đảo mẫu), `board.webp` (bàn gỗ), bốn quân
   `piece-<white|black>-<man|king>.webp`. Bàn tự dùng hình khi file có mặt.
2. **Âm thanh** (`checkers-*.wav`) và nhạc nền: đi quân, ăn quân, phong Vua, thắng, hoà.
3. **Hiệu ứng**: quân bị ăn bay khỏi bàn, lễ phong Vua, bảng kết quả trên bàn.
4. **Rà soát để phát hành**: chơi trọn ván trên điện thoại và máy tính ở cả hai bàn, thử khán
   giả và kết nối lại, rồi đổi `meta.status` sang `'ready'`.
