# Xóm Đảo: khung trải nghiệm

> Trạng thái: Phase 0, bản nháp chờ duyệt. Đây là cái khung chung mà hub và **mọi** trò, sự kiện
> sau này phải khớp: thế giới được tổ chức thế nào, HUD nằm đâu, người chơi vào một trò ra sao,
> phần thưởng hiện thế nào, và mọi thứ trông ra sao. Nó không mô tả luật của trò nào.
>
> Ảnh concept trong tài liệu này cho thấy **hướng đi**, không phải bản vẽ chính xác tới từng điểm
> ảnh. Chữ, số và bố cục cụ thể do các bảng và quy tắc bên dưới quyết định. Prompt tạo ảnh:
> [concepts/prompts.json](concepts/prompts.json).
>
> Tầm nhìn: [vision.md](vision.md). Kế hoạch: [roadmap.md](roadmap.md). Giao diện game thật đã
> tham khảo: [ui-references.md](ui-references.md). Khi ảnh concept và tài liệu đó khác nhau, theo
> tài liệu đó: ảnh AI đẹp nhưng không thực tế.
>
> **Hướng nghệ thuật** ở [art-direction.md](art-direction.md). Ảnh sảnh vòng đảo, ván đấu, kết quả,
> Bến và bộ thành phần đã vẽ theo nó. Ảnh chọn trò, Nhà, sự kiện còn theo bản cũ (nút gỗ sáng, chữ
> nối bằng dấu chấm): chỉ xem bố cục.

## Nguyên tắc

1. **Học bố cục từ game mobile nổi tiếng, vẽ lại bằng văn hoá Việt.** Sảnh chờ, chọn chế độ, chọn
   bản đồ, nút "Chơi" to ở góc dưới phải: người chơi game mobile (MOBA, bắn súng sinh tồn) đã quen
   tay. Nhưng mọi thứ là gỗ, tre, dây thừng, sơn mài, giấy dó, nón lá, đèn lồng.
2. **HUD mỏng, hình to, một nút lộng lẫy.** Như game thật: icon và hàng nút nhỏ, phẳng, nền trong
   mờ; cảnh và nhân vật chiếm phần lớn màn hình; chỉ nút CHƠI và vài bảng lớn được làm bằng gỗ, sơn
   mài, dây thừng.
3. **Trong ván, màn hình là của trò.** Phần khung (shell) chỉ giữ một nút menu nhỏ ở góc trên trái.
4. **Một lần chạm để vào chơi.** Nút **CHƠI** ở sảnh luôn mang trò đang chọn (mặc định là trò vừa
   chơi). Đổi trò là việc riêng, không chặn đường vào chơi.
5. **Một ngôn ngữ hình ảnh.** Mọi trò, mọi sự kiện dùng chung vật liệu, bảng màu, font, nút và âm
   thanh giao diện. Mỗi trò có "chất" riêng trong thẻ trò và bàn chơi của nó, không phải trong HUD.
6. **Mọi chuyển cảnh đều có chuyển động.** Không màn trắng, không vòng xoay tải giữa màn hình.

## Sảnh: vòng đảo thể loại

![Sảnh chờ: các đảo thể loại trên một vòng tròn, đảo Bài đang chọn ở giữa](concepts/lobby-ring.webp)

Thế giới có ba tầng, giống "chế độ chơi" và "bản đồ" của game mobile:

| Tầng | Giống trong game mobile | Ở Xóm Đảo |
| --- | --- | --- |
| **Sảnh** | Sảnh chờ, chọn chế độ ngay trên đó | Biển có **vòng đảo thể loại**, xoay được |
| **Thể loại** | Chế độ chơi (Cổ điển, Giải trí…) | Một **đảo thể loại** trên vòng: Cờ, Bài, rồi các thể loại phụ |
| **Trò** | Bản đồ trong một chế độ | Một **thẻ trò** trong danh sách kéo ngang của thể loại |

Sảnh không có đảo trung tâm hay nhân vật. Các đảo thể loại cùng cỡ, xếp đều trên một vòng tròn nằm
nghiêng trên biển, nhìn chéo từ trên như một băng chuyền:

