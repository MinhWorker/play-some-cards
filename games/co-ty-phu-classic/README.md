# Cờ tỷ phú Classic

Hai đến bốn người mua đất, thu tiền thuê và quản lý tài sản trên bàn 40 ô có địa danh Việt Nam.

[Luật chơi, giá đất, xây dựng, tiền thuê và thẻ](RULES.md)

## Tìm thành phần để sửa

```text
src/
  index.ts, client.ts           Đăng ký luật và giao diện
  game/                        Luật thuần, dữ liệu bàn, thẻ, máy và đồng hồ
  scenes/
    CoTyPhuClassicView.ts       Điều phối scene, bố cục và luồng thao tác
    Setup.ts                   Tạo phòng và tuỳ chỉnh
    CityBackground.ts          Scene nền thành phố, mây trôi và đèn cửa sổ
    board/                     Ô bàn, giá trên ô, ký hiệu chủ đất, điện/nước
    effects/                   Nền trời, phát sáng, chuyển tiền, âm thanh và cửa nhà tù
    hud/                       Thẻ đất nổi, bảng thuê và thao tác quản lý đất
    presentation/              Xúc xắc, rút thẻ, thông báo và hàng đợi tài sản
assets/                        Ảnh và âm thanh dùng trực tiếp
sources/                       Script kết xuất và nguồn ảnh
```

| Muốn sửa | File |
| --- | --- |
| Tiền khởi điểm, địa danh, giá mua/xây/thuê, nhóm màu | `src/game/model.ts` |
| Bảng chọn một/nhiều tài sản và tổng tiền thế chấp | `src/scenes/hud/MortgagePanel.ts` |
| Xác nhận mở đấu giá tài sản | `src/scenes/hud/AuctionConfirmPanel.ts` |
| Icon giấy sở hữu, nhà/búa xây dựng, đấu giá và ngân hàng trên nút đất | `src/scenes/hud/PropertyActionIcons.ts` |
| Mua/xây/thế chấp/trao đổi | `src/game/CoTyPhuClassicGame.ts` |
| Thuế, di chuyển, tiền thuê và hiệu lực thẻ | `src/game/rules.ts` |
| Nội dung thẻ | `src/game/cards.ts` |
| Vị trí ô và biểu tượng in trên bàn | `sources/render_board_25d.py` → `src/scenes/board/boardGeometry.ts` |
| Giá hiện trên bàn | `src/scenes/board/BoardPrices.ts`, `boardAmounts.ts` |
| Trăng/mặt trời nối bộ đất, dấu góp bến xe | `src/scenes/board/MonopolySymbols.ts`, `StationBidMarks.ts`, `SurfaceMarks.ts` |
| Badge men màu và nhà/khách sạn sứ trắng | `sources/render_deed_layers.py` → `src/scenes/board/DeedLayers.ts`, `deedLayerGeometry.ts` |
| Biểu tượng điện/nước và các ô đặc biệt | `src/scenes/board/SpecialSymbols.ts` |
| Ăn mừng, pháo hoa và đếm tổng tài sản | `src/scenes/effects/VictoryEffect.ts`, `src/game/rules.ts` |
| Song sắt khi vào/ra tù | `src/scenes/effects/JailGateEffect.ts` |
| Nền thành phố có hoạt ảnh sau bàn | `src/scenes/CityBackground.ts` |
| Quầng sáng | `src/scenes/effects/glow.ts` |
| Tiền bay và âm thanh tiền | `src/scenes/effects/` |
| Thẻ thông tin đất và bảng thuê | `src/scenes/hud/` |
| Tên, avatar, số tiền và phối cảnh bảng người chơi | `src/scenes/hud/PlayerPanel.ts` |
| Hoa văn nền bảng người chơi | `src/scenes/hud/PlayerPanelPattern.ts` |
| Hoạt ảnh xúc xắc và rút thẻ | `src/scenes/presentation/` |

Test đặt cạnh file được kiểm tra với đuôi `.test.ts`. Tọa độ bàn được tạo bởi Blender;
chỉnh script kết xuất rồi tạo lại ảnh và tọa độ cùng nhau.

## Phát triển

Chạy `npm run dev` ở gốc repo, chơi thử ở
`http://localhost:5033/?play=co-ty-phu-classic&players=4`. Kiểm tra bằng `npm run check`.
Bàn chơi/sandbox dùng scene thành phố riêng thay bầu trời chung: mây trôi chậm và
đèn cửa sổ đổi độ sáng. Nền phủ hết lề màn hình, tiếp tục qua ván mới và dừng khi rời bàn;
màn tạo phòng/tuỳ chỉnh vẫn dùng bầu trời chung.

