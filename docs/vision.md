# Xóm Đảo: tầm nhìn

> Trạng thái: Phase 0 (làm rõ ý tưởng). Tài liệu này mô tả nơi dự án sẽ đi tới, chưa phải cách
> nó đang chạy. Kế hoạch từng bước: [roadmap.md](roadmap.md). Lý do đổi engine:
> [adr/0001-godot-client.md](adr/0001-godot-client.md). Giao diện và trải nghiệm chung:
> [experience.md](experience.md).

## Một câu

**Xóm Đảo là một quần đảo trò chơi trên web: chơi các trò quen thuộc và các sự kiện nhỏ cùng bạn
bè để kiếm tài nguyên, rồi dùng chúng để thể hiện bản thân trong xóm.**

Dự án bắt đầu là "Chơi chút bài" (Play Some Cards), một bộ game bàn cờ và bài. Xóm Đảo giữ lại
phần lõi đó (server, luật của các trò, tài khoản) và mở rộng thành một sân chơi: trò gì cũng có
thể thành một hòn đảo, không chỉ bài và cờ.

## Người chơi và nền tảng

- Chơi với bạn bè quen. Chủ dự án mời bạn bè khi có trò Godot đầu tiên chơi được.
- **Điện thoại trước, máy tính sau.** Cả hai chạy trên trình duyệt, cài được như app (PWA).
- Màn hình ngang cho cả hub và trò chơi.
- Địa chỉ: `xomdao.vercel.app`.

## Ba trụ cột

1. **Hub là một game, không phải một app.** Bố cục học từ sảnh chờ của game mobile nổi tiếng (MOBA,
   bắn súng sinh tồn), vẽ lại bằng hoạt hình văn hoá Việt: gỗ, tre, sơn mài, giấy dó, nón lá, đèn
   lồng. Không nút phẳng kiểu ứng dụng.
2. **Mỗi trò là một hòn đảo, có thể là một dự án riêng.** Giống cách các game lớn liên tục thêm
   trò phụ và sự kiện: mỗi sự kiện có luật, hình ảnh và phần thưởng riêng, nhưng dùng chung tài
   khoản, tiền và túi đồ. Thêm một đảo không phải sửa phần lõi.
3. **Hình ảnh đẹp như game thật.** Client viết bằng Godot. Art làm từ Blender (nhân vật, quân cờ,
   đảo: những thứ cần nhất quán) và Codex image gen (concept, UI, nền, texture), theo một tài liệu
   hướng nghệ thuật chung.

## Thế giới gồm những gì

Thế giới có ba tầng, học từ game mobile (sảnh chờ → chế độ chơi → bản đồ): **Sảnh** là đảo Xóm
với nhân vật của bạn; quanh đó là các **đảo thể loại** (Cờ, Bài, Tiệc, Đối Kháng, Sự kiện); mỗi
thể loại có một **danh sách trò** kéo ngang. Chi tiết: [experience.md](experience.md).

Mọi nội dung đều là plugin, mỗi cái một thư mục trong `games/<id>/`:

| Loại | Ví dụ | Đặc điểm |
| --- | --- | --- |
| `table`: trò chơi bàn | Tiến Lên, Cờ Tướng, Caro | Phòng nhiều người, có bot, chơi lâu dài |
| `event`: sự kiện | "Trung Thu: câu cá 7 ngày" | Có ngày mở và đóng, có thể chơi một mình, phần thưởng riêng |
| `place`: địa điểm | Cửa hàng, bảng xếp hạng, bến cảng | Một phần của hub, không có luật chơi |

Plugin khai báo dữ liệu (thể loại, tranh thẻ trò, thời gian mở, trạng thái `wip` hay `ready`,
phần thưởng tối đa). Sảnh và màn chọn trò đọc dữ liệu đó để tự dựng.

Các đảo là của chung: mọi người cùng thấy một quần đảo.

## Vòng lặp chơi

```
Chơi một trò → nhận tiền / tài nguyên → mua đồ → thể hiện (hồ sơ, skin bài, quân cờ, khung ảnh)
     ↑                                                                    ↓
     └────────────── thành tích, xếp hạng, thách đấu bạn bè ←─────────────┘
```

- **Tiền chỉ mua đồ trang trí**, không mua sức mạnh. Chơi với bạn bè thì công bằng quan trọng hơn.
- Bản đầu chỉ có một loại tiền. Kiến trúc phải cho phép thêm nhiều loại tài nguyên (mỗi trò rơi
  một loại, chế đồ hiếm…) mà không đổi lõi.
- Có cược tiền trong các trò bài hay không sẽ quyết định sau.

## Nền tảng dùng chung

Server giữ mọi dữ liệu của người chơi. Một trò không bao giờ tự sửa số dư hay túi đồ; nó chỉ báo
kết quả, server kiểm tra rồi ghi lại.

| Dịch vụ | Việc |
| --- | --- |
| Sổ cái (ledger) | Mỗi lần cộng hay trừ là một dòng ghi, kèm khoá chống ghi trùng (ví dụ mã ván). Không ai "sửa số dư" trực tiếp |
| Danh mục vật phẩm | Tên theo không gian: `core:coin`, `tien-len:la-bai-vang` |
| Túi đồ | Vật phẩm người chơi đang có |
| Thống kê và thành tích | Trò phát sự kiện thống kê (`win`, `bomb_played`); thành tích là luật khai báo dựa trên chúng |
| Xếp hạng | Tính từ thống kê |

Trò nói chuyện với nền tảng qua `ctx` của SDK, ví dụ `ctx.reward(playerId, 'core:coin', 50)` hay
`ctx.stat('win')`. Server từ chối phần thưởng vượt mức trò đã khai báo.

## Cách dự án được làm

Chủ dự án nói mình muốn gì; agent làm toàn bộ phần việc: luật, scene Godot, art, kiểm tra, PR.
Vì vậy mọi thứ phải làm được bằng dòng lệnh và tự kiểm tra được:

- Godot ghim một phiên bản, cài bằng một lệnh. Máy chủ dự án, agent và CI dùng cùng bản.
- Agent tự chụp màn hình trên khổ điện thoại và tự chơi qua e2e.
- Asset đi theo một quy trình cố định: prompt hoặc Blender → bake → nhập vào Godot.
- Vật phẩm, giá, phần thưởng và thành tích là dữ liệu khai báo, sửa được mà không đụng code.

Chi tiết: [roadmap.md](roadmap.md).

## Ngoài phạm vi (hiện tại)

- App native trên kho ứng dụng (Godot cho phép làm sau, nhưng chưa phải mục tiêu).
- Avatar đi lại tự do và thấy người khác di chuyển trên bản đồ.
- Trao đổi đồ giữa người chơi, mùa giải.
- Thanh toán bằng tiền thật.