- Vuốt ngang hoặc chạm một đảo để **xoay vòng**. Đảo ở chính giữa phía trước là **đảo đang chọn**:
  to nhất, sáng nhất, có quầng vàng trên mặt nước và bảng tên. Các đảo khác nhỏ và nhạt dần theo
  độ xa, không có bảng tên.
- Đảo đang chọn quyết định thẻ "trò đang chọn" ở dưới phải. Chạm lại đảo đang chọn, hoặc chạm thẻ,
  thì mở màn chọn trò của thể loại đó.
- **Cờ** và **Bài** là hai thể loại chính: luôn đứng đầu vòng theo thứ tự. Các thể loại phụ nối
  tiếp theo thứ tự trong danh sách thể loại.

| Đảo | Trò |
| --- | --- |
| **Cờ** | Cờ Tướng, Cờ Vua, Cờ Vây, Cờ Đam, Caro, Cờ Cá Ngựa, Cờ tỷ phú, Bắn Tàu |
| **Bài** | Tiến Lên, Mậu Binh, Bài Cào |
| **Sắp có** | Đảo sương mù có ổ khoá, chưa có trò |

Bom Nguyên Tố không hợp với Cờ hay Bài. Nó chờ một thể loại phụ đầu tiên, và tới lúc đó vẫn chơi
trên client Phaser.

Vòng nhận bao nhiêu đảo cũng được: đảo càng nhiều thì vòng càng rộng và đảo phía sau càng nhỏ, nhưng
đảo đang chọn luôn cùng cỡ. Chạm Sắp có chỉ hiện thông báo nhanh "Sắp có".

Quy tắc dữ liệu:

- Danh sách thể loại là dữ liệu của phần lõi (id, tên, ảnh đảo, thứ tự, và **chính** hay **phụ**).
  Hai thể loại chính đứng đầu vòng; thể loại phụ nối theo thứ tự. Thêm một thể loại phụ là thêm
  một dòng và một ảnh đảo; không sửa code sảnh.
- Mỗi trò khai báo nó thuộc thể loại nào. Thêm một trò là thêm một thẻ; không ai vẽ lại sảnh.
- Thể loại chưa có trò nào `ready` cũng hiện là đảo sương mù có ổ khoá. Khi chưa có thể loại phụ
  nào, vòng có thêm đảo Sắp có sau Bài.

Bố cục HUD ở sảnh:

| Vùng | Chứa |
| --- | --- |
| Trên trái | Ảnh đại diện, tên, chip cấp → **Nhà** |
| Trên phải | Một hàng icon nhỏ: xu, ngọc, hộp thư, ⚙ |
| Cột trái | Sự kiện, Nhiệm vụ, Bạn bè (icon tròn nhỏ, có chấm đỏ) |
| Cột phải | **Banner có tranh**: sự kiện đang mở, Chợ, Túi đồ; nhãn nhỏ "Mới", "Miễn phí" |
| Dưới trái | Hàng nút icon vuông có chữ dưới: Nhà, Chợ, Đình, Bến |
| Dưới phải | Thẻ trò đang chọn (đầu: tên; thân: tranh; chân: số người, thời lượng, số đang chơi) + nút **CHƠI** thật to + **Tạo phòng** |
| Giữa | Vòng đảo thể loại |

Các màn khác ngoài sảnh và ván đấu (chọn trò, Nhà, Chợ, Bến, kết quả) chỉ có ← ở trên trái và hàng
icon tiền + ⚙ ở trên phải.

Các nơi chốn giữ tên làng: **Nhà** (hồ sơ, túi đồ), **Chợ** (cửa hàng), **Đình** (tin tức, xếp
hạng chung), **Bến** (phòng đang mở, bạn bè online, lời mời). Chúng là nút ở hàng dưới trái của
HUD.

## Đường đi của người chơi

