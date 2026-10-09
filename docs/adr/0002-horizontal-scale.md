# ADR 0002: Server mở rộng theo chiều ngang

- Trạng thái: Đã chấp nhận (Phase 0)
- Ngày: 2026-10-09

## Bối cảnh

Server hiện chạy một tiến trình duy nhất trên Render. Phòng, bot và đồng hồ của trò sống trong bộ
nhớ của tiến trình đó (`RoomsService`, `RoomsGateway`); khởi động lại là mất hết phòng. Tài khoản,
token đăng nhập và lịch sử ván đã ở Postgres.

Xóm Đảo sẽ có nhiều trò, sự kiện, sổ cái và túi đồ dùng chung. Khi người chơi đông lên, một tiến
trình không đủ. Thêm máy phải là việc cấu hình, không phải viết lại server.

## Quyết định

1. **Nhiều bản server giống hệt nhau** chạy sau một bộ cân bằng tải. Bản nào cũng nhận được kết nối
   WebSocket của bất kỳ ai. Không cần kết nối dính (sticky session).
2. **Dữ liệu bền nằm trong Postgres**: tài khoản, token, sổ cái, túi đồ, thống kê, thành tích, lịch
   sử ván, tiến độ sự kiện. Không bản server nào giữ dữ liệu này trong bộ nhớ riêng.
3. **Mỗi phòng đang mở có đúng một bản server làm chủ.** Chỉ bản chủ chạy luật, bot và đồng hồ của
   phòng đó. Vì vậy luật TS vẫn chạy đơn luồng như hiện nay, không phải khoá gì thêm.
4. **Danh bạ phòng** (Redis): mã phòng → bản chủ, trò, số ghế, trạng thái. Danh sách phòng, ghép
   nhanh (CHƠI), vào bằng mã và `session:resume` đều đọc danh bạ, không hỏi từng bản server.
5. **Kênh tin giữa các bản** (Redis pub/sub): người chơi nối vào bản A nhưng phòng ở bản B thì A
   chuyển nước đi sang B, B gửi state đã lọc cho từng người về lại A.
6. **Phòng sống sót khi một bản chết.** Bản chủ giữ quyền chủ bằng hợp đồng thuê có hạn (lease)
   trong Redis và lưu ảnh chụp phòng (state, RNG, điểm, đồng hồ còn lại) sau mỗi nước đi. Bản chủ
   chết thì hết hạn thuê; bản khác nhận phòng, nạp ảnh chụp và chạy tiếp. Người chơi chỉ thấy mất
   kết nối một lúc.
7. **Việc chạy theo lịch** (mở/đóng sự kiện, dọn phòng cũ) chỉ một bản làm, nhờ khoá trong Redis
   hoặc Postgres.
8. **Chạy một bản không cần Redis.** Danh bạ, kênh tin và khoá là giao diện có hai cách cài: bộ nhớ
   (một tiến trình, cho `npm run dev`, test và CI) và Redis (nhiều bản). `npm run dev` vẫn chạy như
   hôm nay.

## Vì sao

- **Một chủ cho mỗi phòng** giữ code luật đơn giản: không có hai bản cùng sửa một state. Phòng nhỏ
  (2–8 người), nên một phòng không bao giờ cần nhiều hơn một bản.
- **Chuyển tin qua Redis thay vì kết nối dính**: Render và nhiều nền tảng khác không cho client chọn
  bản server cụ thể. Chuyển tin chạy được ở mọi nơi; cái giá là thêm một bước nhảy cho người không
  nối vào bản chủ.
- **Ảnh chụp sau mỗi nước đi**: state của trò đã là dữ liệu JSON có thể khôi phục (dev console đã
  làm vậy với undo và snapshot), nên lưu và nạp lại không phải viết mới.
- **Sổ cái đã chống ghi trùng bằng khoá** (mã ván), nên hai bản cùng ghi một phần thưởng vẫn chỉ
  có một dòng.

## Hệ quả

- Cổng WebSocket mới (#112) viết trên các giao diện danh bạ, kênh tin và khoá ngay từ đầu, dù lúc đầu
  chỉ có bản bộ nhớ. Cổng Socket.IO cũ không cần chuyển: nó bị xoá khi bỏ client Phaser.
- Sổ cái, túi đồ, thống kê không được cache số dư trong bộ nhớ; mọi thay đổi đi qua giao dịch
  Postgres.
- Cần thêm Redis (ví dụ Render Key Value hoặc Upstash) khi bật nhiều bản. Tới lúc đó một bản là đủ.
- Phải có test chạy hai bản server cục bộ với Redis: hai người nối vào hai bản khác nhau chơi chung
  một phòng, rồi tắt bản chủ giữa ván và ván vẫn chạy tiếp.
- Dev console chạy trên bản chủ của phòng; lệnh từ bản khác được chuyển sang như nước đi.

## Phương án đã cân nhắc

- **Một tiến trình, nâng cấp máy to hơn**: đơn giản nhất, nhưng có trần và khởi động lại là mất phòng.
- **Kết nối dính theo phòng** (client nối thẳng tới bản chủ): ít bước nhảy hơn, nhưng cần định tuyến
  theo phòng ở bộ cân bằng tải, và người đang xem sảnh phải nối lại khi vào phòng.
- **Đưa state phòng hẳn vào Redis, bản nào cũng xử lý được**: không cần chủ phòng, nhưng mỗi nước đi
  phải khoá, và bot cùng đồng hồ không có chỗ chạy rõ ràng.
- **Adapter Redis của Socket.IO**: chỉ giải quyết phát tin, không giải quyết ai chạy luật và đồng hồ;
  và Godot không dùng Socket.IO.
