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
| Icon búa đấu giá và ngân hàng trên nút quản lý đất | `src/scenes/hud/PropertyActionIcons.ts` |
| Mua/xây/thế chấp/trao đổi | `src/game/CoTyPhuClassicGame.ts` |
| Thuế, di chuyển, tiền thuê và hiệu lực thẻ | `src/game/rules.ts` |
| Nội dung thẻ | `src/game/cards.ts` |
| Vị trí ô và biểu tượng in trên bàn | `sources/render_board_25d.py` → `src/scenes/board/boardGeometry.ts` |
| Giá hiện trên bàn | `src/scenes/board/BoardPrices.ts`, `boardAmounts.ts` |
| Viền ô, dấu chủ đất và biểu tượng đặc biệt | `src/scenes/board/` |
| Song sắt khi bị đưa vào tù | `src/scenes/effects/JailGateEffect.ts` |
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
Hướng dẫn SDK và Dev Console: [tạo game](../../docs/making-a-game.md).

Lệnh riêng của game trong `src/game/dev.ts`: `dice`, `tp`, `cash`, `card`;
danh mục `square` và `card` dùng cho gợi ý bằng Tab.

## Tài nguyên

`assets/` chứa ảnh và âm thanh dùng trực tiếp; `sources/` chứa prompt và script nguồn.
`sources/render_board_25d.py` tạo `assets/board-25d.webp` cùng
`src/scenes/board/boardGeometry.ts`; sửa bàn thì kết xuất hai phần cùng nhau.
`sources/render_pawns.py`, `render_plane.py` và `render_hud_icons.py` kết xuất các đối tượng.
`sources/make_audio.py` tạo bộ âm thanh; `sources/make_audio_preview.py` tạo
[trang nghe thử](sources/audio-preview/index.html).
Tiếng rút/lật thẻ dùng lại từ Tiến Lên; nhạc thắng dùng `tien-len-standings.mp3`.
Tiếng nhận tiền, mua và vào tù dùng các nguồn Pixabay trong `sources/audio-preview/`;
tiếng máy bay cắt từ `assets/audio/sfx/pixabay-plane.mp3` ở gốc repo.
Hai tiếng thông báo trao đổi/nhận thẻ dùng các file Freesound trong `assets/audio/sfx/`.
Nguồn bên thứ ba và giấy phép: [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).
