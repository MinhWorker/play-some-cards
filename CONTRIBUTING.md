# Đóng góp

Cảm ơn bạn đã giúp! Dùng trình soạn thảo, công cụ vẽ hay trợ lý AI nào cũng được. PR là của bạn:
hãy chắc rằng nó chạy và bạn hiểu nó.

## Quy trình

1. **Chọn hoặc mở một issue** để không ai làm trùng việc. Việc nhỏ cho người mới có nhãn
   `good first issue`.
2. **Tạo nhánh** từ `main` (`feat/xiangqi-board`, `fix/room-list`, tên gì dễ đọc là được).
3. **Mở PR** sớm cũng được. **Tiêu đề** PR theo
   [Conventional Commit](https://www.conventionalcommits.org) (viết tiếng Anh), vì nó thành commit
   trên `main` và một dòng trong changelog:
   - `feat: …` thứ người chơi thấy được, `fix: …` sửa lỗi
   - `docs:`, `refactor:`, `test:`, `chore:`, `ci:` cho phần còn lại
   - phạm vi tuỳ chọn cho một game: `feat(xiangqi): cannon captures`

   Commit bên trong nhánh viết sao cũng được; khi merge chúng được gộp lại (squash).
4. **CI** chạy lint, kiểm tra kiểu, unit test, build và một bài test trình duyệt không giao diện
   (headless). Vercel gửi link xem trước để chơi thử nhánh của bạn. Nếu đổi giao diện, đính kèm
   ảnh chụp cỡ điện thoại và cỡ máy tính.
5. **Review, rồi squash merge.** Merge vào `main` là triển khai lên bản thật.

Trước khi push, `npm run check` chạy đúng các bước kiểm tra đó trên máy bạn.

## Phiên bản

Không ai tự sửa số phiên bản. Một bot giữ sẵn PR "release" liệt kê mọi thứ đã merge từ lần phát
hành trước. Merge PR đó sẽ tăng phiên bản, cập nhật `CHANGELOG.md` và gắn tag `vX.Y.Z`. Phiên bản
đang chạy hiện ở cuối bảng âm thanh.

## Quy tắc CI không kiểm được

- Người chơi thấy tiếng Việt. Mã, chú thích trong mã và các file `AGENTS.md` viết tiếng Anh; tài
  liệu cho người đọc (README, CONTRIBUTING, `docs/`, README của game, mẫu issue/PR) viết tiếng Việt.
- Server là bên quyết định, và thông tin ẩn (bài của người khác) không bao giờ rời server: lọc nó
  trong hook `view` của game.
- Hình và âm thanh làm bằng cách nào cũng được: AI, tự vẽ, Blender, vẽ hay tổng hợp bằng code, tài
  nguyên miễn phí trên mạng. Chọn cái hợp với game nhất. Không đặt chữ vào trong hình.
- Ứng dụng chơi xoay ngang, theo [docs/ui-guide.md](docs/ui-guide.md). Thử giao diện bằng
  `npm run shots`: lệnh chụp một trang trên nhiều điện thoại, máy tính bảng và máy tính thật, xoay
  ngang, đúng độ phân giải của từng máy.
- Migration database phải chạy được với bản web trước đó (thêm trước, xoá sau).
- Thay đổi giao thức socket làm hỏng client cũ thì tăng `PROTOCOL_VERSION`
  (`packages/shared/src/protocol.ts`); CI sẽ nhắc bạn.

## Giấy phép

Mã của bạn được chia sẻ theo MIT, hình và âm thanh theo CC BY-NC 4.0
([LICENSE-ASSETS.md](LICENSE-ASSETS.md)). Đây là dự án nhỏ cho bạn bè và cộng đồng: dùng tài nguyên
miễn phí thoải mái, ghi nguồn khi tiện. Chỉ đừng lấy tài nguyên trả phí hay bị cấm dùng, và không
đem bán thứ gì.

## Làm một game

`npm run new:game -- <id> "Tên"` tạo một game nhỏ chạy được trong `games/<id>/` (`npm run new`
thêm từng file từ mẫu). Mọi thứ về game nằm trong thư mục đó, nên nhiều người có thể làm game cùng
lúc mà không đụng nhau. Chơi thử một mình ở `http://localhost:5033/?play=<id>&players=2` (không
cần server hay tài khoản). Xem [docs/making-a-game.md](docs/making-a-game.md).
