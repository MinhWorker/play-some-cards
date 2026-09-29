# Kế hoạch Cờ Vua

## Đích đến

Hai người chơi một ván Cờ Vua trọn vẹn trên bàn cờ dễ đọc ở điện thoại, trong phong cách đảo trời,
gỗ và giấy của ứng dụng; hoặc chơi với máy ở ba mức.

## Đã xong (khung game)

- Luật FIDE đầy đủ: nước đi, chiếu, chiếu hết, hết nước, nhập thành, bắt tốt qua đường, phong
  cấp, lặp thế cờ ba lần, 50 nước, không đủ quân, xin hoà, đầu hàng, rời bàn. Có test perft.
- Máy chơi ba mức (alpha-beta, xem thêm nước ăn quân ở cuối), nghĩ dưới 0,2 giây ở mức Khó.
- Form tạo phòng (đối thủ, mức máy, màu quân), bàn cờ vẽ bằng code, quân tạm bằng ký hiệu,
  chọn quân phong cấp, nút xin hoà/đầu hàng, tỉ số hai người.
- Kịch bản e2e `scripts/e2e/scenarios/chess.mjs`.

## Còn lại

1. **Hình** (`sources/prompts.json`, `npm run gen:asset`):
   - `island.webp`: đảo Cờ Vua trên bản đồ (hiện là đảo mẫu).
   - `board.webp`: mặt bàn gỗ có viền mỏng; ô vẫn do game vẽ hoặc nằm sẵn trong ảnh.
   - 12 quân `piece-<white|black>-<king|queen|rook|bishop|knight|pawn>.webp`, cỡ ảnh ít nhất
     2,3 × cỡ hiển thị (docs/ui-guide.md). Bàn tự dùng hình khi file có mặt (theme.ts `DISC`).
2. **Âm thanh** (`chess-*.wav`) và nhạc nền (`music-chess-*.mp3`): bắt đầu ván, chọn quân, đi quân,
   ăn quân, nhập thành, phong cấp, chiếu, chiếu hết, hoà, thắng; ghi vào `docs/chess-audio.md`.
3. **Hiệu ứng**: quân nhấc lên khi chọn, bụi khi đặt, cảnh ăn quân; bảng kết quả trên bàn như Cờ
   Tướng (thời gian, số nước, quân đã ăn); nút tắt hiệu ứng trên từng máy.
4. **Rà soát để phát hành**: chơi trọn ván trên điện thoại và máy tính, thử khán giả và kết nối
   lại, rồi đổi `meta.status` sang `'ready'`.