```
Mở game ─► Sảnh (vòng đảo)
  │
  ├─ CHƠI ──────────────────────────► Ghép phòng ─► Ván đấu ─► Kết quả ─┬─► Chơi tiếp
  │   (trò đang chọn)                                                     └─► về Sảnh
  │
  ├─ xoay vòng ─► đảo đang chọn đổi, thẻ dưới phải đổi theo
  ├─ chạm đảo đang chọn / thẻ trò đang chọn
  │      ▼
  │   Chọn trò: tab thể loại + danh sách thẻ kéo ngang
  │      ├─ Chọn ──────► về Sảnh, thẻ dưới phải đổi thành trò mới
  │      ├─ Tạo phòng ─► tuỳ chỉnh phòng ─► phòng chờ (có mã phòng) ─► Ván đấu
  │      └─ Danh sách phòng ─► vào phòng
  │
  ├─ Bến ─► Nhập mã phòng / bạn bè đang online / lời mời
  │
  ├─ Tạo phòng (ở Sảnh) ─► tuỳ chỉnh phòng của trò đang chọn
  └─ Nhà / Chợ / Bến / Sự kiện …  ─► màn nơi chốn ─► ← về Sảnh
```

- **CHƠI** = ghép nhanh: vào phòng còn chỗ của trò đang chọn, không có thì mở phòng mới, chờ một
  lúc rồi cho máy ngồi ghế trống.
- Nút ← luôn về đúng một bước. Từ ván đấu về sảnh có hỏi xác nhận nếu đang giữa ván.
- Chơi với bạn bè: phòng nào cũng có **mã phòng** ngắn. Gửi mã hoặc link mời; bạn bè nhập mã ở Bến
  hoặc mở link là vào thẳng phòng. Thoát ra thì về sảnh, với trò đó đang được chọn.

## Khung hình

