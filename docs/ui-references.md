# Xóm Đảo: giao diện tham khảo từ game thật

Ảnh do AI tạo cho thấy không khí, nhưng thường không dùng được cho giao diện thật: mọi thứ đều to,
đều có khung gỗ, chữ ít và không có chỗ cho thông tin thật. Tài liệu này ghi lại những gì game
mobile đang chạy thật làm, để [experience.md](experience.md) bám theo.

Ảnh chụp màn hình là của các hãng game, **không đưa vào repo**. Chủ dự án có bản lưu trên máy ở
`.claude/references/ui/`; người khác xem theo link nguồn bên dưới.

## Nguồn

| Ảnh (trên máy) | Game | Nguồn |
| --- | --- | --- |
| `lienquan-lobby.png` | Liên Quân Mobile: sảnh chờ | [Google Play](https://play.google.com/store/apps/details?id=com.garena.game.kgvn) |
| `lienquan-arcade-modes.jpg` | Liên Quân: danh sách chế độ Giải trí | [Wiki](https://strikeofkings.fandom.com/wiki/File:Duo_Race_lobby.jpg) |
| `stumble-lobby-old.png` | Stumble Guys: sảnh bản cũ | [Wiki](https://stumbleguys.fandom.com/wiki/File:Lobby_menu_-_0.3_-_Stumble_Guys.png) |
| `stumble-party.png` | Stumble Guys: tạo/vào nhóm bằng mã | [Wiki](https://stumbleguys.fandom.com/wiki/File:Party_Screenshot.png) |
| `stumble-events.png` | Stumble Guys: thẻ sự kiện | [Wiki](https://stumbleguys.fandom.com/wiki/File:Screenshot_Events.png) |
| `stumble-customize.png` | Stumble Guys: trang phục | [Wiki](https://stumbleguys.fandom.com/wiki/File:Screenshot_20260205-132602.png) |
| `stumble-ingame.png` | Stumble Guys: HUD trong trận | [Google Play](https://play.google.com/store/apps/details?id=com.kitkagames.fallbuddies) |
| `brawlstars-modes.png` | Brawl Stars: thẻ chế độ + bản đồ | [Google Play](https://play.google.com/store/apps/details?id=com.supercell.brawlstars) |
| `brawlstars-reward-vault.png` | Brawl Stars: bảng phần thưởng | [Wiki](https://brawlstars.fandom.com/wiki/File:Brawl_Pass_Vault-Menu.png) |
| `ludoking-ingame.png`, `ludoking-6p.png` | Ludo King: bàn cờ 4 và 6 người | [Google Play](https://play.google.com/store/apps/details?id=com.ludo.king) |
| `clashroyale-result.png` | Clash Royale: kết quả trận | [Google Play](https://play.google.com/store/apps/details?id=com.supercell.clashroyale) |

## Bài học

### Sảnh chờ (Liên Quân, Stumble Guys)

- **HUD mỏng và nhỏ, hình nền to.** Nhân vật và cảnh chiếm gần hết màn hình. Thanh tiền, thư,
  cài đặt chỉ là một hàng icon nhỏ ở mép trên phải, không có khung to.
- **Chỉ một thứ được to và lộng lẫy: nút chơi chính** ở góc dưới phải ("ĐẤU HẠNG", "Play"). Ngay
  bên trái nó là nút **chọn chế độ** nhỏ hơn ("Chọn chế độ", "Đấu thường"), chính là thẻ "trò đang
  chọn" của Xóm Đảo.
- **Hàng nút dưới trái là chữ + icon nhỏ, nền trong mờ** (Túi đồ, Tướng, Trang bị, Nhiệm vụ),
  không phải những ô gỗ to.
- **Cột phải là các banner có tranh** (Sự kiện, Sổ sứ mệnh, Shop, Hoạt động), có nhãn nhỏ "Free",
  "New" và chấm đỏ. Sự kiện được quảng bá bằng tranh, không bằng chữ.
- Thanh chat mỏng ở dưới trái, ngay trên hàng nút.
- Stumble Guys bản cũ cho thấy bản tối giản vẫn chạy được: thanh dọc bên trái (Shop, Customize,
  Play, Social, Settings) + nhân vật + nút Play.

### Chọn chế độ và bản đồ (Liên Quân, Brawl Stars)

- Mỗi chế độ là một **thẻ dọc cao gần bằng màn hình**, có tranh, tên, thời lượng ("8–12 phút"),
  ổ khoá và giờ mở cho chế độ chưa mở; kéo ngang, có mũi tên.
- Nút **"?"** trên thẻ mở một bảng giải thích ngắn có hình minh hoạ, không phải trang luật dài.
- Góc trên phải có ô **nhập mã phòng** (Lobby ID) để vào phòng của bạn bè.
- Brawl Stars ghi hai tầng trên mỗi thẻ: **tên chế độ** to + **tên bản đồ** nhỏ, kèm icon chế độ
  có màu riêng. Cùng ý với "thể loại → trò" của Xóm Đảo.

### Phòng với bạn bè (Stumble Guys)

- Hai bảng cạnh nhau: **Tạo nhóm** (nhận mã để gửi bạn) và **Vào nhóm** (ô nhập mã + nút Join).
  Đơn giản, không cần danh sách phòng công khai.

### Trong trận

- **Ludo King (cờ bàn):** bàn cờ vuông ở giữa, cao gần hết màn hình. **Bốn ô người chơi nằm ở bốn
  góc**, sát màu quân của họ: ảnh, tên, cấp, số tiền, chấm lượt; xúc xắc nằm trong ô của người
  đang đi. Nút menu chỉ là một tab nhỏ ở mép trên trái. Bản 6 người xếp 3 ô mỗi bên.
- **Stumble Guys (hành động):** mục tiêu ở trên trái, bộ đếm ở trên phải, cần điều khiển ở dưới
  trái, nút nhảy ở dưới phải. **Không có nút nào khác.** Cả bốn góc đều thuộc về trò.

### Phần thưởng và kết quả (Brawl Stars, Clash Royale)

- Phần thưởng là **hàng thẻ có icon to + một dòng chữ ngắn**, nút xác nhận màu xanh lá to ở giữa
  dưới.
- Kết quả trận ngắn: thắng/thua, người chơi, phần thưởng, hai nút. Không có bảng điểm dài.

## Hệ quả cho Xóm Đảo

1. **Gỗ, sơn mài, dây thừng chỉ dùng cho thứ quan trọng:** nút CHƠI, bảng lớn (kết quả, chi tiết
   trò), banner sự kiện. Icon, thanh tiền, hàng nút nhỏ là **hình phẳng đơn giản** theo màu gỗ và
   kem, nền trong mờ. Ảnh concept vẽ mọi thứ bằng gỗ là quá tay.
2. **Trong trận, phần khung chỉ giữ một nút menu nhỏ ở góc trên trái** (rời phòng, âm thanh, cài
   đặt, luật, biểu cảm nằm trong đó). Ba góc còn lại và hai bên là của trò: trò bàn đặt ô người
   chơi ở góc như Ludo King, trò hành động đặt cần điều khiển và nút như Stumble Guys.
3. **Vào phòng bằng mã** là đường chính để chơi với bạn bè, bên cạnh link mời.
4. **Thẻ trò mang thông tin thật:** tên, số người, thời lượng một ván, số người đang chơi, ổ khoá.
   Thêm nút "?" mở bảng giới thiệu ngắn có hình.
5. **Sự kiện quảng bá bằng banner có tranh** ở cột phải của sảnh.
