# Triển khai và CI

## CI (GitHub Actions)

- `ci.yml` (mọi PR và mọi lần push lên `main`):
  - `check` = `npm run check` + `npm run build`.
  - `godot` cài Godot đã ghim, chạy `npm run godot:check`, `npm run godot:net`, xuất bản release
    và chụp thử bằng `npm run godot:smoke`. Sau đó nó xuất bản debug, chạy `npm run dev` (không
    database), rồi `npm run smoke` và mọi kịch bản e2e (`npm run e2e -- --retries 1`). Ảnh chụp
    là artifact `godot-web`.
  - `e2e` là check bắt buộc: chỉ báo lại kết quả của job `godot`.
- `pr.yml` (PR): `title` kiểm tra tiêu đề theo Conventional Commit; `protocol` báo lỗi khi
  `packages/shared/src/protocol.ts` thay đổi mà không tăng `PROTOCOL_VERSION` (gắn nhãn
  `protocol:compatible` để bỏ qua).
- `release.yml` (push lên `main`): release-please giữ PR phát hành luôn cập nhật.
- Dependabot mở PR gộp hằng tuần cho npm và GitHub Actions.

## E2E

Mỗi kịch bản là một file `scripts/e2e/scenarios/godot-*.mjs`, chơi bản debug của client Godot
qua cầu nối test `window.xomdao` và tự tạo tài khoản, phòng riêng. Nhờ đó các kịch bản chạy song
song được. CI chạy hết mọi kịch bản; kịch bản lỗi được chạy lại một lần, nếu lần sau qua thì CI
vẫn xanh nhưng hiện cảnh báo "Flaky e2e". Một kịch bản chạy quá 10 phút bị tính là lỗi. Server
trong CI đặt `BOT_DELAY_MS=200`: máy đi gần như ngay, không nghỉ 0,7 giây như khi người thật chơi.

Trên máy mình, `npm run e2e -- --changed origin/main` chỉ chạy kịch bản liên quan đến file đã
đổi (`--list` in ra danh sách đó):

- Chỉ đổi tài liệu (`*.md`, `docs/`), ảnh gốc (`games/*/sources/`, `games/*/assets/`), `.github/`
  (trừ `ci.yml`) hay cấu hình release-please: không chạy kịch bản nào.
- Chỉ đổi trong `games/<id>/`: chạy các kịch bản khai báo `games = ['<id>']`, cùng các kịch bản có
  `always = true` (đường đi ngắn nhất qua toàn bộ ứng dụng).
- Chỉ đổi file của một kịch bản: chạy riêng kịch bản đó.
- Đổi bất cứ thứ gì khác (client, server, SDK, `packages/shared`, `scripts/e2e.mjs`,
  `scripts/e2e/godot.mjs`, dependency…): chạy hết.

Thêm game mới: viết một kịch bản `scripts/e2e/scenarios/godot-<id>.mjs` có `export const games =
['<id>']` (`npm run new:game` đã viết sẵn). CI tự nhận nó, không cần sửa `ci.yml`.

## Phiên bản

Cả ứng dụng dùng một số phiên bản, nằm trong `package.json` ở gốc, chỉ release-please được tăng.
PR phát hành ("chore(main): release x.y.z") gom tiêu đề các PR `feat:`/`fix:` đã merge từ lần
phát hành trước vào `CHANGELOG.md`; merge nó sẽ gắn tag `vX.Y.Z` và đăng một GitHub release. Mọi
lần merge vào `main` đều triển khai, dù có phát hành hay không; một bản phát hành chỉ là một mốc
có tên.

Phiên bản đang chạy của server nằm trong `/api/health` (`version`, `commit`, `protocol`).

Client (Vercel) và server (Render) triển khai riêng (Render chậm hơn Vercel vài phút), nên client
gửi `PROTOCOL_VERSION` trong lệnh đăng nhập ở `/ws`, và server từ chối bản khác bản của mình. Khi
đó client hiện "Đã có bản mới" với nút **Tải lại**. Bản xem trước của PR nói chuyện với server
thật, nên bản xem trước nào tăng protocol cũng phải chờ server lên bản mới. Khi server đang ngủ,
màn đầu hiện "Đang đánh thức máy chủ" và thử lại tới hai phút.

`index.html` và `content/manifest.json` không được cache; gói `.pck` của từng trò có mã băm
trong tên nên được cache vĩnh viễn.

Migration database chạy khi server khởi động, trong lúc bản server trước có thể vẫn đang chạy: hãy
làm chúng chạy được với bản trước (thêm cột trước, xoá cột cũ ở một PR sau).

## Game

