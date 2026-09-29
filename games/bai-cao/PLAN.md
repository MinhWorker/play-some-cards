# Kế hoạch Bài Cào

## Đích đến

Một bàn Bài Cào vui cho 2–6 người trên điện thoại cầm ngang: đặt cược nhanh, nặn bài hồi hộp,
lật bài và thấy ngay ai ăn ai thua; chơi với bạn bè hoặc thêm người chơi máy.

## Đã xong (game chơi được)

- Luật: làm cái xoay vòng, cược 5/10/20, chia ba lá, tính nút, Ba Tây ăn gấp đôi, so lá lớn nhất
  khi bằng nút, 5/10/20 ván con, người nhiều điểm nhất thắng; hết giờ cược hoặc lật thì tự làm
  thay; rời bàn giữa chừng.
- Bài chưa lật được giấu với người khác và khán giả.
- Bàn: ghế quanh chiếu (tối đa 6), bài bay ra khi chia, nặn từng lá, lật bài, tên bài và điểm
  thắng/thua mỗi ván con, đồng hồ đếm ngược.
- Kịch bản e2e `scripts/e2e/scenarios/bai-cao.mjs`.

## Còn lại

1. **Hình**: `island.webp` (đảo Bài Cào, hiện là đảo mẫu), phỉnh (chip) cho tiền cược, dấu nhà cái.
2. **Âm thanh** và nhạc nền: chia bài, nặn bài, lật bài, ăn, thua, Ba Tây, hết ván.
3. **Hiệu ứng**: phỉnh chạy từ người thua sang người thắng, nặn bài bằng cách kéo mép lá.
4. **Tuỳ chọn thêm** nếu cần: mức cược, thời gian, luật Sáp (ba lá cùng hạng).
5. **Rà soát để phát hành**: chơi đủ 6 người trên điện thoại và máy tính, thử khán giả, kết nối
   lại và rời bàn, rồi đổi `meta.status` sang `'ready'`.
