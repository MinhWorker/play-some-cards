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
| `view(ctx, viewer)` | mỗi người chơi được thấy gì (tuỳ chọn; giấu bài ở đây) |

| `CounterView` (trình duyệt) | khi nào |
| --- | --- |
| `onCreate(ctx)` | màn hình mở ra: tạo đối tượng (`this.label`, `this.button`, `this.sprite`, hoặc Phaser) |
| `onLayout(ctx)` | sau onCreate và khi đổi cỡ màn hình: đặt vị trí (`ctx.screen`) |
| `onStart(ctx)` | một ván mới bắt đầu |
| `on<Event>(ctx, event)` | sự kiện của ai đó vừa được chơi: làm hiệu ứng (`event.player`, `event.isMe`) |
| `onState(ctx)` | sau mọi thay đổi: hiện state |
| `onEnd(ctx)` | ván kết thúc (`ctx.result`) |
| `onUpdate(ctx, dt)` | mỗi khung hình (chỉ trên trình duyệt) |

`ctx` luôn chứa cả phòng: `state`, `players` (ghế, tên, có phải máy không), `hostId`, `score`,
`options`; trên server có thêm `rng`, `finish()` và, trong hook sự kiện, `player`, `payload`,
`reject()`; trên trình duyệt có `me`, `isHost`, `result` và `screen`.

Chơi thử một mình: http://localhost:5033/?play=counter&players=2 (khi đang chạy `npm run dev`).