`npm run build -w @xomdao/shared` (thứ Render chạy) build `@xomdao/sdk`, phần server của mọi game
và `@xomdao/shared` (scripts/libs.mjs), nên một thư mục mới trong `games/` được triển khai mà
không phải đổi cài đặt nào. Bản xuất Godot có mỗi trò thành một gói `.pck` riêng, chỉ tải khi cần.
Game có `status: 'wip'` không hiện trong danh mục của server thật (nơi có `RENDER`; bản xem trước
của PR cũng dùng server này) và hiện ở mọi server khác; `XOMDAO_SHOW_WIP=1|0` đổi điều đó.

## Client → Vercel

Repo GitHub `MinhWorker/xom-dao` được nối với project Vercel
`minhnks-projects/xomdao` (bản thật: https://xomdao.vercel.app). Mỗi lần push
lên `main` triển khai bản thật; mỗi PR có một URL xem trước. Cài đặt build nằm trong `vercel.json`
(gốc repo).

Biến môi trường trên Vercel: `XOMDAO_SERVER_URL` = URL công khai của game server (xem bên dưới;
tên cũ `VITE_SERVER_URL` vẫn được đọc). Nó được gắn cứng lúc build, nên đổi xong phải triển khai
lại.

`buildCommand` là `node tools/godot/vercel.mjs`: lệnh này cài Godot và template web (khoảng 80 MB
tải về mỗi lần build) rồi xuất client vào `apps/client/dist`, thư mục Vercel phục vụ ở `/`. Bản
thật dùng bản release, bản xem trước của PR dùng bản debug, có cầu nối test và sandbox
`?play=<id>`. Link cũ `/godot/…` chuyển về `/…`.

## Game server → Render

Dịch vụ Render `xomdao-server` (gói miễn phí, Singapore), cấu hình sao lại trong
`render.yaml`:
- URL: https://play-some-cards-server.onrender.com (kiểm tra sức khoẻ: `/api/health`). Đổi tên
  dịch vụ không đổi URL này, nên nó vẫn mang tên cũ.
- Bảng điều khiển: https://dashboard.render.com/web/srv-daq1sc0473hc73e7bsl0
- Tự triển khai khi push lên `main` nếu `apps/server/**`, `packages/shared/**` hoặc
  `package-lock.json` thay đổi.
- Gói miễn phí ngủ sau ~15 phút không dùng; lượt vào đầu tiên mất ~30-60 giây để đánh thức (trong
  lúc đó client hiện "Đang đánh thức máy chủ"). Ngủ hoặc triển khai lại sẽ xoá mọi phòng
  (tài khoản vẫn còn: chúng nằm trong Neon).
- CLI: `render services`, `render logs -r srv-daq1sc0473hc73e7bsl0`,
  `render deploys create srv-daq1sc0473hc73e7bsl0`.

`XOMDAO_SERVER_URL` của Vercel (bản thật + bản xem trước) trỏ tới URL này.

Đừng chuyển server sang Vercel. Vercel Functions có hỗ trợ WebSocket, nhưng kết nối bị đóng khi
hết thời gian tối đa của function và mỗi kết nối có thể rơi vào một instance khác. Phòng sống
trong bộ nhớ của một tiến trình, nên hai người bạn trong cùng phòng có thể bị tách sang hai
instance. Cũng vì vậy mà luôn giữ đúng một instance server.

## Database → Neon Postgres

Lưu tài khoản (`users`) và token đăng nhập (`sessions`); phòng vẫn ở trong bộ nhớ.
Project Neon `play-some-cards` (id `royal-block-89471600`, gói miễn phí, `aws-ap-southeast-1`
= Singapore, cạnh server Render). Database `psc`, role `psc_owner`
(tên cũ, giữ nguyên để không phải chuyển dữ liệu).
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
`npm run db:generate -w @xomdao/server` (ghi SQL vào `apps/server/drizzle/`, nhớ commit). Server áp
các migration còn thiếu khi khởi động. `npm run db:studio -w @xomdao/server` mở trình xem bảng.

## Cách đơn giản nhất: một máy, không Vercel

```sh
npm run godot:export
npm run build && npm start -w @xomdao/server   # server ở cổng 8033
node scripts/web.mjs                           # client ở cổng 5033, chuyển /api và /ws tới server
```

Server không phục vụ trang web; `scripts/web.mjs` phục vụ bản xuất Godot và chuyển tiếp tới server
nên trình duyệt chỉ nói chuyện với một địa chỉ. Bạn bè cùng Wi-Fi có thể mở
`http://<IP-LAN-của-bạn>:5033`.
