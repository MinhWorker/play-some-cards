# Xóm Đảo: hướng nghệ thuật

Tài liệu này đủ để một agent làm asset mới (ảnh, nút, icon, tranh thẻ trò) mà không phải hỏi. Khung
trải nghiệm ở [experience.md](experience.md), cỡ và khung hình ở [ui-guide.md](ui-guide.md), bài học
từ game thật ở [ui-references.md](ui-references.md).

## Một câu

**Xóm chài Việt Nam kiểu đồ chơi, vẽ hoạt hình 2.5D: khối mềm, mảng màu sạch, bóng ngắn, nắng
từ trên trái. HUD mỏng, chỉ một nút lộng lẫy.**

## Phong cách

- **Ảnh mẫu là [sảnh vòng đảo](concepts/lobby-ring.webp).** Mọi ảnh mới giữ cùng mức chi tiết,
  độ tươi và hướng nắng với nó.
- **Thế giới chi tiết vừa phải, giao diện phẳng.** Đảo, nhà, đồ vật được có khối, vân gỗ, đá, lá
  như đồ chơi được vẽ kỹ; mảng màu vẫn sạch, cel shading, không ánh sáng điện ảnh. Nút, icon, hàng
  tiền, chip là mảng phẳng, không vân.
- **Khối mềm.** Góc bo, cạnh hơi phồng như đồ chơi gỗ. Không cạnh sắc, không phối cảnh mạnh.
- **Nắng từ trên trái**, cố định ở mọi ảnh và mọi màn. Mặt sáng hướng trên trái, bóng đổ xuống dưới
  phải.
- **Bóng đổ ngắn và mềm**: lệch (4, 6) đơn vị ở cỡ 720, màu `#3A2416` độ mờ 25%, nhoè 4. Không bóng
  dài, không bóng đen.
- **Viền**: màu tối hơn chính mảng đó (không dùng đen). Thành phần giao diện viền 3 đơn vị; đồ vật
  trong thế giới viền 2–4 tuỳ cỡ; tranh nền không viền.
- **Thế giới**: tre, dây thừng, thúng, thuyền thúng, mái ngói đỏ, đèn lồng, giấy dó, sơn mài. Đảo
  thể loại là diorama nhỏ, cùng cỡ, xếp trên một vòng tròn.

## Bảng màu

