# Triển khai và CI

## CI (GitHub Actions)

- `ci.yml` (mọi PR và mọi lần push lên `main`): `check` = `npm run check` + `npm run build`.
  E2E chia làm ba job:
  - `e2e-plan` chọn kịch bản cần chạy (`scripts/e2e/scenarios/`). Push lên `main` chạy hết. PR
    chỉ chạy kịch bản liên quan đến file đã đổi (xem [E2E trong CI](#e2e-trong-ci)).
  - `e2e-run` chạy mỗi kịch bản trên một máy riêng: `npm run dev` không có database, rồi
    `npm run e2e -- --only <kịch bản> --retries 1` trong Chromium headless. Ảnh chụp là artifact
    `e2e-<kịch bản>`. Máy đầu tiên chạy thêm `npm run smoke`.
  - `e2e` là check bắt buộc: đạt khi mọi kịch bản được chọn đều qua, hoặc không cần kịch bản nào.
- `pr.yml` (PR): `title` kiểm tra tiêu đề theo Conventional Commit; `protocol` báo lỗi khi
  `packages/shared/src/protocol.ts` thay đổi mà không tăng `PROTOCOL_VERSION` (gắn nhãn
  `protocol:compatible` để bỏ qua).
- `release.yml` (push lên `main`): release-please giữ PR phát hành luôn cập nhật.
- Dependabot mở PR gộp hằng tuần cho npm và GitHub Actions.

## E2E trong CI

Mỗi kịch bản là một file trong `scripts/e2e/scenarios/`, tự tạo tài khoản và phòng riêng. Nhờ đó
các kịch bản chạy song song được. Tổng thời gian bằng thời gian của kịch bản dài nhất cộng khoảng
một phút cài đặt, không phải tổng của tất cả.

Cách chọn kịch bản cho một PR (`npm run e2e -- --list --changed origin/main` in ra đúng danh
sách CI sẽ chạy):

- Chỉ đổi tài liệu (`*.md`, `docs/`), ảnh gốc (`games/*/sources/`), `.github/` (trừ `ci.yml`) hay
  cấu hình release-please: không chạy kịch bản nào.
- Chỉ đổi trong `games/<id>/`: chạy các kịch bản khai báo `games = ['<id>']`, cùng các kịch bản có
  `always = true` (đường đi ngắn nhất qua toàn bộ ứng dụng).
- Chỉ đổi file của một kịch bản: chạy riêng kịch bản đó.
- Đổi bất cứ thứ gì khác (app, server, SDK, `packages/shared`, `scripts/e2e.mjs`,
  `scripts/e2e/lib.mjs`, dependency…): chạy hết.

Để test nhanh hơn, server trong CI đặt `BOT_DELAY_MS=200`: máy đi gần như ngay, không nghỉ 0,7 giây
như khi người thật chơi. Kịch bản lỗi được chạy lại một lần. Nếu lần sau qua, CI vẫn xanh nhưng hiện
cảnh báo "Flaky e2e" để biết kịch bản đó chập chờn. Một kịch bản chạy quá 10 phút sẽ bị tính là lỗi.

Thêm game mới: viết một kịch bản `scripts/e2e/scenarios/<id>.mjs` có `export const games =
['<id>']`. CI tự nhận nó, không cần sửa `ci.yml`.

## Phiên bản

Cả ứng dụng dùng một số phiên bản, nằm trong `package.json` ở gốc, chỉ release-please được tăng.
PR phát hành ("chore(main): release x.y.z") gom tiêu đề các PR `feat:`/`fix:` đã merge từ lần
phát hành trước vào `CHANGELOG.md`; merge nó sẽ gắn tag `vX.Y.Z` và đăng một GitHub release. Mọi
lần merge vào `main` đều triển khai, dù có phát hành hay không; một bản phát hành chỉ là một mốc
có tên.

Phiên bản đang chạy hiện ở cuối bảng âm thanh (`v0.1.0 · <commit>`) và trong `/api/health`
(`version`, `commit`, `protocol`).

Web và server triển khai riêng (Render chậm hơn Vercel vài phút), nên chúng so `PROTOCOL_VERSION`
khi socket kết nối. Trang cũ hơn server tự tải lại; trang mới hơn server hiện "Server đang cập
nhật" và thử lại tới khi server theo kịp. Bản xem trước của PR nói chuyện với server thật, nên bản
xem trước nào tăng protocol sẽ hiện dòng thông báo đó.

Mỗi bản build web đặt tên file theo mã băm, và Vercel chỉ phục vụ file của bản mới nhất. Một
trang mở từ trước lần deploy web sẽ không tải được code của game (404) khi người chơi mở game.
Web nhận ra điều này (`src/lib/newBuild.ts`: tải lại `index.html` và so file JS chính) khi tải
code game thất bại hoặc khi người chơi quay lại tab, rồi hiện hộp "Đã có phiên bản mới" với nút
"Tải lại". Bấm nút chuyển sang màn "Đang cập nhật…": web đọc commit và protocol của bản
mới từ thẻ `psc-build` trong `index.html`, kiểm tra `/api/health` mỗi 3 giây và chỉ tải lại
khi backend trả về đúng commit, đúng protocol và database không báo `down`. Vì các lần merge
có thể dùng chung số phiên bản và protocol, hai trường đó không thay thế việc so commit.
Request lỗi hoặc quá 10 giây vẫn giữ màn chờ và tự thử lại; nếu có bản web mới hơn trong lúc
chờ, mục tiêu cập nhật chuyển sang bản đó. Nếu backend deploy thất bại, màn chờ giữ nguyên
tới khi deploy được khắc phục hoặc có bản web khác thay thế.
Màn chờ phủ toàn màn hình, có hoạt ảnh bài và xúc xắc trên nền trời cùng các câu đùa luân
phiên. Thanh "Nạp năng lượng" chỉ là tiến độ giả cho vui, tăng chậm tới tối đa 95%, không
phải phần trăm deploy và không kéo dài thời gian chờ khi backend đã sẵn sàng. Thiết bị bật
chế độ giảm chuyển động sẽ không chạy hoạt ảnh.

Trang production vừa mở hoặc tự refresh cũng chặn thao tác tới khi backend khớp commit,
tránh tạo phòng trên tiến trình cũ rồi mất phòng khi backend khởi động lại. Phòng có sẵn vẫn
nằm trong bộ nhớ backend và không được giữ qua lần khởi động lại. Dev và bản xem trước PR
không chờ commit (bản xem trước dùng backend production); kiểm tra protocol vẫn áp dụng.
Ở chế độ dev hộp bản mới không tự hiện vì file JS chính luôn là `/src/main.tsx`.

Migration database chạy khi server khởi động, trong lúc bản web trước có thể vẫn đang chạy: hãy
làm chúng chạy được với bản trước (thêm cột trước, xoá cột cũ ở một PR sau).

## Game

`npm run build -w @psc/shared` (thứ Render và Vercel chạy) build `@psc/sdk`, phần server của mọi
game và `@psc/shared` (scripts/libs.mjs), nên một thư mục mới trong `games/` được triển khai mà
không phải đổi cài đặt nào. Bản build web chứa mỗi game thành một phần riêng, chỉ tải khi cần. Game
có `status: 'wip'` bị khoá ở nơi có `VERCEL_ENV=production` (trang thật) và chơi được ở mọi nơi
khác, kể cả bản xem trước của PR; sandbox (`/?play=<id>`) theo cùng quy tắc.

## Ứng dụng web → Vercel

Repo GitHub `MinhWorker/play-some-cards` được nối với project Vercel
`minhnks-projects/play-some-cards` (bản thật: https://play-some-cards.vercel.app). Mỗi lần push
lên `main` triển khai bản thật; mỗi PR có một URL xem trước. Cài đặt build nằm trong `vercel.json`
(gốc repo).

Biến môi trường trên Vercel: `VITE_SERVER_URL` = URL công khai của game server (xem bên dưới). Nó
được gắn cứng lúc build, nên đổi xong phải triển khai lại.

## Game server → Render

Dịch vụ Render `play-some-cards-server` (gói miễn phí, Singapore), cấu hình sao lại trong
`render.yaml`:
- URL: https://play-some-cards-server.onrender.com (kiểm tra sức khoẻ: `/api/health`)
- Bảng điều khiển: https://dashboard.render.com/web/srv-daq1sc0473hc73e7bsl0
- Tự triển khai khi push lên `main` nếu `apps/server/**`, `packages/shared/**` hoặc
  `package-lock.json` thay đổi.
- Gói miễn phí ngủ sau ~15 phút không dùng; lượt vào đầu tiên mất ~30-60 giây để đánh thức (trong
  lúc đó ứng dụng web hiện thông báo "Đang kết nối…"). Ngủ hoặc triển khai lại sẽ xoá mọi phòng
  (tài khoản vẫn còn: chúng nằm trong Neon).
- CLI: `render services`, `render logs -r srv-daq1sc0473hc73e7bsl0`,
  `render deploys create srv-daq1sc0473hc73e7bsl0`.

`VITE_SERVER_URL` của Vercel (bản thật + bản xem trước) trỏ tới URL này.

Đừng chuyển server sang Vercel. Vercel Functions có hỗ trợ WebSocket, nhưng kết nối bị đóng khi
hết thời gian tối đa của function và mỗi kết nối có thể rơi vào một instance khác. Phòng sống
trong bộ nhớ của một tiến trình, nên hai người bạn trong cùng phòng có thể bị tách sang hai
instance. Cũng vì vậy mà luôn giữ đúng một instance server.

## Database → Neon Postgres

Lưu tài khoản (`users`) và token đăng nhập (`sessions`); phòng vẫn ở trong bộ nhớ.
Project Neon `play-some-cards` (id `royal-block-89471600`, gói miễn phí, `aws-ap-southeast-1`
= Singapore, cạnh server Render). Database `psc`, role `psc_owner`.
- Nhánh `main` = bản thật. `DATABASE_URL` của Render giữ URL **pooled** của nó.
- Nhánh `dev` = phát triển trên máy. URL pooled của nó nằm trong `apps/server/.env` (bị gitignore;
  server nạp bằng `process.loadEnvFile()`).
- Lấy lại URL: `neonctl connection-string <main|dev> --project-id royal-block-89471600
  --database-name psc --pooled`, rồi đổi `sslmode=require` thành `sslmode=verify-full`
  (nếu không node-postgres sẽ cảnh báo).
- Server chạy được khi không có `DATABASE_URL` (test, chơi qua mạng LAN); khi đó `/api/health` báo
  `db: "off"` và tài khoản giữ trong bộ nhớ (mất sau khi khởi động lại).
- Gói miễn phí: 0.5 GB mỗi nhánh, máy tính toán ngủ sau 5 phút không dùng (truy vấn đầu tiên đánh
  thức nó trong ~1 giây).
- CLI: `neonctl` (cài toàn cục bằng npm; `neonctl auth` để đăng nhập).

Schema và migration dùng Drizzle ORM: sửa `apps/server/src/db/schema.ts`, chạy
`npm run db:generate -w @psc/server` (ghi SQL vào `apps/server/drizzle/`, nhớ commit). Server áp
các migration còn thiếu khi khởi động. `npm run db:studio -w @psc/server` mở trình xem bảng.

## Cách đơn giản nhất: một tiến trình, không Vercel

`npm run build && npm start -w @psc/server` phục vụ cả ứng dụng web lẫn game ở cổng 8033. Bạn bè
cùng Wi-Fi có thể mở `http://<IP-LAN-của-bạn>:8033`.
