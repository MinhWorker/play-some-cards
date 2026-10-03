# Bài Cào

Bài Cào (ba cây) cho 2–6 người, có thể thêm người chơi máy. Game đang ở trạng thái `wip`: luật,
người chơi máy và bàn đã chơi được; hình riêng và âm thanh làm sau, xem
[kế hoạch Bài Cào](PLAN.md).

## Luật chơi

- Một ván gồm 5, 10 hoặc 20 ván con. Mỗi ván con một người **làm cái**, lần lượt vòng quanh bàn
  (người tạo phòng làm cái trước). Ai cũng bắt đầu với 0 điểm.
- **Đặt cược**: mọi người trừ nhà cái cược 5, 10 hoặc 20 điểm (15 giây; không kịp thì cược 5).
- **Chia bài**: mỗi người 3 lá từ bộ 52 lá. Bài của mình lúc đầu úp: chạm từng lá để tự xem
  (nặn bài); "Lật bài" lật cả ba cho mọi người thấy (20 giây; hết giờ thì tự lật).
- **Tính nút**: A là 1, 2–9 theo số, 10 J Q K là 0; cộng ba lá, lấy hàng đơn vị (0 là "bù",
  9 là cao nhất). **Ba Tây** (ba lá J, Q, K bất kỳ) lớn hơn mọi bài.
- **So bài**: mỗi người so với nhà cái; bài lớn hơn ăn tiền cược, thắng bằng Ba Tây thì ăn gấp đôi.
  Bằng nút thì so lá lớn nhất: K > Q > J > 10 > … > 2 > A, cùng hạng thì rô > cơ > bích > tép.
  Nên không bao giờ hoà.
- Hết các ván con, người nhiều điểm nhất thắng (bằng nhau thì cùng thắng).
- Người rời bàn thì ngồi ngoài từ đó (tiền cược ván đang chơi không tính); nhà cái rời bàn thì
  ván con đó huỷ. Còn một người thì ván kết thúc.

## Tạo phòng

Một form: **Chơi với máy** (không, hoặc 1–5 máy) và **Số ván** (5, 10, 20). Máy cược ngẫu nhiên
(thường là 10) và lật bài ngay.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  client.ts                 đầu vào phía trình duyệt: form tạo phòng và bàn
  game/cards.ts             lá bài, tính nút, Ba Tây, so bài
  game/model.ts             dữ liệu: State, View (giấu bài chưa lật), tuỳ chọn phòng, thời gian
  game/BaiCaoGame.ts        các sự kiện: bet, reveal; hẹn giờ: bet-over, reveal-over, next-round
  scenes/BaiCaoView.ts      bàn: các ghế, chia bài, nặn bài, cược, lật bài, điểm từng ván
  scenes/Card.ts, deck.ts   vẽ lá bài (chép từ Tiến Lên)
  scenes/Mat.ts             mặt chiếu (chép từ Tiến Lên)
  scenes/Setup.ts           form tạo phòng
assets/                     hình (.webp) và âm thanh (.wav/.mp3), dùng theo tên file
```

Mặt chiếu, lá bài, chất và nút lấy từ Tiến Lên (`mat`, `face-classic`, `back-lattice`,
`back-lotus`, `suit-*`, `button`). `island.webp` là đảo mẫu của `npm run new:game`.

Test: `npm run check`. Chơi thử một mình: http://localhost:5033/?play=bai-cao&players=4 (khi đang
chạy `npm run dev`).

## Vòng đời bàn chơi

Chia bài, lật bài và hiện điểm dùng runtime của SDK. Mỗi ván con huỷ các hiệu ứng của ván
trước. Khi kết nối lại hoặc đổi kích thước bàn, bài được dựng ngay từ trạng thái hiện tại;
hiệu ứng đang chờ không lật lại bài đã thay đổi.