Hướng dẫn SDK và Dev Console: [tạo game](../../docs/making-a-game.md).

Lệnh riêng của game trong `src/game/dev.ts`: `dice`, `tp`, `cash`, `card`;
danh mục `square` và `card` dùng cho gợi ý bằng Tab.

## Tài nguyên

`assets/` chứa ảnh và âm thanh dùng trực tiếp; `sources/` chứa prompt và script nguồn.
`sources/render_board_25d.py` tạo `assets/board-25d.webp` cùng
`src/scenes/board/boardGeometry.ts`; các ô không mua được dùng vật liệu kim loại xước
và ánh sáng Blender, Khí vận dùng vàng kim, Sân bay dùng cyan. Tấm kim loại mỏng có
đường bao bo góc theo mặt ô và gờ bắt sáng nhỏ. `sources/render_deed_layers.py` dùng cùng
camera và ánh sáng để tạo atlas `deed-layers.webp`/`.json` gồm 240 frame badge men màu,
nhà và khách sạn sứ trắng, cùng `deedLayerGeometry.ts`. Khi sửa camera, kích thước ô
hoặc ánh sáng, chạy lần lượt hai script để ảnh và tọa độ khớp nhau:

```sh
blender -b -t 4 --python games/co-ty-phu-classic/sources/render_board_25d.py
blender -b -t 4 --python games/co-ty-phu-classic/sources/render_deed_layers.py
```

Màu bộ dùng than chì, cyan, tím lan, tím violet, magenta, bạc, tím mận và xanh dầu,
xa các tông đỏ san hô, xanh dương, xanh lá và vàng của người chơi.
Mỗi liên kết trong bộ đất dùng một cặp trăng–mặt trời tối màu in trên mặt ô.
Khi sở hữu từ hai ô cùng bộ, các cặp tương ứng sáng vàng; đủ ba ô thì cả hai cặp sáng.
Các ô cùng bộ cách nhau bởi ô đặc biệt vẫn thể hiện liên kết. Dấu góp bến xe dùng bốn
vị trí cố định, có khoảng trống đều; người góp gần nhất hiện tam giác, các người khác hiện chấm tròn.
Cả hai loại dấu được chiếu theo phối cảnh và nằm trong `BOARD_FACES`.
Nút mua có icon giấy sở hữu; nút xây có icon nhà và búa xây dựng.
Nút mua/xây thiếu tiền vẫn hiện nhưng bị khóa, ghi “Ko đủ” kèm icon tiền; nút trả 50 ra tù cũng vậy.
Thông báo giữa bàn xuống dòng theo từ và cân độ dài dòng, tránh tách riêng một ký tự.
`sources/render_pawns.py`, `render_plane.py` và `render_hud_icons.py` kết xuất các đối tượng.
Thêm `-- --front` khi chạy `render_pawns.py` bằng Blender để kết xuất bốn pawn chính diện,
nền trong suốt, dùng riêng cho màn nhảy chiến thắng (`pawn-front-*.webp`).
Xúc xắc được render 3D trực tiếp trong `Dice3D.ts`: mỗi lần gieo chọn ngẫu nhiên một trong
bốn chuyển động lăn, tung vòng cung, nảy nhiều nhịp và xoáy. Tất cả cùng dừng ở mặt trên
theo kết quả server; quỹ đạo nằm trong `diceMotion.ts`.
Cả bốn kiểu tung dùng một lần tiếng lăn gốc `tycoon-dice.wav`; âm thanh dừng khi hủy lượt.
`sources/make_audio.py` tạo bộ âm thanh; `sources/make_audio_preview.py` tạo
[trang nghe thử](sources/audio-preview/index.html).
Tiếng rút/lật thẻ dùng lại từ Tiến Lên; nhạc thắng dùng lại `mau-binh-standings.mp3` của Mậu Binh.
Tiếng nhận tiền, mua và vào tù dùng các nguồn Pixabay trong `sources/audio-preview/`;
tiếng máy bay cắt từ `assets/audio/sfx/pixabay-plane.mp3` ở gốc repo.
`sources/make_release_audio.py` tự tổng hợp hai tiếng chốt khóa và tiếng bánh lăn cửa thép
cho `tycoon-release.wav`. Hiệu ứng mở cửa chạy xong trước animation xúc xắc của lượt ra tù;
mãn hạn ở lần thử thứ ba không thu phí 50.
Hai tiếng thông báo trao đổi/nhận thẻ dùng các file Freesound trong `assets/audio/sfx/`.
Nguồn bên thứ ba và giấy phép: [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).
