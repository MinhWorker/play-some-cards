# ADR 0002: Mở rộng bằng cách gắn thêm khối

- Trạng thái: Đã chấp nhận (Phase 0)
- Ngày: 2026-10-09

## Bối cảnh

Xóm Đảo sẽ lớn dần theo hai hướng:

- **thêm trò và sự kiện**: Tiến Lên, Cờ Tướng, "Trung Thu: câu cá";
- **thêm tính năng nền tảng**: sổ tiền, Chợ, túi đồ, thành tích, xếp hạng, sau này có thể là
  bạn bè, nhiệm vụ, hộp thư.

Chỉ có một server, deploy một phiên bản mỗi lần. Vì vậy "mở rộng" ở đây không phải chạy thêm máy,
mà là **thêm một tính năng mà không phải sửa những phần đã có**. Mỗi lần thêm một thứ mới, phần
cũ phải tiếp tục chạy như trước, và agent chỉ cần đọc phần mình đang làm.

Hình dung server là một ổ cắm nhiều lỗ. Phần lõi là ổ cắm; mỗi trò và mỗi tính năng là một phích
cắm. Cắm thêm phích không phải đi lại dây trong tường.

## Quyết định

Có hai loại khối. Cả hai nằm trong cùng một server và cùng một client Godot, deploy cùng nhau.

### 1. Khối nội dung: trò và sự kiện

- Mỗi trò hay sự kiện là một thư mục `games/<id>/`: luật TypeScript (`src/game/`), phần hình
  Godot (`godot/`), `RULES.md`.
- Nó chỉ được dùng **SDK** (`@xomdao/sdk` trên server, `xomdao_sdk` trong Godot). Không import gì
  khác của lõi hay của trò khác.
- Nó nói với nền tảng qua `ctx`: `ctx.reward()`, `ctx.stat()`. Nó không biết sổ tiền hay thành
  tích được cài thế nào.
- Nó khai báo dữ liệu (thể loại, tranh thẻ, số người, phần thưởng tối đa); sảnh đọc dữ liệu đó để
  hiện thẻ trò.

Thêm một trò = thêm một thư mục. Không sửa server, sảnh hay trò khác.

### 2. Khối nền tảng: tính năng dùng chung

Mỗi tính năng nền tảng (Sổ tiền, Chợ, Túi đồ, Thành tích…) là một khối gồm hai nửa:

| Nửa | Ở đâu | Chứa |
| --- | --- | --- |
| Server | Một module Nest trong `apps/server/src/<khối>/` | Bảng dữ liệu của riêng nó, các lệnh nó cho phép (ví dụ Chợ: "xem hàng", "mua"), test |
| Client | Một thư mục trong `apps/client/hub/<khối>/` | Màn hình của nó, và lối vào: một nút HUD, một banner hoặc một công trình trên Xóm |

Ba quy tắc ranh giới:

1. **Mỗi khối giữ bảng của riêng nó.** Không khối nào đọc hay ghi bảng của khối khác. Chợ muốn trừ
   tiền thì gọi lệnh của Sổ tiền, không tự sửa số dư.
2. **Khối nói chuyện với nhau bằng hai cách:**
   - **gọi lệnh** khi cần câu trả lời ngay: Chợ gọi Sổ tiền "trừ 100 xu, khoá chống trùng là mã đơn";
   - **nghe tin** khi chỉ cần biết có chuyện xảy ra: Phòng phát tin "ván xong, kết quả thế này";
     Lịch sử ván, Sổ tiền và Thành tích tự nghe và tự làm phần của mình. Phòng không biết ai đang
     nghe. (Server đã làm vậy với lịch sử ván: `RoomsService.onFinished`.)
3. **Lõi không biết danh sách khối.** Thêm một khối là thêm một dòng vào danh sách module của
   server và một dòng vào danh sách lối vào của sảnh. Sảnh có sẵn các ô (hàng nút dưới trái, cột
   trái, banner cột phải, công trình trên Xóm); khối mới chỉ chọn ô của mình, không sửa bố cục sảnh.

Thêm một tính năng = thêm một khối. Không sửa khối khác, không sửa luật các trò.

### Phần lõi giữ lại những gì

Chỉ những thứ mọi khối đều cần: tài khoản và đăng nhập, phòng và ghép phòng, kết nối và protocol,
danh mục trò và thể loại, khung HUD và bộ thành phần giao diện. Lõi thay đổi ít, và khi đổi thì
có lý do chung cho mọi khối.

## Ví dụ: thêm Chợ

1. Server: `apps/server/src/shop/`: bảng "hàng đang bán", lệnh "xem hàng" và "mua". "Mua" gọi Sổ
   tiền để trừ xu và Túi đồ để thêm vật phẩm.
2. Protocol: thêm hai lệnh vào schema zod; `gen:protocol` sinh code GDScript.
3. Client: `apps/client/hub/shop/`: màn Chợ; lối vào là banner Chợ ở cột phải và quầy chợ trên Xóm.
4. Không file nào của Sổ tiền, Túi đồ, Phòng hay các trò phải đổi.

## Vì sao

- **Một server, một client** giữ việc deploy đơn giản: một lần merge, một bản chạy. Chia khối nằm
  ở trong code, không cần nhiều dịch vụ.
- **Mỗi khối giữ bảng riêng** thì sửa một khối không làm hỏng khối khác, và test được từng khối.
- **Nghe tin thay vì gọi thẳng** thì thêm một khối mới quan tâm tới "ván xong" (ví dụ Nhiệm vụ)
  không phải sửa Phòng.
- **Agent làm từng khối**: đọc một thư mục là đủ hiểu việc đang làm.

## Hệ quả

- Mỗi khối nền tảng có một mục trong `apps/server/AGENTS.md` (hoặc `AGENTS.md` riêng khi lớn):
  bảng nào, lệnh nào, nghe tin nào.
- Sổ tiền là khối duy nhất được đổi số dư. Mọi khối khác (Chợ, Sự kiện, Thành tích) thưởng hay trừ
  tiền qua nó, kèm khoá chống trùng.
- Khi một khối cần dữ liệu của khối khác thường xuyên, thêm lệnh đọc vào khối kia thay vì đọc bảng
  của nó.

## Phương án đã cân nhắc

- **Viết hết vào một chỗ, chia sau**: nhanh lúc đầu, nhưng mỗi tính năng mới phải sửa nhiều file cũ,
  và agent phải đọc cả server mới dám sửa.
- **Mỗi tính năng một dịch vụ riêng (microservice)**: tách biệt nhất, nhưng phải deploy và giữ cho
  nhiều server cùng chạy. Quá nặng cho một dự án chơi với bạn bè.
