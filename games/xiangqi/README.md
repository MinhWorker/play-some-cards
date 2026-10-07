# Cờ Tướng

Cờ Tướng cho hai người, chơi với bạn hoặc máy.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Nước đi, chiếu và nước hợp lệ | `src/game/rules.ts` |
| Lặp thế cờ, chiếu dai và đuổi dai | `src/game/referee.ts` |
| Lượt, xin hoà, đầu hàng và kết thúc | `src/game/XiangqiGame.ts` |
| Máy và tuỳ chọn | `src/game/bot.ts`, `model.ts` |
| Điều phối bàn | `src/scenes/XiangqiView.ts` |
| Cảnh đình và vườn riêng qua SDK | `src/scenes/XiangqiBackground.ts` |
| Vỡ quân và thông báo chiếu | `src/scenes/shatter.ts`, `cutin.ts` |
| Kết quả, tạo phòng và màu | `src/scenes/ResultPanel.ts`, `Setup.ts`, `theme.ts` |

`src/index.ts` đăng ký game phía server; `src/client.ts` đăng ký giao diện.
`assets/` chứa hình và âm thanh dùng trực tiếp, `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run dev` ở gốc repo rồi mở `http://localhost:5033/?play=xiangqi&players=2`.
Kiểm tra bằng `npm run check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Hình bàn gỗ óc chó viền nổi mỏng và cảnh đình lúc hoàng hôn sinh bằng Image Gen từ prompt
trong `sources/prompts.json`; đường bàn vẽ theo `src/scenes/theme.ts`.
Quân cờ là model đĩa đá có cạnh vát, vòng màu và chữ Hán tô màu, dựng bằng Blender.
Màu trắng ngà nằm ngay trong vật liệu, giữ nguyên khi di chuyển, vỡ quân, chiếu tướng và trên
bảng kết quả. Cặp atlas `pieces.webp`/`pieces.normal.webp` cùng `pieces.json` chứa 14 quân
Đỏ/Đen; normal map raw, lossless và đục dùng đèn mềm từ trên trái cùng đèn đi theo con trỏ
như Cờ Vua. Tất cả bóng tiếp xúc nằm ở layer riêng dưới toàn bộ quân, kể cả khi nhấc quân
hoặc ăn quân. Chữ trên sông kết xuất bằng Blender; nút dùng lại từ Tiến Lên.

Tái tạo quân và bóng bằng `npm run blender -- xiangqi`; chỉ bake atlas bằng
`npm run blender -- xiangqi pieces`. Cần phông Noto Sans CJK Bold (SIL Open Font License),
mặc định ở `/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc`; có thể chọn phông CJK khác
bằng `PSC_XIANGQI_FONT`. Script nằm ở `sources/render_pieces.py`, PNG trung gian ở
`.blender/xiangqi/`; xem [hướng dẫn Blender](../../docs/making-a-game.md#kết-xuất-blender-và-normal-map).
Tiếng di chuyển, vỡ quân và nhạc thắng tổng hợp bằng code.
Thông báo chiếu tướng/chiếu bí theo lối tranh thủy mặc: cuộn giấy mở ra giữa hai trục gỗ, vệt
mực nhạt quét ngang, quân đang chiếu hiện bên trái, rồi hai chữ ("CHIẾU", "TƯỚNG!" hoặc "BÍ!")
lần lượt nện xuống bằng nét bút lông, mỗi cú làm cuộn giấy rung và văng mực; triện đỏ chữ 將 đóng
cùng chữ thứ hai, sau đó cuộn giấy cuộn lại. Hình vẽ bằng code (`src/scenes/cutin.ts`); chữ dùng
phông Comforter Brush (Google Fonts, có đủ dấu tiếng Việt), tải khi mở bàn; chưa tải xong hoặc
không có mạng thì dùng phông có chân của máy.
Âm thanh dùng trực tiếp từ `assets/`.

## Bố cục bàn chơi

Bàn tận dụng chiều cao giữa các nút ở góc màn hình khi đủ chỗ; thanh HUD nhiều dòng và sandbox
giữ bàn bên dưới. Lưới mở rộng sát viền để quân lớn hơn trên điện thoại xoay ngang.
Bên trái là hai người chơi, dấu chủ phòng, vòng đánh dấu bên tới lượt, thời gian và số nước.
Bố cục người chơi chuyển sang hàng ngang khi thiếu chiều cao hoặc tăng cỡ HUD.
Bên phải là trạng thái và các nút có vùng chạm lớn. Cảnh nền riêng phủ cả phần ngoài khung và
vùng tai thỏ, giữ tỉ lệ khi đổi kích thước; màn tạo phòng vẫn dùng nền chung của ứng dụng.
