# Xóm Đảo: kế hoạch

> Mục tiêu và lý do: [vision.md](vision.md), [adr/0001-godot-client.md](adr/0001-godot-client.md).
> Không có hạn chót. Mỗi phase xong khi đạt điều kiện ghi ở cuối phase đó.

Trọng tâm của kế hoạch là **môi trường làm việc**: chủ dự án mô tả một trò hay một sự kiện, agent
làm từ đầu tới PR, tự kiểm tra, và hub tự nhận nội dung mới.

## Cấu trúc repo đích

```
apps/server/          NestJS: giữ, thêm cổng WebSocket thuần và các dịch vụ nền tảng
apps/client/          Dự án Godot duy nhất
  project.godot
  core/                 Autoload: Net, Session, Wallet, ContentLoader
  hub/                  Bản đồ đảo, hồ sơ, túi đồ, xếp hạng
  ui/                   Theme chung: nút, bảng gỗ, font
  addons/xomdao_sdk/    SDK GDScript cho trò: phòng, send(), on_state()
  content/              Symlink tới games/*/godot do script tạo (gitignore)
apps/web/             Client Phaser cũ: để yên, xoá khi không cần nữa
packages/sdk/         @xomdao/sdk: luật TS chạy trên server, thêm reward/stat
packages/shared/      @xomdao/shared: protocol zod, nguồn sinh code GDScript
games/<id>/           Một nội dung = một thư mục
  src/game/             Luật TS + test
  godot/                Scene, script, asset Godot của trò
  sources/              Blender, prompt gốc (Git LFS)
  RULES.md, README.md
tools/godot/          Phiên bản Godot ghim và script cài đặt
docs/art-direction.md Hướng nghệ thuật chung
```

## Quy trình làm một nội dung mới

```
Chủ dự án: "Làm sự kiện câu cá Trung Thu"
  1. Brief    games/<id>/RULES.md + mô tả hình ảnh, cảm giác   → chủ dự án duyệt
  2. Luật     src/game/*.ts + test                             npm run check
  3. Art      prompt / Blender → bake                          npm run gen:asset, npm run blender
  4. Godot    godot/ scene + script                            npm run godot:check
  5. Tự xem   ảnh chụp trên khổ điện thoại                      npm run shots
  6. Tự chơi  e2e qua cầu nối test                              npm run e2e
  7. PR       bản xem trước trên Vercel → chơi thử bằng điện thoại → merge
```

## Phase 0: tầm nhìn

