# Mậu Binh

Mậu Binh cho 2–4 người, chơi với bạn hoặc thêm máy. Mỗi người tự xếp 13 lá thành ba chi, rồi cả
bàn cùng lật bài và so từng chi.

## Luật

- Bộ 52 lá, không Joker. Mỗi vòng chia lại, mỗi người 13 lá. Lá từ 2 lên A; chất không phá hoà.
- Xếp **chi 1** (5 lá, nằm dưới cùng), **chi 2** (5 lá) và **chi 3** (3 lá, trên cùng). Chi 1
  không được yếu hơn chi 2, chi 2 không được yếu hơn chi 3. Sai thứ tự là **binh lủng**.
- Bộ 5 lá từ yếu tới mạnh: mậu thầu, đôi, thú, sám cô, sảnh, thùng, cù lũ, tứ quý, thùng phá
  sảnh. Chi 3 chỉ tính mậu thầu, đôi, sám cô. A-2-3-4-5 là sảnh nhỏ nhất, 10-J-Q-K-A lớn nhất.
- Mọi người xếp cùng lúc và chỉ thấy bài mình. Xếp xong thì bấm "Xong"; muốn sửa thì bấm "Xếp
  lại" khi người khác chưa xong. Bài lủng vẫn nộp được, nhưng phải bấm thêm lần nữa để xác nhận.
- **Đồng hồ xếp bài** 60 hoặc 90 giây. Hai giây cuối, bài đang xếp tự được nộp đúng như đang
  nằm, kể cả khi lủng: máy không xếp lại bài của bạn. Chỉ khi màn hình không gửi được gì (mất
  kết nối) thì hết giờ máy mới xếp giúp.
- **Điểm**, so từng cặp người, từng chi cùng vị trí:
  - thắng một chi được +1, thua −1, hoà 0; thắng cả ba chi (**sập 3 chi**) được thêm +3;
  - thắng chi bằng bộ đặc biệt được nhiều hơn: sám cô chi 3 +3, cù lũ chi 2 +2, tứ quý chi 1 / chi
    2 +4 / +8, thùng phá sảnh chi 1 / chi 2 +5 / +10;
  - binh lủng thua 6 với mỗi người bài hợp lệ; hai bài lủng gặp nhau thì hoà;
  - **tới trắng** thắng luôn mỗi người không có tới trắng: ba sảnh, ba thùng, sáu đôi +3; năm đôi
    một sám +6; sảnh rồng +13; sảnh rồng đồng chất +26. Hai tới trắng gặp nhau thì loại điểm cao
    hơn thắng, bằng điểm thì hoà. Game tự nhận ra tới trắng, dù bạn xếp thế nào.
- Một **ván** gồm 1, 3 hoặc 5 vòng (mặc định 5). Hết ván, ai nhiều điểm nhất thắng; bằng điểm thì
  cùng thắng.
- **Rời bàn giữa ván là thua**: người rời thua vòng đang chơi như binh lủng và đứng cuối bảng.
  Những người còn lại chơi tiếp; còn dưới 2 người thì ván kết thúc.
- Nút "Luật" trên bàn mở bảng điểm này. Nút "Kết quả" ngay dưới mở lớp phủ cả màn hình với từng
  vòng đã xong (mỗi vòng một tab): bài ba chi, tên bộ và điểm từng chi của mọi người, tính từ phía
  bạn. Mỗi người tự mở hoặc đóng trên máy mình.

## Cách xếp bài

Chạm một lá rồi chạm lá khác để đổi chỗ, hoặc kéo một lá thả gần lá kia (lá sẽ đổi chỗ sáng viền
vàng; thả lại chỗ cũ là thôi). "Tự xếp" để máy xếp giúp, "Hoàn tác" quay lại bước trước. Tên bộ
của từng chi hiện bên phải; chi nào làm bài lủng thì chữ đỏ và dòng trạng thái nói lý do. Mất kết
nối rồi vào lại, bài vẫn nằm như bạn đang xếp.

## Các thứ nằm ở đâu