Giữ hệ khung của [ui-guide.md](ui-guide.md#khung-hình): thiết kế trên khung **cao 720 đơn vị**, lõi
**960 × 720** luôn thấy được, màn rộng hơn chỉ thêm chỗ hai bên. Chỉ chơi màn hình ngang.

Trong Godot: kích thước gốc 960 × 720, `stretch/mode = canvas_items`, `stretch/aspect = expand`.
Bầu trời / mặt biển lấp phần thừa, vẽ tràn dưới tai thỏ; HUD tránh vùng an toàn (safe area).

Cỡ tối thiểu (vùng chạm 88, chữ nhỏ nhất 24…) theo bảng
[Đơn vị và cỡ tối thiểu](ui-guide.md#đơn-vị-và-cỡ-tối-thiểu).

## HUD trong ván

![HUD trong ván đấu](concepts/in-game-hud.webp)

> Ảnh concept này chỉ để xem không khí. Bố cục theo các quy tắc dưới đây, rút từ Ludo King và
> Stumble Guys ([ui-references.md](ui-references.md#trong-trận)). Người chơi trên máy luôn ở
> **dưới**; ảnh lại vẽ Minh ở trên.

**Phần khung chỉ giữ một thứ: nút menu ☰** ở góc trên trái (88 × 88, sát mép). Menu mở một bảng
chung: rời phòng, âm thanh, cài đặt (cỡ giao diện, lề, chất lượng hình), luật chơi, biểu cảm. Trò
để trống ô vuông đó, còn lại cả màn hình là của trò.

Trò chọn một trong hai bố cục mẫu, để các trò cùng loại trông giống nhau:

| Bố cục | Giữa | Góc và hai bên | Dưới |
| --- | --- | --- | --- |
| **Bàn** (cờ, bài) | Bàn chơi vuông, cao gần trọn khung | Ô người chơi của đối thủ ở các góc hoặc hai bên, sát chỗ ngồi của họ (như Ludo King) | Người chơi trên máy: bài trên tay hoặc ô của mình; nút hành động (Đánh, Bỏ lượt) ở dưới phải |
| **Hành động** (trò hành động như Bom Nguyên Tố, sự kiện) | Cảnh chơi | Mục tiêu trên trái (dưới nút ☰), bộ đếm/thời gian trên phải | Cần điều khiển dưới trái, nút hành động dưới phải |

- Ô người chơi dùng thành phần chung: ảnh đại diện, tên, cấp, vòng thời gian vàng cho người đang
  tới lượt, 👑 cho chủ phòng. Thông tin riêng của trò (số lá bài, xúc xắc) nằm trong ô đó.
- Trong ván không hiện tên trò, tên phòng hay số dư xu.
- Biểu cảm: chạm vào ô của mình, hoặc mở từ menu.

## Chọn trò

![Chọn trò trong thể loại Bài](concepts/genre-select.webp)

- Trên cùng là **tab thể loại** hình biển đảo nhỏ, để đổi thể loại mà không quay ra sảnh: Cờ, Bài,
  rồi các thể loại phụ.
- Giữa là **danh sách thẻ dọc kéo ngang**. Mỗi thẻ: tranh minh hoạ, tên, số người, thời lượng một
  ván ("5–10 phút"), số người đang chơi, nút **?** mở bảng giới thiệu ngắn có hình. Thẻ đang chọn
  to hơn, viền vàng. Trò sắp có là thẻ mờ có ổ khoá ở cuối danh sách.
- Bên phải là **bảng chi tiết** của thẻ đang chọn, cùng một bố cục cho mọi trò:
  - tên, một câu giới thiệu, số người, số phòng đang mở;
  - **Chọn** (đặt làm trò của nút CHƠI);
  - **Tạo phòng** (mở màn tuỳ chỉnh của trò nếu có);
  - **Danh sách phòng**;
  - **Luật** (mở `RULES.md` của trò dưới dạng cuộn giấy).
- Gói `.pck` của trò được tải ngầm ngay khi thẻ được chọn, để lúc bấm CHƠI là vào luôn.

Màn tuỳ chỉnh khi tạo phòng (số người, luật phụ, bot) là một bảng gỗ do trò điền nội dung, dùng ô
lựa chọn và nút chung.

Danh sách phòng (từ bảng chi tiết hoặc từ **Bến**) là một bảng gỗ, mỗi dòng: tranh nhỏ của trò,
tên trò, chủ phòng và số ghế là hai chip riêng, nút "Vào". Bến có thêm ô nhập mã phòng:

![Bến: nhập mã phòng và danh sách phòng đang mở](concepts/room-list.webp)

## Kết thúc ván và phần thưởng

![Kết quả ván đấu](concepts/match-result.webp)

- Phần khung vẽ bảng kết quả. Trò chỉ trả về **thứ hạng** và tuỳ chọn một dòng tóm tắt
  ("Tới trắng!", "Thắng 3 cây"). Trò nào cần màn kết quả riêng (bảng điểm chi tiết) thì khai báo,
  và vẫn phải kết thúc bằng phần phần thưởng chung.
- Phần thưởng do server tính (sổ cái). Xu và tài nguyên **bay** từ bảng vào góc trên phải, số dư
  đếm lên. Có âm thanh xu rơi.
- Hai nút: **Chơi tiếp** (ván mới, cùng phòng) và **Về sảnh**. Ảnh concept còn ghi "Về đảo".

## Nhà: hồ sơ, túi đồ, thành tích, xếp hạng

![Trong Nhà](concepts/home-profile.webp)

- Mở từ ảnh đại diện ở góc trên trái, hoặc nút Nhà ở hàng dưới trái.
- Thẻ hồ sơ bên trái: ảnh đại diện, tên, cấp và thanh tiến độ, vài con số tổng.
- Bên phải là kệ gỗ, chia theo **thẻ đánh dấu** (bookmark) gỗ: Túi đồ, Thành tích, Xếp hạng.
- Túi đồ là các ô trên kệ. Vật phẩm nào cũng có biểu tượng vuông, nền trong suốt, để đặt được vào ô.
- Hồ sơ của người khác (chạm vào ô người chơi) dùng cùng thẻ, chỉ đọc.

## Sự kiện

![Đảo sự kiện Trung Thu](concepts/event-island.webp)

- **Sự kiện** là một thể loại phụ: một đảo trên vòng đảo. Mỗi sự kiện là một thẻ trong thể loại
  này.
- Khi có sự kiện đang mở, đảo Sự kiện sáng lên ở sảnh, có cờ hiệu và số ngày còn lại; banner cột
  phải đổi sang sự kiện, mang màu của nó và chấm đỏ.
- Bảng chi tiết của sự kiện có cùng bố cục với bảng chi tiết trò, nhưng **được đổi màu** (ví dụ
  sơn mài đỏ viền vàng cho Trung Thu) và có thêm **dải phần thưởng** theo mốc.
- Nút chính là **Tham gia**. Bên trong, sự kiện là một trò bình thường và theo mọi quy tắc HUD ở
  trên. Hết ván, kết quả ghi số điểm sự kiện vừa được; mỗi mốc đủ điểm có nút **Nhận**, nhận được
  một lần.
- Khi sự kiện đóng, thẻ của nó biến mất; vật phẩm đã nhận vẫn ở trong túi đồ. Không còn sự kiện nào
  thì đảo Sự kiện chìm vào sương.

## Ngôn ngữ hình ảnh

![Bộ thành phần giao diện](concepts/ui-kit.webp)

Chi tiết (mã màu, font, cỡ, màu nút, cách viết prompt) ở [art-direction.md](art-direction.md).
Tóm tắt:

- **Thế giới:** xóm chài Việt Nam kiểu đồ chơi: tre, dây thừng, thúng, thuyền thúng, mái ngói đỏ,
  đèn lồng. Hoạt hình 2.5D, mảng màu sạch, viền mềm, bóng ngắn, nắng từ trên trái. Ảnh mẫu là
  [ảnh sảnh vòng đảo](concepts/lobby-ring.webp).
- **HUD mỏng, một nút lộng lẫy:** nút, icon, hàng tiền nền tối chữ kem; chỉ nút CHƠI là sơn mài
  viền vàng, to và phát sáng. Bảng lớn là gỗ mật ong, dây thừng, ruột giấy dó.
- **Màu nút theo loại hành động:** đi tiếp đỏ sơn mài, xã hội xanh biển, xác nhận xanh tre, lùi
  hoặc bỏ qua xám xanh, thông tin gỗ tối, nguy hiểm nâu đen viền đỏ.
- **Chữ trong thẻ:** không dùng ký tự nối (`·`, `|`, `/`); tách bằng khoảng trống, màu và chip. Số
  tăng xanh, số giảm đỏ. Thẻ chia đầu, thân, chân khi cần.
- **Ảnh đại diện:** ảnh tròn trong vòng tre ở mọi nơi; khung khác là vật phẩm trang trí.
- **Tiền:** đồng **xu** lỗ vuông; tài nguyên phụ là **ngọc** xanh lá.
- **Chữ:** Baloo 2 cho tiêu đề, số, nút; Be Vietnam Pro cho chữ thường. Cả hai đủ dấu tiếng Việt.

**Chuyển động:** nút nhún khi chạm; bảng gỗ đung đưa nhẹ khi hiện; camera bay khi đổi màn; xu bay
khi nhận thưởng. Không có chuyển động nào chặn người chơi quá 0,6 giây.

**Âm thanh giao diện:** tiếng gỗ khi chạm, tiếng giấy khi mở bảng, tiếng xu khi nhận thưởng, sóng
biển nền ở sảnh. Mỗi trò có nhạc nền riêng; âm thanh giao diện là của chung.

## Khế ước cho mọi trò và sự kiện

Một trò hay sự kiện **phải**:

- [ ] Khai báo: tên, thể loại, một câu giới thiệu, số người, thời lượng một ván, phần thưởng tối
      đa; sự kiện thêm ngày mở/đóng và dải phần thưởng.
- [ ] Có tranh thẻ trò (dọc, theo khung chung) và tranh nhỏ cho thẻ "trò đang chọn" ở sảnh.
- [ ] Dùng thành phần chung từ `xomdao_sdk`: nút, bảng, ô người chơi, ô lựa chọn, thông báo.
- [ ] Theo một bố cục mẫu trong ván (**Bàn** hoặc **Hành động**); để trống ô của nút ☰.
- [ ] Trả thứ hạng khi hết ván và để phần khung hiện kết quả, phần thưởng.
- [ ] Vừa lõi 960 × 720 ở mọi tỉ lệ khung; vùng chạm ≥ 88, chữ ≥ 24.
- [ ] Có ảnh chụp ở các khung (`npm run shots`) và kịch bản e2e.

Một trò hay sự kiện **không được**:

- Vẽ nút quay lại, menu, cài đặt, âm thanh, số dư hay tên trò của riêng nó.
- Tự cộng tiền hay vật phẩm cho người chơi.
- Dùng font, bảng màu giao diện hay kiểu nút khác (thế giới bên trong trò thì tự do).
- Hiện chữ hướng dẫn kiểu "chạm vào đây để…".

## Còn để ngỏ

- Cấp người chơi tính từ đâu (tổng ván, kinh nghiệm riêng)?
- Ngọc (tài nguyên thứ hai) dùng vào việc gì.
- Có chat chữ hay chỉ biểu cảm.