- [x] [vision.md](vision.md), [ADR 0001](adr/0001-godot-client.md), kế hoạch này
- [ ] `docs/art-direction.md`: phong cách, bảng màu, ánh sáng, ảnh mẫu, cách viết prompt. Hub phải
      trông như game, không như app (xem [vision.md](vision.md#ba-trụ-cột))
- [ ] Concept hub theo hướng nghệ thuật mới

**Xong khi:** chủ dự án duyệt ba tài liệu và hướng nghệ thuật.

## Phase 1: móng

Đổi tên trước khi viết dòng Godot đầu tiên, để code mới dùng tên mới ngay.

**Đổi tên**
- [ ] Đổi tên repo GitHub thành `xom-dao` (chủ dự án làm trong Settings)
- [ ] `@psc/*` → `@xomdao/*`, `PSC_*` → `XOMDAO_*`, tên hiển thị → "Xóm Đảo" (bằng script)
- [ ] Đổi project Vercel thành `xomdao` (`xomdao.vercel.app`), đổi tên service trên Render
- [ ] README, CONTRIBUTING, `docs/deploy.md`, các `AGENTS.md`

**Công cụ Godot**
- [ ] `tools/godot/`: file ghim phiên bản (bản 4.x ổn định mới nhất lúc bắt đầu) +
      `npm run setup:godot` tải editor và export template vào `.tools/`
- [ ] `npm run godot -- …` gọi đúng bản đã ghim
- [ ] `npm run godot:check`: mở dự án headless và báo lỗi script, chạy `gdlint`/`gdformat`
      (gdtoolkit) và test GUT. Bật cảnh báo thiếu kiểu thành lỗi
- [ ] `npm run godot:link`: tạo symlink `apps/client/content/<id>` → `games/<id>/godot`
- [ ] `npm run godot:export`: bản web đơn luồng + PWA, mỗi trò một `.pck` đặt tên theo mã băm

**Mạng và protocol**
- [ ] Cổng WebSocket thuần trên server, cùng logic phòng với Socket.IO
- [ ] `npm run gen:protocol`: schema zod → class GDScript trong `xomdao_sdk`; CI báo lỗi nếu file
      sinh ra không khớp
- [ ] `addons/xomdao_sdk`: kết nối lại, đăng nhập, tạo/vào phòng, `send()`, tín hiệu `state_changed`

**Kiểm tra**
- [ ] Cầu nối test `window.xomdao` (chỉ bản debug): scene hiện tại, bấm node theo tên, đọc text,
      đọc state
- [ ] `npm run shots` và `npm run e2e` chạy với bản Godot web
- [ ] Sandbox `?play=<id>`: tạo phòng trên dev server, bot ngồi ghế trống
- [ ] Job CI `godot`: cài, check, export, e2e

**Trò thử**
- [ ] Caro bằng Godot: bàn chơi đơn giản, chưa cần art đẹp

**Xong khi:**
- Caro chơi được bằng Godot trên điện thoại thật (Android Chrome và iOS Safari);
- đã đo và ghi lại dung lượng tải và thời gian tới khi chơi được;
- agent tự chụp màn hình và tự chơi e2e được.

Nếu tốc độ tải hoặc Safari iOS không đạt, dừng lại và xem lại ADR 0001 trước khi sang Phase 2.

## Phase 2: hub v1

- [ ] Plugin khai báo `kind` (`table`, `event`, `place`), vị trí trên bản đồ, biểu tượng đảo,
      thời gian mở, phần thưởng tối đa
- [ ] Bản đồ quần đảo dựng từ registry; vào đảo thì tải `.pck` của trò
- [ ] Đăng nhập, hồ sơ, danh sách phòng (bến cảng), tạo/vào phòng
- [ ] Sổ cái trên server với một loại tiền `core:coin`; `ctx.reward()` trong SDK, có giới hạn theo
      khai báo của trò. Bảng dữ liệu thiết kế sẵn cho nhiều loại tài nguyên
- [ ] Art hub theo `docs/art-direction.md`
- [ ] `npm run new:game` tạo cả luật TS, thư mục `godot/`, kịch bản e2e, RULES.md

**Xong khi:** từ hub vào đảo Caro, chơi với bot, thắng thì được cộng tiền và thấy số dư mới.

## Phase 3: trò thật đầu tiên

- [ ] Tiến Lên bằng Godot, art và hiệu ứng đầy đủ
- [ ] Skill cho agent trong `.claude/skills/`: tạo nội dung mới, chuyển một trò Phaser sang Godot,
      làm một asset, kiểm tra trên điện thoại

**Xong khi:** chủ dự án mời bạn bè chơi.

## Phase 4: mở rộng

Làm dần, theo thứ tự chủ dự án muốn:

- Chuyển các trò còn lại (trò đơn giản trước, Cờ tỷ phú sau cùng)
- Khung `event`: ngày mở/đóng, phần thưởng riêng; `npm run new:event`
- Danh mục vật phẩm, túi đồ, cửa hàng đồ trang trí
- Thống kê, thành tích, xếp hạng
- Nhiều loại tài nguyên
- Khi không còn trò nào dùng Phaser: xoá `apps/web` và cổng Socket.IO

## Các mặc định đã chốt

| Việc | Chọn |
| --- | --- |
| Hướng màn hình | Ngang |
| Ngôn ngữ Godot | GDScript, có kiểu |
| Test và lint Godot | GUT, gdtoolkit |
| Kinh tế | Tiền chỉ mua đồ trang trí |
| Địa chỉ | `xomdao.vercel.app` |
| Client Phaser | Chạy tiếp cho tới khi có trò Godot đầu tiên; xoá khi không còn dùng |
