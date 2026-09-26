# Tiến Lên

Tiến Lên miền Nam, 2–4 người, chơi với bạn hoặc với máy (Dễ / Vừa / Khó).

## Luật

- Một **ván đấu** gồm nhiều **vòng** (1, 3, 5 hoặc 10, chọn khi tạo phòng). Mỗi vòng chia lại
  bài, mỗi người 13 lá, và kết thúc khi mọi người đều đã có hạng.
- Bộ 52 lá. Lá nhỏ nhất là 3♠, lớn nhất là 2♥: số theo thứ tự 3 4 5 6 7 8 9 10 J Q K A 2, cùng
  số thì so chất ♠ < ♣ < ♦ < ♥.
- Vòng đầu của ván đấu: người cầm lá nhỏ nhất đi trước và phải đánh cả lá đó (nếu người thắng ván
  đấu trước còn ngồi đó thì họ đi trước). Các vòng sau: người về nhất vòng trước đi trước.
- Đánh một bộ: lá lẻ, đôi, ba, tứ quý, sảnh (3 lá liền nhau trở lên, không có 2) hoặc đôi thông
  (3 đôi liền nhau trở lên, không có 2). Người sau phải chặn bằng bộ cùng loại, cùng số lá, lá cao
  nhất lớn hơn; hoặc bỏ lượt.
- Chặt heo: 3 đôi thông chặt một con 2; tứ quý chặt một con 2, đôi 2 và 3 đôi thông; 4 đôi thông
  chặt 2, đôi 2, 3 đôi thông và tứ quý. Bộ chặt lớn hơn chặt được bộ chặt nhỏ hơn.
- Đã bỏ lượt thì ngồi ngoài tới hết lượt đánh đó. Khi mọi người khác đều bỏ lượt, người đánh cuối
  được đánh bộ mới. Người đánh cuối đã hết bài thì người kế tiếp được đánh bộ mới.
- Hết bài trước thì về nhất, rồi nhì, ba; người cuối cùng còn bài là bét.
- **Điểm mỗi vòng theo hạng**: nhất được (số người − 1) điểm, bét 0 điểm (bàn 4 người: 3/2/1/0).
  Hết ván đấu, ai nhiều điểm nhất vô địch; bằng điểm thì ai về nhất nhiều vòng hơn đứng trên.
- **Đồng hồ lượt** (15 / 20 / 30 giây) khi bàn có từ 2 người thật trở lên. Hết giờ: đang phải chặn
  thì tự bỏ lượt; đang được đánh bộ mới thì tự đánh lá nhỏ nhất.
- **Rời bàn giữa ván đấu là thua**: người rời xếp dưới mọi người còn bài trong vòng đó (người rời
  trước xếp thấp hơn), được 0 điểm, và đứng cuối bảng tổng kết. Những người còn lại chơi tiếp;
  còn dưới 2 người thì ván đấu kết thúc.

Chưa có: tới trắng, phạt thối heo, tính điểm theo lá còn lại.

## Các thứ nằm ở đâu

```
src/
  index.ts              đầu vào phía server: meta, game: new TienLenGame(), tuỳ chọn phòng
  client.ts             đầu vào phía trình duyệt: bàn chơi, màn cài đặt, câu hỏi khi rời bàn
  game/
    model.ts              ★ đọc trước: State, View (mỗi người thấy gì), Options và nhịp chia bài
    cards.ts              lá bài, các bộ và luật chặn
    match.ts              điểm mỗi vòng và bảng xếp hạng cả ván đấu
    TienLenGame.ts        sự kiện play / pass và các hook: chia bài, đánh, bỏ lượt, hẹn giờ,
                          người rời bàn, máy, view
    bot.ts                bộ não của máy: đánh bộ nào
    *.test.ts             test (npm run check)
  scenes/
    TienLenView.ts        bàn chơi: bài trên tay, người chơi quanh bàn, đống bài giữa bàn, chữ
                          giới thiệu vòng, chữ nhảy lên khi có nước đặc biệt
    PlayerList.ts         danh sách người chơi góc trái (ảnh, tên, số lá, điểm, đồng hồ lượt)
    Standings.ts          bảng xếp hạng sau mỗi vòng và bảng tổng kết
    Callout.ts            chữ lớn nhảy lên rồi bay đi ("Chặt heo!", "Vòng 2")
    Card.ts               một lá bài trên màn hình (mặt, số, chất, mặt sau, lật bài)
    Setup.ts              màn cài đặt một bước: số máy, độ khó, số vòng, thời gian mỗi lượt
assets/                 hình (Codex, prompt trong sources/prompts.json) và âm thanh
```

## Chuyện gì xảy ra

| Khi | Server (`TienLenGame`) | Mọi màn hình (`TienLenView`) |
| --- | --- | --- |
| "Bắt đầu", vòng mới | `onStart` / `onNextRound`: xào, chia 13 lá cho người còn ngồi, chọn người đi trước; hẹn giờ `begin` | xào bộ bài giữa bàn, chia cho từng người, rồi hiện "Vòng 2" và "Lan đi trước" |
| Chia xong | `onBegin`: bắt đầu đánh, bật đồng hồ lượt (`turn-over`) | tới lượt ai thì vòng sáng quanh ảnh, đồng hồ chạy vòng quanh |
| Chọn lá rồi bấm "Đánh" | `send('play', { cards })` → `onPlay`: kiểm tra bộ và luật chặn | `onPlay`: các lá bị đập xuống đống bài, âm thanh và chữ theo bộ ("Tứ quý!", "Chặt heo!") |
| Bấm "Bỏ lượt" | `onPass`; mọi người bỏ lượt thì dọn bàn | `onPass`, `onState` (bài lượt cũ được gạt vào chồng úp) |
| Hết giờ | `onTurnOver`: tự bỏ lượt hoặc đánh lá nhỏ nhất | như người bấm |
| Tới lượt máy | `bot(ctx)` → `play` hoặc `pass` (không đánh lúc đang chia) | như người bấm |
| Có người hết bài | ghi hạng; còn một người giữ bài thì hết vòng, cộng điểm, hẹn giờ `next-round` | "Về nhất!", rồi "Thối heo!" / "Về bét!", rồi bảng "Hết vòng" |
| Có người rời bàn | `onLeave`: xếp họ cuối, chơi tiếp | "Lan bỏ cuộc" |
| Hết vòng cuối | `ctx.finish([người nhiều điểm nhất])` | bảng "Tổng kết" và nhạc chiến thắng cho cả bàn |

Lá bài bay, xào và chia hiện làm bằng tween của Phaser; hoạt ảnh làm bằng Blender sẽ thay vào
sau.

Chơi thử một mình: http://localhost:5033/?play=tien-len&players=4 (khi đang chạy `npm run dev`;
sandbox không có máy, các nút ghế đổi góc nhìn; đồng hồ lượt chạy vì mọi ghế đều là người).

## Ghi công

Hình tạo bằng Codex (`sources/prompts.json`). Nhạc tổng kết `tien-len-standings.mp3` cắt từ
"winning" của pw23check trên Pixabay. Âm thanh: file trong `assets/`, phần lớn làm từ một bản ghi lá bài thật (xem
`LICENSE-ASSETS.md`); bản gốc lưu trong `assets/games/tien-len/audio/`; xem thêm
[docs/tien-len-audio.md](../../docs/tien-len-audio.md).