| Vai trò | Tên | Hex | Tối (viền, mặt khuất) |
| --- | --- | --- | --- |
| Trời (phần thừa của khung) | Trời | `#8FD3F4` | `#5FB4E0` |
| Biển | Ngọc lam | `#3EC1C9` | `#1E8FA6` |
| Cát | Cát kem | `#F3DDB0` | `#D9B97E` |
| Giấy | Giấy dó | `#FBF1DC` | `#E6D2AA` |
| Gỗ | Mật ong | `#D9963F` | `#9C5F2A` |
| Cây | Xanh tre | `#6DB34A` | `#3F7F33` |
| Mái | Đỏ ngói | `#D3603F` | `#9E3F28` |
| Nhấn, chấm thông báo | Đỏ đèn lồng | `#E0352B` | `#A8211C` |
| Nút CHƠI | Sơn mài đỏ | `#B8262A` | `#7A1418` |
| Quý, thưởng, viền nút CHƠI | Vàng đồng | `#E7B53C` | `#B9822A` |
| Xu | Đồng | `#D4A24C` | `#8F6526` |
| Ngọc | Xanh ngọc | `#3FBF7F` | `#23875A` |
| Chữ trên giấy | Nâu đậm | `#4A2E1C` | |
| Chữ trên gỗ, nền tối | Kem | `#FFF6E3` | |
| Nền HUD (nút, icon, hàng tiền, chip) | Nâu đậm trong mờ | `#3A2416` @ 85% | |
| Số tăng, số giảm | Xanh ngọc và đỏ đèn lồng | xem [Chữ trong thẻ](#chữ-trong-thẻ-và-bảng) | |

Quy tắc:

- Giao diện chung chỉ dùng màu trong bảng. Thế giới bên trong một trò được thêm màu riêng, nhưng
  giữ độ bão hoà và hướng nắng như trên.
- Vàng đồng chỉ cho thứ quý: nút CHƠI, phần thưởng, 👑, viền thẻ đang chọn.
- Chữ luôn tương phản ít nhất 4.5:1 với nền (nâu đậm trên giấy, kem trên gỗ và nền HUD).

## Chữ

| Dùng cho | Font | Độ đậm | Giấy phép |
| --- | --- | --- | --- |
| Tiêu đề, số, chữ trên nút | **Baloo 2** | ExtraBold 800 (nút, số), Bold 700 | SIL OFL 1.1 |
| Chữ thường, chữ nhỏ | **Be Vietnam Pro** | Medium 500, SemiBold 600 | SIL OFL 1.1 |

- Cả hai đủ dấu tiếng Việt. Baloo 2 đang dùng ở bản web, nên hai bản trông giống nhau trong lúc
  chuyển tiếp. Be Vietnam Pro được vẽ cho tiếng Việt, dấu không đè lên nhau ở cỡ 24.
- File `.ttf` đặt trong `apps/client/addons/xomdao_sdk/ui/fonts/` kèm giấy phép OFL; ghi nguồn ở
  `LICENSE-ASSETS.md`.
- Cỡ theo [ui-guide.md](ui-guide.md#đơn-vị-và-cỡ-tối-thiểu): nhỏ nhất 24, chữ thường 32–36, tiêu đề
  48–72. Số tiền dùng Baloo 2 với chữ số đều (`tnum`), dấu chấm ngăn nghìn (`2.450`).
- Chữ trên nút viết hoa chữ đầu (`Tạo phòng`), riêng nút **CHƠI** viết hoa hết.

## Vật liệu giao diện

"HUD mỏng, một nút lộng lẫy" ([ui-references.md](ui-references.md#hệ-quả-cho-xóm-đảo)): gỗ, sơn mài,
dây thừng chỉ cho thứ quan trọng.

| Thành phần | Vật liệu | Cỡ (đơn vị) |
| --- | --- | --- |
| Nút CHƠI | Sơn mài đỏ, viền vàng đồng 4, chữ kem 48, bóng trong nhẹ phía trên | cao 120 |
| Nút hành động | Nền tối theo loại hành động (bảng dưới), viền tông tối hơn 3, chữ kem 30–36 | cao 80–96 |
| Nút biểu tượng | Tròn, nâu đậm `#3A2416` @ 85%, icon kem | 88 × 88 |
| Bảng lớn | Khung mật ong viền 3, hai nút dây thừng ở góc trên, ruột giấy dó, lề trong 32, bo 24 | |
| Hàng tiền | Viên thuốc nền HUD, icon xu hoặc ngọc tràn ra mép trái, số kem; mỗi tiền một viên riêng | cao 64 |
| Ô người chơi | Ảnh đại diện trong vòng tre, tên trên nền HUD, cấp và số lá là chip riêng, vòng thời gian vàng đồng | ảnh 96 (gọn 72) |
| Thẻ trò | Khung gỗ tối bo 24; đầu: tên; thân: tranh; chân: chip số người, thời lượng, số đang chơi; thẻ đang chọn viền vàng đồng | 280 × 420 |
| Thông báo nhanh | Mẩu giấy dó, mép xé, trượt xuống từ giữa trên | cao 72 |
| Chấm thông báo | Tròn đỏ đèn lồng, viền kem 3 | 24 |

**Màu nút theo loại hành động.** Mọi nút có nền tối và chữ kem; người chơi nhận ra loại hành động
từ màu trước khi đọc chữ.

| Loại | Ví dụ | Nền | Viền |
| --- | --- | --- | --- |
| Đi tiếp (chính) | CHƠI, Đánh, Chơi tiếp | Sơn mài đỏ `#B8262A` | Vàng đồng `#E7B53C` |
| Xã hội, tạo | Tạo phòng, Mời, Vào phòng | Biển sâu `#1E8FA6` | `#14687A` |
| Xác nhận, nhận | Nhận thưởng, Sẵn sàng, Mua | Tre đậm `#3F7F33` | `#2B5A23` |
| Lùi, bỏ qua | Bỏ lượt, Huỷ, Để sau | Đá xám xanh `#4E5D6C` | `#36414C` |
| Thông tin | Luật, ?, Danh sách phòng | Gỗ tối `#9C5F2A` | `#6E4220` |
| Nguy hiểm | Đầu hàng, Rời phòng | Nâu đen `#3A2416` | Đỏ đèn lồng `#E0352B` |

Chỉ nút CHƠI ở sảnh được to, bóng và phát sáng; các nút đỏ khác phẳng.

- Nền nút và bảng là 9-slice: ghi độ dày viền (`slice`) cạnh mỗi file.
- Mỗi nút có bốn trạng thái: thường, sáng (rê chuột, +10% sáng), lún (dịch xuống 4, mất bóng), tắt
  (xám hoá 60%, mờ 60%).
- Không vẽ thanh tab kiểu app, viên thuốc phẳng kiểu Material, hay thanh ngang tràn màn hình.

## Chữ trong thẻ và bảng

- **Không dùng ký tự để nối** các phần (`·`, `|`, `/`, `—`, `•`). Tách các phần bằng khoảng trống,
  màu và chip: `4 người` và `10 phút` là hai chip riêng, không phải `4 người · 10 phút`.
- **Số đổi có màu**: tăng là xanh (`#3FBF7F` trên nền tối, `#2E8B4A` trên giấy) kèm dấu `+`; giảm là
  đỏ (`#E0352B` trên nền tối, `#B3261E` trên giấy) kèm dấu `−`. Số đứng yên giữ màu chữ thường.
- **Thẻ có ba phần khi cần**: đầu (tên, nhãn), thân (tranh, nội dung), chân (số liệu, nút). Mỗi phần
  một nền hoặc một khoảng cách riêng.
- **Đường phân cách** nhẹ, mang hoạ tiết: sóng nước hoặc dây thừng mảnh màu `#E6D2AA` trên giấy, kem
  20% trên gỗ. Không dùng đường kẻ thẳng xám.
- Nhãn phụ (cấp, số lá, thời lượng) là chip nhỏ nền tối hơn nền thẻ, không viết chung dòng với tên.

## Icon

- **Phosphor Icons, kiểu Fill** (MIT) cho icon chức năng: cài đặt, âm thanh, quay lại, menu, mời,
  luật, đóng. Tô một màu kem trên nền HUD; không gradient, không viền.
- Icon riêng của Xóm Đảo vẽ bằng Codex theo bảng màu: xu, ngọc, Nhà, Chợ, Đình, Bến, Sự kiện, Túi đồ,
  Thành tích, Xếp hạng. Phẳng, nhìn thẳng, viền tối hơn mảng, nền trong suốt, ảnh 256 × 256.
- Icon trong HUD vẽ ở 48 bên trong vùng chạm 88.

## Nhân vật và ảnh đại diện

**Ảnh tròn**, không có nhân vật: sảnh là vòng đảo (xem [Sảnh](#sảnh-vòng-đảo)), không có chỗ đứng
cho nhân vật.

- Ảnh đại diện 256 × 256, đĩa bán kính 100, vòng tre vẽ đè; khung khác là vật phẩm trang trí (Chợ).
- Dùng ở mọi nơi: góc hồ sơ ở sảnh, bàn chơi, hồ sơ, xếp hạng, phòng chờ.

## Sảnh: vòng đảo

- Không có đảo Xóm và nhân vật ở giữa. Các **đảo thể loại xếp trên một vòng tròn** nằm nghiêng trên
  biển, nhìn chéo từ trên.
- Vuốt ngang hoặc chạm một đảo để **xoay vòng**; đảo ở chính giữa phía trước là **đảo đang chọn**:
  to nhất, sáng nhất, có bảng tên. Các đảo khác nhỏ và nhạt dần theo độ xa.
- Đảo đang chọn quyết định danh sách trò ở thẻ "trò đang chọn" cạnh nút CHƠI.
- Nhà, Chợ, Đình, Bến là nút ở HUD (hàng dưới trái), không phải công trình trên đảo.

## Tranh thẻ trò và đảo

- **Tranh thẻ trò**: dọc 2:3, ảnh 640 × 960; một vật thể chính của trò (quạt bài, bàn cờ, ngựa Cá
  Ngựa) giữa khung, nền là một góc đảo của thể loại, nắng trên trái. Không chữ trong tranh (tên nằm
  ở bảng giấy của khung).
- **Tranh nhỏ** cho thẻ "trò đang chọn" ở sảnh: vuông, ảnh 256 × 256, chỉ vật thể chính, nền trong
  suốt.
- **Đảo thể loại**: diorama nhìn chéo từ trên, nền trong suốt; đảo chính rộng ~ 1/4 khung, đảo phụ
  ~ 1/8. Mỗi đảo một vật thể nhận diện: Cờ (bàn cờ tướng đá, quân cờ to), Bài (quạt bài khổng lồ,
  đình nhỏ).

## Chuyển động và âm thanh

Theo [experience.md](experience.md): nút nhún (scale 0.94 trong 80 ms, bật lại 120 ms), bảng đung
đưa nhẹ khi hiện (xoay ±2°, 300 ms), xu bay theo cung về hàng tiền. Không chuyển động nào chặn
người chơi quá 0,6 giây. Âm thanh: gỗ khi chạm, giấy khi mở bảng, xu khi nhận thưởng, sóng biển
nền ở sảnh.

## Viết prompt (Codex, agy)

Một prompt = **khối phong cách chung** + **chủ thể** + **bố cục** + **chữ** + **cấm**.

1. **Khối phong cách** lấy nguyên trường `style` của `docs/concepts/prompts.json` (ảnh concept)
   hoặc `assets/prompts.json` (asset). Không viết lại phong cách trong từng prompt. Màn hình có HUD
   thêm câu: nút và HUD nền tối chữ kem, không ký tự nối, số tăng xanh và số giảm đỏ.
2. **Chủ thể**: vật gì, làm bằng vật liệu gì trong bảng trên, màu nào (gọi tên màu trong bảng, ví dụ
   "honey wood `#D9963F`").
3. **Bố cục**: góc nhìn, vị trí trong khung, cỡ tương đối; với màn hình, ghi từng góc HUD có gì.
4. **Chữ**: ghi chính xác từng chữ tiếng Việt có dấu trong ngoặc đơn; với asset, "no text".
5. **Cấm**: "no instructional copy, no watermark, no phone frame"; với đồ vật,
   `transparent: true` hoặc nền magenta phẳng để tự tách.

Ví dụ (nút CHƠI):

```
Chủ thể: a chunky rounded rectangular button plaque of glossy red lacquer (#B8262A) with a brass-gold
(#E7B53C) border 4px thick, a soft top inner highlight, the word 'CHƠI' in cream (#FFF6E3) rounded
extra-bold letters. Bố cục: front view, centered, 3:1. Cấm: no background, transparent: true.
```

Sau khi sinh: xem ảnh thật ở cỡ hiển thị (`npm run shots -- --audit`), kiểm tra dấu tiếng Việt, kiểm
tra kênh alpha (Codex đôi khi vẽ ô caro giả).

## Kiểm tra trước khi nộp asset

- [ ] Nắng trên trái, bóng ngắn, viền tối hơn mảng.
- [ ] Màu giao diện nằm trong bảng màu.
- [ ] Nút, icon, hàng tiền phẳng; không chữ hướng dẫn; không ký tự nối trong chữ.
- [ ] Đủ điểm ảnh: cỡ ảnh ≥ cỡ hiển thị × 2,3 ([ui-guide.md](ui-guide.md#hình-và-kích-thước)).
- [ ] Nền nút/bảng có ghi `slice`.
- [ ] Prompt đã lưu trong `prompts.json` tương ứng.
