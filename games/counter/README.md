# Bấm Nút

Một hoặc hai người chơi, mỗi người một nút, chung một con số: mỗi lần bấm cộng thêm 1. Không có
thắng thua.

Ví dụ nhỏ nhất về cách viết game: hai lớp có các hook vòng đời, giống script trong Unity. `Game`
(phần logic) chạy trên server, nơi quyết định mọi thứ; `GameView` (màn hình) chạy trên trình duyệt
của từng người chơi. Hai bên nói chuyện qua sự kiện.

```
src/
  index.ts                đầu vào phía server: meta + game: new CounterGame()
  client.ts               đầu vào phía trình duyệt: defineClient({ scene: CounterView })
  game/CounterGame.ts     phần logic: State, sự kiện, hook (server)
  game/CounterGame.test.ts
  scenes/CounterView.ts   màn hình: hook và đối tượng (trình duyệt)
assets/                   button.webp, press.wav, island.webp
```

## Chuyện gì xảy ra khi ai đó bấm

```
 trình duyệt của Lan               server                           trình duyệt của mọi người
 ───────────────────               ──────                           ─────────────────────────
 bấm nút
   └ this.send('press') ─────────► events.press kiểm tra dữ liệu
                                   onPress(ctx) → State mới ──────► onPress(ctx, event)  nảy nút
                                                                    onState(ctx)          hiện số
```

## Các hook

| `CounterGame` (server) | khi nào |
| --- | --- |
| `onStart(ctx)` | "Bắt đầu" / "Chơi ván mới": trả về state đầu tiên |
| `on<Event>(ctx)` | một người chơi gửi sự kiện đó (`press` → `onPress`): trả về state kế tiếp, hoặc `ctx.reject('…')` |
| `onEnd(ctx)` | sau `ctx.finish(winners)` (tuỳ chọn) |
| `onLeave(ctx)` | một người rời bàn giữa ván và ván chơi tiếp không có họ (tuỳ chọn; không có thì ván dừng) |
| `on<Timer>(ctx)` | hẹn giờ `ctx.setTimer(ms, '<timer>')` đã tới (tuỳ chọn) |
| `cmd<Name>(ctx)` | lệnh dev tuỳ chọn trong `commands`: context thường cộng `args` và `reject()` |
| `view(ctx, viewer)` | mỗi người chơi được thấy gì (tuỳ chọn; giấu bài ở đây) |

| `CounterView` (trình duyệt) | khi nào |
| --- | --- |
| `onCreate(ctx)` | màn hình mở ra: tạo đối tượng (`this.label`, `this.button`, `this.sprite`, hoặc Phaser). Nền của `this.button` là 9-slice (góc giữ nguyên hình), `slice` chỉnh độ rộng góc |
| `onLayout(ctx)` | sau onCreate và khi khung đổi: đặt vị trí (`ctx.screen`, đơn vị thiết kế trên khung cao 720; `ctx.screen.gap` = chỗ trống giữa hàng thanh phòng, có thể `null`) |
| `onStart(ctx)` | một ván mới bắt đầu |
| `on<Event>(ctx, event)` | sự kiện của ai đó vừa được chơi: làm hiệu ứng (`event.player`, `event.isMe`) |
| `onResync(ctx)` | mất/quay lùi sự kiện, nạp snapshot hoặc đổi người xem: dựng snapshot, không phát tiếng cũ |
| `onState(ctx)` | sau mọi thay đổi: hiện state |
| `onEnd(ctx)` | ván kết thúc (`ctx.result`) |
| `onUpdate(ctx, dt)` | mỗi khung hình (chỉ trên trình duyệt) |

`ctx` luôn chứa cả phòng: `state`, `players` (ghế, tên, có phải máy không), `hostId`, `score`,
`options`; trên server có thêm `rng`, `finish()`, `lastResult` (kết quả ván trước) và, trong hook sự kiện, `player`, `payload`,
`reject()`; trên trình duyệt có `me`, `isHost`, `result` và `screen`.

`this.sfx('press')` phát âm thanh theo âm lượng hiệu ứng và trả về promise hoàn thành khi
âm thanh bắt đầu hoặc không thể phát. Có thể `await this.sfx('press')` trước khi chạy hoạt ảnh;
promise này không chờ âm thanh phát xong.

Chơi thử một mình: http://localhost:5033/?play=counter&players=2 (khi đang chạy `npm run dev`).

Hoạt ảnh nút dùng `this.runtime.run(async fx => { await fx.tween(...); })`: engine sở hữu
việc chờ, tốc độ và hủy. Scope ván đóng trước `onStart`/`onResync`, scope scene đóng khi rời
phòng; kết thúc ván giữ hoạt ảnh nước cuối. Flow có `done` với kết quả `completed`/`cancelled`/
`failed`, không tạo unhandled rejection. `fx.wait`, `fx.sound`, `fx.animate`, `fx.frame`,
`fx.parallel` nối các bước; `fx.defer` dọn object tạm và `fx.checkpoint` chặn continuation cũ
sau `await`. `runtime.tween`/`after` dành cho phản hồi UI ngắn độc lập. Chi tiết lane, âm thanh
trễ và timer server: [hướng dẫn tạo game](../../docs/making-a-game.md).

## Scene nền tuỳ chọn

Trong `defineClient`, bỏ `background` để giữ bầu trời chung; `background: false` tắt
bầu trời ở bàn/sandbox; `background: MyBackground` thay bằng một `GameBackgroundScene`.
Scene nền có `onCreate()`, `onLayout()` và `onUpdate(dt)` (ms), dùng `this.view`,
`this.bleed`, tài nguyên của game và runtime lifetime `scene`. Nó không nhận state/input,
không khởi động lại khi sang ván hoặc resync, và dừng khi rời bàn. Màn setup giữ nền chung.
Xem [ví dụ và vòng đời](../../docs/making-a-game.md#scene-nền-riêng-tuỳ-chọn).

## Dev Console và lệnh riêng

Trong phòng thật trên `npm run dev`, bật **Dev Console** ở nút **DEV**, gõ `Ctrl+/` rồi
`help`, `state get count`, `state set count 5` hoặc `as 0 press`. `undo` khôi phục thay đổi;
`?` trong ô trống hiện phím tắt. Sandbox ở link trên vẫn chạy luật riêng trong trình duyệt.

Game có thể thêm `override readonly commands` (`z.object`) và `cmd<Name>(ctx)`.
`CommandContext<State, Options, Args>` gồm context thường, `args` đã kiểm tra và `reject()`;
trả về state mới, dùng `ctx.rng`. Thứ tự khoá schema là thứ tự đối số theo vị trí.
`override readonly catalogs` liệt kê `{ id, value, label }`; `catalog(name, schema?)` nhận
`@name:id` và gợi ý bằng Tab (mặc định value là số). Tên lệnh không trùng engine, id là
kebab-case duy nhất, hook và danh mục được kiểm tra khi tạo `gameRules`.

`testGame(...).command(line)` test các lệnh riêng, kể cả chuỗi `;`, bằng cùng parser với server.
`console.log/info/warn/error` trong hook hiện trong log phòng và terminal khi `PSC_DEV=1`;
chi tiết mở trong DevTools của trình duyệt. Cách khai báo và ví dụ:
[hướng dẫn tạo game](../../docs/making-a-game.md#lệnh-dev-tuỳ-chọn).