```
src/
  index.ts              đầu vào phía server: meta, game: new MauBinhGame(), tuỳ chọn phòng
  client.ts             đầu vào phía trình duyệt: bàn chơi, màn cài đặt, câu hỏi khi rời bàn
  game/
    model.ts              ★ đọc trước: State, View (mỗi người thấy gì), Options, nhịp chia và lật bài
    cards.ts              lá bài, nhận diện bộ, so sức mạnh, kiểm tra binh lủng
    scoring.ts            điểm từng chi, thưởng chi, tới trắng, so từng cặp người
    arrange.ts            tìm cách xếp tốt nhất (máy, người mất kết nối lúc hết giờ, nút "Tự xếp")
    match.ts              bảng xếp hạng và người thắng ván
    MauBinhGame.ts        sự kiện submit / cancel và các hook: chia bài, hẹn giờ, lật bài,
                          người rời bàn, máy, view
    *.test.ts             test (npm run check)
  scenes/
        MauBinhView.ts        bàn chơi: bài của bạn và của mọi người, xếp bài, đồng hồ, lật từng chi,
                          cut-in, điểm
    Arena.ts              "bàn đấu" giữa bàn, nơi từng chi được đặt xuống để so
    Card.ts               một lá bài trên màn hình; lật bài bằng các khung hình vẽ sẵn
        RulesPanel.ts         bảng "Luật tính điểm" bật/tắt
    ResultsPanel.ts       lớp phủ "Kết quả các vòng", mỗi vòng một tab
    PlayerList.ts         danh sách người chơi góc trái (chép từ Tiến Lên)
    Standings.ts          bảng kết quả vòng và bảng tổng kết (chép từ Tiến Lên)
    Callout.ts            chữ lớn nhảy lên rồi bay đi (chép từ Tiến Lên)
    Setup.ts              màn cài đặt: số máy, số vòng, thời gian xếp bài
assets/                 hình (Codex, prompt trong sources/prompts.json) và âm thanh
```

## Chuyện gì xảy ra

| Khi | Server (`MauBinhGame`) | Mọi màn hình (`MauBinhView`) |
| --- | --- | --- |
| "Bắt đầu", vòng mới | `onStart` / `onNextRound`: xào, chia 13 lá cho người còn ngồi; hẹn giờ `begin` | xào bộ bài, chia tới từng ghế, bài của bạn lật lên, "Vòng 2" |
| Chia xong | `onBegin`: bắt đầu xếp, hẹn giờ `arrange-over` | "Xếp bài!", đồng hồ cát chạy |
| Bấm "Xong" | `send('submit', { rows })` → `onSubmit`: kiểm tra đúng 13 lá, 5–5–3. Bài nộp là bí mật (`secretEvents`) | người khác chỉ thấy dấu ✓ |
| Bấm "Xếp lại" | `onCancel` | bài mở lại để xếp |
| Máy | `bot(ctx)`: nộp cách xếp tốt nhất ngay | như người bấm |
| Mọi người xong, hoặc hết giờ | `onArrangeOver` / lật bài: máy xếp cho ai chưa nộp (màn hình mất kết nối), tính điểm, hẹn giờ `next-round` (vòng cuối: `finish`) sau khi màn hình lật xong | "Lật bài!", tới trắng, rồi từng chi 1 → 2 → 3 của mọi người được đặt ra "bàn đấu" giữa bàn, lật lên, so và ghi điểm rồi trở về tay; sập 3 chi, điểm từng người, bảng "Kết quả vòng" |
| Có người rời bàn | `onLeave`: họ thua vòng này, ngồi ngoài các vòng sau | "Lan bỏ cuộc" |
| Hết vòng cuối | `ctx.finish([người nhiều điểm nhất])` | bảng "Tổng kết" và nhạc cho cả bàn |

Chơi thử một mình: http://localhost:5033/?play=mau-binh&players=4 (khi đang chạy `npm run dev`;
sandbox không có máy, các nút ghế đổi góc nhìn).

## Ghi công

Hình tạo bằng Codex (`sources/prompts.json`): đảo, mặt bài, mặt sau, bàn, các khung lật bài,
chùm sáng cut-in và đồng hồ cát. Hình chất bài và nút chép từ Tiến Lên. Âm thanh chép từ Tiến
Lên, xem [docs/mau-binh-audio.md](../../docs/mau-binh-audio.md).
