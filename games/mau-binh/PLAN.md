# Kế hoạch Mậu Binh

## Đích đến

Một bàn Mậu Binh cho 2–4 ghế, chơi với bạn hoặc thêm bot: mỗi người tự xếp 13 lá thành ba chi,
cùng lật bài, so từng chi và xem điểm rõ ràng. Trọng tâm là cảm giác **binh bài** và khoảnh khắc
lật chi, với lá bài và chuyển động 2D hợp phong cách gỗ, giấy của ứng dụng. Không cần model hoặc
hoạt ảnh 3D.

Bốn bước triển khai bên dưới đã làm xong trong game (vẫn để `wip` cho tới khi chơi thử đủ); luật
đang chạy được mô tả trong [README](README.md). Một điểm chốt thêm: chi bằng nhau không tính là
binh lủng (chi 1 “không yếu hơn” chi 2).

## Bộ luật mục tiêu

Chọn Mậu Binh kiểu xếp bài kín được mô tả trong [bài Mậu Binh tiếng Việt](https://vi.wikipedia.org/wiki/M%E1%BA%ADu_binh),
không dùng cách chơi lật dần từng lá. Những mức thưởng vốn khác nhau giữa các bàn được chốt thành
**điểm trong game**, không có tiền cược. [Pagat ghi nhận nhiều cách tính điểm và bộ thưởng khác nhau](https://www.pagat.com/partition/pusoy.html),
nên luật của phòng sẽ được hiện trước khi bắt đầu.

- Dùng bộ 52 lá, không Joker. Mỗi người nhận 13 lá; bài chưa chia còn úp. Giá trị lá từ 2 đến A;
  chất bài không phá hoà khi so hai bộ cùng hạng và cùng giá trị.
- Xếp **chi 1: 5 lá**, **chi 2: 5 lá**, **chi 3: 3 lá**. Chi 1 phải mạnh hơn chi 2; chi 2 phải
  mạnh hơn chi 3. Sai số lá hoặc sai thứ tự sức mạnh là **binh lủng**.
- Với chi 5 lá, sức mạnh tăng dần: mậu thầu → đôi → thú (hai đôi) → sám cô → sảnh → thùng →
  cù lũ → tứ quý → thùng phá sảnh. Với chi 3 lá, chỉ tính mậu thầu, đôi, sám cô khi so chi thường;
  ba lá liên tiếp hay đồng chất chỉ có ý nghĩa trong bài tới trắng tương ứng.
- A–2–3–4–5 là sảnh thấp nhất; 10–J–Q–K–A là sảnh cao nhất. Bộ cùng loại so phần tạo bộ trước,
  rồi so các lá lẻ từ cao xuống thấp. Hai chi ngang sức là hoà.
- Mọi người xếp bài cùng lúc và chỉ thấy bài của mình. Người đã xác nhận chờ các người còn lại;
  khi tất cả sẵn sàng hoặc hết giờ, bàn mới lật bài và chấm điểm. Khán giả cũng chỉ thấy bài úp
  trước lúc lật.
- Một ván gồm số vòng đã chọn cho phòng; mỗi vòng chia lại 13 lá. Người có tổng điểm cao nhất
  sau vòng cuối thắng ván; bằng điểm thì cùng thắng. Người rời giữa ván chịu thua vòng đang chơi,
  những người còn lại tiếp tục. Bản đầu không có cược tiền hoặc thao tác bỏ bài.

### Điểm mặc định

- So từng cặp người, từng chi cùng vị trí: thắng được **+1**, thua **−1**, bằng nhau **0**. Thắng
  cả ba chi trước một người được thêm **+3** (“sập 3 chi”): tổng cặp đó là +6/−6.
- Trước khi xác nhận, game cảnh báo bài lủng nhưng vẫn cho người chơi quyết định nộp bài. Bài
  lủng thua **6 điểm trước mỗi đối thủ có bài hợp lệ**; hai bài lủng gặp nhau không tính điểm.
  Nếu đối thủ có bài tới trắng, tính điểm tới trắng thay cho mức phạt lủng.
- Điểm của vòng là tổng kết quả với từng đối thủ; điểm ván cộng qua các vòng. Màn kết quả cho
  thấy từng chi và từng cặp người để người chơi kiểm tra được điểm.

### Thưởng và bài tới trắng

Triển khai sau phần so chi cơ bản, rồi đưa vào bộ luật mặc định trước khi đánh dấu game `ready`.
Mức điểm dưới đây là lựa chọn cho game, dựa trên [mục phiên bản Việt Nam của Pagat](https://www.pagat.com/partition/pusoy.html#variations)
và danh sách bài đặc biệt trong [bài Mậu Binh](https://vi.wikipedia.org/wiki/M%E1%BA%ADu_binh).

| Trường hợp thắng chi | Điểm chi đó thay cho +1 |
| --- | ---: |
| Sám cô chi 3 | +3 |
| Cù lũ chi 2 | +2 |
| Tứ quý chi 1 / chi 2 | +4 / +8 |
| Thùng phá sảnh chi 1 / chi 2 | +5 / +10 |

**Tới trắng** được xét trước so chi thường: ba sảnh, ba thùng, sáu đôi, năm đôi và một sám cô,
sảnh rồng 13 giá trị từ 2 đến A, và sảnh rồng đồng chất. Lần lượt nhận 3, 3, 3, 6, 13 và 26
điểm trước mỗi đối thủ không có bài tới trắng. Hai bài tới trắng gặp nhau: loại có điểm cao hơn
thắng theo mức điểm của loại đó; cùng loại thì hoà. Một bộ chỉ nhận mức tới trắng cao nhất, không
cộng thêm điểm so chi hoặc thưởng chi. Các biến thể như “đồng màu 12/13 lá” trong bài tham khảo
được để ngoài bộ luật mặc định vì mức thưởng không thống nhất.

## Trải nghiệm trên bàn

- Bàn hiện ba vùng **chi 1 / chi 2 / chi 3** cùng số lá và tên bộ bài đang có; khay 13 lá luôn
  nhìn rõ trên điện thoại. Chạm chọn rồi chạm vào chi hoặc kéo thả đều xếp được; đổi chỗ, hoàn tác
  và xếp lại nhanh trước khi xác nhận.
- Hiện rõ chi nào làm bài lủng và vì sao. Sau khi xác nhận, người chơi vẫn thấy bài của mình;
  bài và cách xếp của đối thủ luôn úp cho tới lúc lật.
- Lật lần lượt ba chi, tô dấu thắng/thua/hoà và hiện tổng điểm theo từng đối thủ. Người xem vào
  giữa vòng thấy đúng trạng thái hiện tại; vào sau lúc lật thấy kết quả ngay.
- Phòng chọn 1, 3 hoặc 5 vòng và 60 hoặc 90 giây xếp bài; mặc định 5 vòng, 90 giây. Hết giờ tự
  chốt cách xếp **hợp lệ** đã chuẩn bị cho người chưa xác nhận để ván không đứng mãi. Có thể thêm
  bot để đủ 2–4 ghế; bot cũng xếp bài hợp lệ và xác nhận trong cùng thời gian với người thật.

### Panel luật tính điểm và nhịp ván

- Có một **panel luật tính điểm** riêng, mở/đóng bằng nút trên bàn, kể cả trước khi xác nhận bài.
  Panel liệt kê điểm từng chi, sập 3 chi, binh lủng, thưởng chi và các loại tới trắng; chỉ hiện
  luật của phòng hiện tại. Mỗi client tự mở hoặc đóng panel, không làm thay đổi bàn của người khác.
- Chuyển pha có chữ lớn ngắn gọn: **Chia bài → Xếp bài → Lật bài → Kết quả**. Cut-in 2D tạo điểm
  nhấn cho bài tới trắng, sập 3 chi hoặc bộ thắng đặc biệt; hiệu ứng chỉ xuất hiện sau khi kết quả
  được công bố, không tiết lộ bài kín.
- Đồng hồ xếp bài luôn dễ thấy. Mười giây cuối đổi màu và nổi nhịp; ba giây cuối phóng lớn từng
  số cùng âm nhấn vừa phải. Khi hết giờ, bàn chốt bài theo luật rồi chuyển pha rõ ràng; hiệu ứng
  không kéo dài hoặc thay đổi thời hạn thật của vòng.

## Hình ảnh và âm thanh 2D

- `assets/island.webp` là đảo Mậu Binh riêng: bàn bài gỗ sơn đỏ với ba hàng 5–5–3 trên đảo nổi;
  ảnh gốc và prompt ở `sources/`. Đây là hình minh họa 2D, không cần dựng model.
- Dùng bài 2D dễ đọc: mặt bài sắc nét, mặt sau riêng cho Mậu Binh, nền bàn gỗ/giấy và dấu chi
  nhẹ. Số, chất, tên chi và điểm được vẽ bằng chữ/ký hiệu trong game để luôn rõ ở nhiều cỡ màn
  hình; không đóng chữ vào ảnh.
- Chuyển động ngắn cho chia bài, đặt lá vào chi, úp bài, lật từng chi và cộng điểm. Lá bài di
  chuyển trên bàn bằng hoạt ảnh 2D; các hiệu ứng không làm lộ bài kín hoặc kéo dài thời gian chờ.
- Âm thanh tập trung vào xào/chia, đặt bài, xác nhận, lật bài và công bố điểm; không cần nhạc hay
  hiệu ứng ồn ở từng thao tác sắp xếp nhỏ.

## Thứ tự triển khai

1. **Luật cốt lõi:** chia bài kín, xếp 5–5–3, nhận diện bộ, kiểm tra binh lủng, so chi và tính
   điểm thường cho 2–4 người.
2. **Bàn chơi:** xếp bài bằng chạm/kéo, xác nhận đồng thời, lật bài, bảng điểm từng cặp, panel
   luật tính điểm và nhiều vòng; kiểm tra điện thoại, máy tính, khán giả và kết nối lại.
3. **Bài đặc biệt:** thưởng chi, tới trắng và các trường hợp hai người cùng có bài đặc biệt;
   hiển thị bảng luật/điểm trong phòng.
4. **Hoàn thiện:** bot, đồng hồ và hiệu ứng giây cuối, cut-in chuyển pha/kết quả, xử lý người rời
   bàn, đồ họa và âm thanh 2D.

## Tiêu chí hoàn thành

Một phòng 2–4 ghế chơi được trọn ván với người thật hoặc bot; bot xếp và nộp bài hợp lệ. Trước
lúc lật, mỗi ghế chỉ thấy bài của mình và khán giả không thấy bài kín. Luật tính điểm xem được
trong panel bật/tắt; kết quả từng chi và từng điểm đều kiểm tra được. Bài lủng, bài tới trắng và
hết giờ được xử lý thống nhất. Bàn 13 lá vẫn dễ xếp trên điện thoại nhỏ; cut-in, chữ chuyển pha
và giây cuối đồng hồ rõ ràng nhưng không che bài hoặc chặn ván.
Người kết nối lại thấy đúng pha hiện tại mà không lộ bài của đối thủ.
