# Kế hoạch Bắn Tàu

## Đích đến

Hai người chơi một trận Bắn Tàu trọn vẹn trên điện thoại cầm ngang: xếp tàu nhanh, bắn rõ ràng,
thấy ngay trúng hay trượt; hoặc đấu với máy ở ba mức.

## Đã xong (game chơi được)

- Luật: hạm đội năm tàu trên biển 10 × 10, xếp ngẫu nhiên hoặc tự xếp, tuỳ chọn tàu được sát nhau
  hay không, bắn trúng được bắn tiếp hay đổi lượt, chìm tàu, thắng khi đánh chìm cả hạm đội, đầu
  hàng, rời trận.
- Hạm đội đối phương bí mật tới khi chìm (lệnh xếp tàu cũng giấu với người khác); hết trận hiện
  cả hai.
- Máy ba mức; trung bình máy Khó cần khoảng 38 phát để đánh chìm cả hạm đội, Vừa khoảng 47.
- Form tạo phòng, biển lớn và biển nhỏ vẽ bằng code, chọn/xoay/dời tàu, danh sách tàu đối phương.
- Kịch bản e2e `scripts/e2e/scenarios/battleship.mjs`.

## Còn lại

1. **Hình**: `island.webp` (đảo Bắn Tàu, hiện là đảo mẫu), nền biển, năm con tàu nhìn từ trên
   xuống (ngang và dọc), cột nước khi trượt, lửa khói khi trúng, xác tàu chìm.
2. **Âm thanh** (`battleship-*.wav`) và nhạc nền: đặt tàu, bắn, trượt (tõm), trúng (nổ), chìm,
   thắng.
3. **Hiệu ứng**: đạn bay tới ô bắn, tàu chìm dần, rung màn hình theo cỡ tàu.
4. **Rà soát để phát hành**: chơi trọn trận trên điện thoại và máy tính, thử khán giả và kết nối
   lại, rồi đổi `meta.status` sang `'ready'`.
