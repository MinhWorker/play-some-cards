# Làm một game

Một game là một thư mục, `games/<id>/`. Bạn không bao giờ phải sửa gì bên ngoài nó: ứng dụng tự
tìm mọi thư mục trong `games/`.

```
npm run new:game -- my-game "Tên tiếng Việt"
npm run dev
```

Lệnh này tạo một game nhỏ chạy được ("đua tới 21"), đánh dấu `wip`. Biến nó thành game của bạn
từng bước một, lúc nào cũng giữ cho nó chơi được.

- **Chơi một mình:** http://localhost:5033/?play=my-game&players=2 chạy game ngay trong trình
  duyệt: không cần server, không cần tài khoản. Các nút ở trên cùng đổi ghế ngồi ("Khán giả" cho
  thấy người xem thấy gì). Lưu file là trang tự tải lại. Chạy được cả ở bản xem trước của PR,
  không có trên trang thật.
- **Chơi thật:** mở http://localhost:5033, đăng nhập, chọn đảo của game; mở thêm một cửa sổ (ẩn
  danh) để làm người chơi còn lại.

Nếu `package-lock.json` bị xung đột khi bạn merge `main` vào nhánh của mình, chạy `npm install`.

## Một game gồm những gì

Một game là hai lớp có các hook vòng đời, giống script trong Unity:

- **`Game`** (phần logic, chạy trên server): khai báo người chơi làm được gì (`events`), và mỗi
  sự kiện chạy một hook trả về state kế tiếp. Server là bên quyết định mọi thứ.
- **`GameView`** (màn hình, chạy trên trình duyệt của từng người): vẽ state, gửi sự kiện khi
  người chơi bấm, và làm hiệu ứng khi nghe thấy sự kiện.

Hai bên nói chuyện qua sự kiện, và mọi hook nhận một `ctx` chứa cả phòng: state, người chơi và
ghế, chủ phòng, tỉ số, tuỳ chọn.

```
 trình duyệt của Lan               server                           trình duyệt của mọi người
 ───────────────────               ──────                           ─────────────────────────
 bấm nút
   └ this.send('add', {amount}) ─► events.add kiểm tra dữ liệu
                                   onAdd(ctx) → State mới ────────► onAdd(ctx, event)   hiệu ứng
                                                                    onState(ctx)         hiện state
```

Mẫu tối thiểu nằm trong `scripts/templates/game/`. Ví dụ hoàn chỉnh: `games/tic-tac-toe`
(Caro: tuỳ chọn phòng, người chơi máy, màn cài đặt).

## Các hook

| `Game` (server) | khi nào |
| --- | --- |
| `onStart(ctx)` | "Bắt đầu" / "Chơi ván mới": trả về state đầu tiên |
| `on<Event>(ctx)` | một người chơi gửi sự kiện đó (`press` → `onPress`): trả về state kế tiếp, hoặc `ctx.reject('…')` |
| `onEnd(ctx)` | sau `ctx.finish(winners)` (tuỳ chọn) |
| `onLeave(ctx)` | một người rời bàn giữa ván và ván chơi tiếp không có họ (tuỳ chọn; không có thì ván dừng) |
| `on<Timer>(ctx)` | hẹn giờ `ctx.setTimer(ms, '<timer>')` đã tới (tuỳ chọn) |
| `cmd<Name>(ctx)` | lệnh dev tuỳ chọn trong `commands`: context thường cộng `args` và `reject()` |
| `view(ctx, viewer)` | mỗi người chơi được thấy gì (tuỳ chọn; giấu bài ở đây) |

| `GameView` (trình duyệt) | khi nào |
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

## Thư mục

```
games/<id>/
  src/index.ts        đầu vào phía server: definePlugin({ meta, game: new MyGame(), room? })
  src/client.ts       đầu vào phía trình duyệt: defineClient({ scene: MyView, setup?: MySetup })
  src/game/           bản thân game: TypeScript thuần, không Phaser, không DOM (chạy trên server)
    MyGame.ts           State, các sự kiện và hook của chúng: đọc file này trước
    MyGame.test.ts      test (npm run check chạy chúng)
  src/scenes/         những gì người chơi thấy, vẽ bằng Phaser (chỉ trên trình duyệt)
    MyView.ts           màn hình game
  assets/             hình (.webp/.png) và âm thanh (.wav/.mp3), dùng theo tên file
  sources/            file gốc tuỳ chọn (PNG lớn, .psd/.kra, âm thanh thô); xem bên dưới
  README.md           luật chơi và ghi công
```

Chỉ `src/index.ts` và `src/client.ts` là bắt buộc; phần còn lại sắp xếp tuỳ bạn. Giữ `game/` không
dính Phaser: server nạp thư mục đó.

Một game chỉ được import `@psc/sdk`, `@psc/sdk/client`, `phaser`, `zod` và file của chính nó; lint
sẽ kiểm tra. Import tương đối kết thúc bằng `.js` (`./model.js`), vì server chạy JS đã biên dịch.

### Tạo file mới từ mẫu

Giống "Create > C# Script" trong Unity, `npm run new` viết sẵn một file có đủ các hook kèm chú
thích, chỉ việc điền vào. Chạy từ thư mục gốc của repo kèm id của game, hoặc chạy bên trong
`games/<id>/` thì bỏ id đi. Không ghi `Tên` thì lấy tên game; file đã có sẽ không bị ghi đè.

| Lệnh | Tạo ra |
| --- | --- |
| `npm run new -- logic <id> [Tên]` | `src/game/<Tên>Game.ts` (một `Game`) và file test |
| `npm run new -- view <id> [Tên]` | `src/scenes/<Tên>View.ts` (một `GameView`) |
| `npm run new -- setup <id> [Tên]` | `src/scenes/<Tên>Setup.ts` (màn "Tạo phòng") và `src/game/options.ts` |
| `npm run new -- game <id> ["Tên"]` | cả một thư mục game (giống `npm run new:game`) |

Lệnh in ra dòng cần thêm vào `index.ts` hoặc `client.ts` để dùng file mới. Các mẫu nằm trong
`scripts/templates/`.

## Phần logic (`Game`)

```ts
export class MyGame extends Game<State, Options> {
  events = { place: z.object({ cell: z.number().int() }) };   // dữ liệu sai dạng bị chặn trước

  onStart(ctx) { return { ... }; }                             // ván mới: state đầu tiên
  onPlace(ctx) {                                               // sự kiện `place` → onPlace
    if (ctx.state.turn !== ctx.player.id) ctx.reject('Chưa tới lượt bạn');
    if (thắng) ctx.finish([ctx.player.id]);                    // [] = hoà
    return { ...ctx.state, ... };                              // trả về state MỚI
  }
  // tuỳ chọn: onEnd(ctx), bot(ctx), view(ctx, viewer), onLeave(ctx), hook của hẹn giờ
}
```

- Hook không bao giờ sửa `ctx.state`: trả về một state mới.
- `ctx.lastResult` là kết quả ván trước trong phòng (ví dụ để người thắng đi trước ở ván sau);
  `null` ở ván đầu hoặc khi người ngồi bàn thay đổi.
- **Giấu bí mật trong `view(ctx, viewer)`**: bài của người khác, thứ tự bộ bài. `viewer` là `null`
  với khán giả: chỉ thông tin công khai. Không viết `view` thì ai cũng thấy cả state. Sự kiện mà
  người khác không được thấy dữ liệu (ví dụ úp một lá bài) thì ghi vào `secretEvents`.
- Chỉ lấy ngẫu nhiên qua `ctx.rng` (`shuffle(ctx.rng, deck)`, `pick`, `int` từ `@psc/sdk`), không
  bao giờ dùng `Math.random()`, để test có thể chơi lại đúng một ván.
- **Hẹn giờ**: `ctx.setTimer(ms, 'turn-over')` hẹn server gọi `onTurnOver(ctx)` sau `ms` mili
  giây (ví dụ đồng hồ mỗi lượt, khoảng nghỉ giữa các vòng, chờ hoạt ảnh chia bài xong). Mỗi game
  có một hẹn giờ: đặt lại là thay cái cũ, `ctx.clearTimer()` để huỷ, ván kết thúc thì tự dừng.
  Người chơi không gửi được sự kiện hẹn giờ. Màn hình thấy nó qua `ctx.timer` để vẽ đồng hồ.
- **Người rời bàn giữa ván**: mặc định ván dừng cho cả bàn. Viết `onLeave(ctx)` (`ctx.player` là
  người vừa rời) thì ván chơi tiếp không có họ, ví dụ xử thua. Ghế không bao giờ đổi trong một
  ván: người đã rời vẫn nằm trong `ctx.players` với `left: true`.
- Test bằng `testGame(plugin, ['a', 'b'])` (hoặc `testGame(new MyGame(), …)`):
  `.send('a', 'place', { cell: 4 })`, `.error(...)`, `.state`, `.result`, `.view(player)`,
  `.assertHidden(viewer, secret)`, `.bot(player)`, `.newGame()` (ván kế tiếp trong cùng phòng),
  `.timer` và `.fireTimer()` (cho hẹn giờ nổ ngay), `.leave(player)`. Tuỳ chọn
  `{ bots: ['b'] }` đánh dấu người chơi máy.

## Dùng Dev Console

`npm run dev` bật `PSC_DEV=1` cho server. Vào **phòng thật**, mở nút **DEV** rồi bật
**Dev Console**. Game nào cũng có các lệnh engine; sandbox `/?play=<id>` vẫn chạy độc lập trong
trình duyệt và không nhận các lệnh phòng.

- `Ctrl+/` mở ô lệnh; `` Ctrl+` `` hiện/ẩn nhanh; `Esc` đóng gợi ý rồi thoát ô lệnh.
- Khi ô trống, `?` hiện bảng phím tắt. `help` liệt kê lệnh, `help dice` xem một lệnh cụ thể.
- Gõ `as `, `tp ` hoặc `@square:` rồi bấm `Tab` / `Shift+Tab` để chọn ghế, tham số, id;
  danh mục kèm tên tiếng Việt. `↑` / `↓` gọi lại lịch sử, `PageUp` / `PageDown` cuộn log.
- `.pin 1 tp 0 @square:san-bay; dice 1 1` ghim cả chuỗi; gõ `!1` để dựng lại tình huống.
  Ghim lưu theo game, còn lịch sử, bộ lọc, góc và độ đậm lưu trên trình duyệt.
- `.filter reject` chỉ xem nước bị từ chối; `.find "Chưa tới lượt"` tìm lý do; `.copy 20`
  chép các dòng đang lọc. `.dock tr`, `.opacity 60`, `.clear` và `.console off` chỉnh lớp phủ.

Toàn bộ lớp phủ có nền tối bán trong suốt để đọc rõ trên cảnh sáng; `.opacity` chỉnh độ đậm.
Lớp phủ chỉ dùng bàn phím: chuột và chạm luôn đi xuống game, kể cả ô lệnh. Bấm vào game sẽ
thoát chế độ gõ. Log ở chế độ xem mờ sau 10 giây (lỗi 30 giây); phím tắt bỏ qua bộ gõ đang ghép
chữ và ô nhập khác của ứng dụng. Khi hết log, nền cũng ẩn. Khi gõ lệnh, bàn phím Phaser tạm dừng. Enter gửi lệnh và xoá
ô ngay để gõ tiếp trong lúc chờ trả lời. Chuỗi `;` chạy và in kết quả từng lệnh; lỗi dừng chuỗi,
`.clear` ở cuối xoá những dòng đã in trước nó.

Một số lệnh dùng cho mọi game:

```text
bot pause; timer pause; seed 42
state get
state set players.0.position 19
rng push 0 0
as 0 roll
undo
snapshot save airport
restart
snapshot load airport
```

`state set` sửa trực tiếp state, không kiểm tra luật; đường dẫn và sự kiện trong ví dụ phụ
thuộc game. `as` gửi thay một ghế qua đúng kiểm tra nước đi, có hoạt ảnh như người chơi bấm.
`timer fire` cho timer chạy ngay, `bot step` cho máy đi một nước. `finish 0` kết thúc với ghế 0
thắng; `finish` trống là hoà. `state dump` in cả dữ liệu server giữ. `seed off` trở lại ngẫu nhiên
thường, `rng clear` bỏ các số đã xếp hàng.

`undo` giữ tối đa 50 thay đổi, gồm state, tỉ số, RNG và thời gian timer còn lại. Snapshot nằm ở
`.dev/snapshots/<gameId>/<tên>.json`, còn sau khi khởi động lại server; nạp vào phòng cùng game
và cùng số ghế sẽ đổi id tài khoản theo thứ tự ghế. `snapshot list` và `snapshot delete <tên>`
quản lý các file đó.

Trong hook đồng bộ, dùng `console.log/info/warn/error` bình thường: khi dev bật, dòng hiện trong
log phòng và terminal. Chi tiết dữ liệu/stack là object trong DevTools của trình duyệt
(`console.groupCollapsed`); lớp phủ chỉ hiện tóm tắt. Log giữ tối đa 500 dòng, chi tiết quá lớn
bị cắt quanh 20 KB. Tắt công tắc tổng thì client thôi nhận log; ẩn nhanh bằng phím vẫn giữ log.
Server không có `PSC_DEV=1` từ chối mọi lệnh dev, kể cả khi client tự gửi socket.

## Lệnh dev (tuỳ chọn)

Game không cần khai báo gì để dùng lệnh engine và `as`. Muốn có lệnh riêng, khai báo
`commands` cùng hook `cmd<Name>`; `catalogs` cung cấp giá trị có tên cho `@danh-mục:id`:

```ts
import { catalog, type CommandContext, Game, type StartContext } from '@psc/sdk';
import { z } from 'zod';

type State = { players: { position: number }[] };

class TeleportGame extends Game<State> {
  readonly events = {};
  override readonly catalogs = {
    square: [
      { id: 'xuat-phat', value: 0, label: 'Xuất phát' },
      { id: 'san-bay', value: 20, label: 'Sân bay' },
    ],
  };
  override readonly commands = {
    tp: z.object({ seat: z.int().nonnegative(), square: catalog('square') })
      .describe('Đưa một người chơi tới một ô'),
  };
  onStart(ctx: StartContext): State {
    return { players: ctx.players.map(() => ({ position: 0 })) };
  }
  cmdTp(ctx: CommandContext<State, undefined, { seat: number; square: number }>): State {
    if (!ctx.state.players[ctx.args.seat]) ctx.reject('Không có ghế này');
    return {
      ...ctx.state,
      players: ctx.state.players.map((player, seat) =>
        seat === ctx.args.seat ? { ...player, position: ctx.args.square } : player),
    };
  }
}
```

Đối số theo vị trí theo thứ tự khoá `z.object`: `tp 0 @square:san-bay`; cũng nhận
`tp square=@square:san-bay seat=0`. `CommandContext<State, Options, Args>` có đầy đủ
`rng`, `players`, `options`, `setTimer`, `clearTimer`, `finish`, thêm `args` đã kiểm tra và
`reject(message)`. Hook phải trả state mới, giống `on<Event>`; lệnh riêng không phát sự kiện
nước đi. Tên `move-token` gọi `cmdMoveToken`.

`catalog('square')` mặc định nhận số; dùng `catalog('card', z.string())` cho id chuỗi hoặc
schema object cho giá trị phức hợp. `id` phải kebab-case và duy nhất, `label` là tiếng Việt.
Tham chiếu danh mục cũng dùng được trong `as`, JSON và `state set`. `gameRules` cùng test
registry chặn tên lệnh trùng engine, schema không phải `z.object`, hook thiếu, id sai/trùng và
danh mục không tồn tại.

Test lệnh riêng bằng cùng bộ phân tích với server:

```ts
const game = testGame(new TeleportGame(), ['a', 'b']);
game.command('tp 0 @square:san-bay');
expect(game.state.players[0].position).toBe(20);
```

`.command()` nhận chuỗi nhiều lệnh riêng cách bằng `;`; lệnh engine cần phòng server thật.
Ví dụ đầy đủ: `games/co-ty-phu-classic/src/game/dev.ts` và `dev.test.ts`, có danh mục ô/lá bài
và lệnh `dice`, `tp`, `cash`, `card`.

## Màn hình (`GameView`)

`GameView` quản lý màn chơi qua các hook và runtime của SDK. Logic và timer server quyết định
trạng thái ván; runtime quản lý thứ tự trình diễn, âm thanh, tốc độ và việc huỷ hiệu ứng trên client.

### Scene nền riêng (tuỳ chọn)

`defineClient({ scene: MyView })` giữ bầu trời chung. Đặt `background: false` để tắt
bầu trời khi mở bàn chơi/sandbox và tự vẽ nền ngay trong `GameView`, hoặc
`background: MyBackground` để thay bằng một scene độc lập phía sau bàn. Màn tạo phòng
và tuỳ chỉnh vẫn dùng bầu trời chung; rời bàn sẽ khôi phục nền mặc định.

```ts
import { defineClient, GameBackgroundScene } from '@psc/sdk/client';

class MyBackground extends GameBackgroundScene {
  protected onCreate() { /* tạo đối tượng và đặt lại các field */ }
  protected onLayout() { /* đặt vị trí theo this.view, phủ kín this.bleed */ }
  protected override onUpdate(dt: number) { /* chuyển động trang trí, dt tính bằng ms */ }
}

export default defineClient({ scene: MyView, background: MyBackground });
```

Scene nền đăng ký dưới key `<id>:background`, dùng `this.image`, `this.texture` và
`assets/` của game như bàn chơi; không nhận state phòng và không bắt input. Các tài nguyên
nền được tải trước khi mở bàn và tắt bầu trời chung. `this.runtime` có lifetime `scene`:
hoạt ảnh tiếp tục qua ván mới/resync, được huỷ khi đóng bàn. `onCreate` chạy lại khi mở
bàn khác, nên đặt lại field chứa đối tượng ở đây. `onLayout` chạy sau tạo scene và mỗi
lần khung đổi; vẽ nền ra hết `this.bleed` để phủ cả lề và tai thỏ. Ví dụ đang dùng:
`games/co-ty-phu-classic/src/scenes/CityBackground.ts` (mây trôi, đèn thành phố).

### Luồng trình diễn và vòng đời

`this.runtime` có trước `onCreate`/`build`. Dùng `run` cho một hành động gồm nhiều bước:

```ts
this.runtime.run(async (fx) => {
  await fx.sound('move');
  await fx.tween({ targets: pawn, x: destination.x, y: destination.y, duration: 400 });
  await fx.wait(150);
  fx.checkpoint();
  showLanding();
}, { lane: 'turn', onFailure: () => this.onResync(this.ctx) });
```

Một lane chạy FIFO, mặc định `policy: 'queue'`; `replace` hủy cả hành động đang chạy và các
hành động đang chờ, rồi chờ `finally` và cleanup trước khi bắt đầu hành động mới. Không truyền
lane thì flow chạy độc lập. `pending(lane)` chỉ đếm việc chờ, `busy(lane)` tính cả việc đang chạy.
Giới hạn mỗi lane là 64 flow chờ; overflow trả `failed`, hủy lane và gọi `onFailure` để dựng lại
snapshot. Không trộn lifetime `round` và `scene` trong cùng lane.

`FlowHandle.done` luôn resolve với `completed`, `cancelled` (kèm `reason`) hoặc `failed` (kèm
`error`); `cancel()` và `cancelLane()` an toàn khi gọi nhiều lần. Lỗi được báo qua runtime và
`onFailure` chỉ chạy khi scope vẫn hiện hành. Hủy bình thường không phải lỗi cần phục hồi.

Các primitive: `fx.wait(ms)`, `fx.tween(config)`, `fx.animate(sprite, key)`, `fx.frame(update)`
(với delta đã scale; trả `true` để kết thúc), `fx.sound(name)` và `fx.parallel(...factories)`.
Mỗi nhánh parallel có scope riêng; lỗi một nhánh hủy các nhánh khác và chờ cleanup.
`fx.defer(cleanup)` dọn object tạm/listener theo thứ tự ngược, kể cả khi hủy. Cleanup chỉ dọn
tài nguyên, không gửi nước đi hay dựng state mới. Đăng ký cleanup ngay sau khi tạo object tạm.

Một target chỉ có một managed tween; tween mới hủy flow giữ target cũ. Gộp các thuộc tính
của cùng target trong một config. Tween hữu hạn không nhận `paused`, `persist`, `timeScale`,
vòng lặp vô hạn hoặc thời gian âm/không hữu hạn. Không dùng tween Phaser trực tiếp trên cùng
target. `runtime.cancelTweens(targets)` hủy các managed writer trước khi resize/đặt tọa độ lại.
`runtime.tween(config)` và `runtime.after(ms, callback)` là dạng ngắn cho phản hồi UI độc lập;
các bước nối nhau dùng `run` và `await`.

Flow mặc định sống trong ván (`round`), còn setup mặc định trong scene. Đổi ván hoặc resync
hủy scope cũ trước hook; kết thúc ván giữ hoạt ảnh nước cuối và kết quả. Scene shutdown dừng
mọi tài nguyên đồng bộ, lần chạy tiếp theo có runtime mới. Game vẫn reset field hiển thị của
mình trong `onCreate`. Với nhiều vòng trong một trận, `runtime.newRound('game-round')` đóng
scope trình diễn vòng cũ trước khi tạo bài/quân mới. `onResync(ctx)` dựng snapshot hiện tại
không replay tiếng/nước cũ khi `last.seq` bị nhảy, quay lùi (undo), nạp snapshot hoặc đổi người xem; hook vẫn đồng bộ.

`setSpeed(0.25–4)` đổi tốc độ cả wait/tween/atlas/frame đang chạy, giữ tốc độ qua ván mới và
không đổi timer server. Delta tối đa 100 ms mỗi frame; pause/sleep/tab ẩn dừng trình diễn và
voice ngắn. Khi trở lại bỏ thời gian ẩn. Countdown tiếp tục đọc `ctx.timer.endsAt`, không dùng
`fx.wait()` để chờ server. Nút DEV có mục Runtime để xem lane, epoch và số tài nguyên.

Sau mỗi `await`, gọi `fx.checkpoint()` trước side effect trực tiếp. Primitive SDK tự kiểm tra
scope; Promise ngoài SDK phải nhận `fx.signal` nếu có thể và phải checkpoint sau khi chờ.
Promise ngoài SDK không hỗ trợ abort có thể giữ lane cho tới khi body thoát; runtime không
cho flow replace chạy chồng lên body đó.

`runtime.audio.prepare(names)` tải/decode trước, không phát, có hạn 3 giây và có thể thử lại.
`runtime.audio.play(name)` trả handle với `started`, `finished`, `stop()` và thuộc scope ván.
`fx.sound()` mặc định chờ bắt đầu hoặc skip; `{ wait: 'finished' }` chờ hết tiếng. Mute, chưa
unlock hay tab ẩn skip ngay; âm thanh chưa decode có hạn bắt đầu mặc định 250 ms
(`maxStartDelayMs` đổi được). Âm thanh quá trễ bị bỏ, không phát bù sau khi rời phòng hoặc bật
tiếng. `sfx(): Promise<void>`, `jingle(): void`, `anim(): string` vẫn dùng được; luồng cần hủy
cả bước tiếp theo dùng `fx.sound()`. Nhạc nền thuộc app; duck dùng token riêng cho từng voice.

```ts
export class MyView extends GameView<State, Options> {
  onCreate(ctx) { /* tạo đối tượng: this.label, this.button, this.sprite, hoặc Phaser */ }
  onLayout(ctx) { /* đặt vị trí theo ctx.screen (chạy lại khi khung đổi) */ }
  onState(ctx)  { /* hiện state sau mọi thay đổi */ }
  // tuỳ chọn: onStart(ctx), on<Event>(ctx, event), onEnd(ctx), onUpdate(ctx, dt)
}
```

- App dùng lại cùng một màn hình cho mọi phòng của game (và sau "Tuỳ chỉnh"): Phaser xoá các đối
  tượng khi dừng màn, nhưng các field của class vẫn giữ giá trị cũ. Field nào giữ đối tượng hoặc
  nhớ những gì đã vẽ thì gán lại trong `onCreate`, đừng chỉ gán lúc khai báo.
- Khi người chơi thao tác, gọi `this.send('place', { x, y })`. Server quyết định có hợp lệ không,
  và lỗi được hiện sẵn cho bạn.
- `ctx` có `state` (những gì người này được thấy), `me` (`null` với khán giả), `players`, `hostId`,
  `isHost`, `score`, `options`, `result`, `timer` (`endsAt`, `ms`: vẽ đồng hồ đếm ngược), `clock`
  (`startedAt`, `endedAt`: ván đã chơi bao lâu, theo giờ của server) và `screen`
  (cỡ, tâm, `top` = chỗ trống đầu tiên dưới thanh phòng, `hud` = tỉ lệ HUD, `gap` = khoảng trống
  giữa hàng của thanh phòng, giữa các nút và tên phòng, hoặc `null`: đặt được một thứ nhỏ như ghế
  đối diện, như Tiến Lên).
- **Toạ độ là đơn vị thiết kế**, không phải điểm ảnh: màn chơi nằm trên một khung ngang cao 720,
  rộng 960 đến 1600 tuỳ máy (`this.view`, `ctx.screen`; xem [ui-guide.md](ui-guide.md)). Ứng dụng
  phóng khung cho vừa màn hình và vẽ đúng mật độ điểm ảnh, nên hình luôn đúng tỉ lệ và sắc nét.
  Ngoài khung vẫn còn màn hình (`this.bleed`): nền trải tới đó, còn thứ phải thấy thì đặt trong
  khung. Vị trí chạm lấy `pointer.worldX`, `pointer.worldY` (không dùng `pointer.x`, là điểm ảnh
  của canvas).
- `this.avatar(player)` cho ảnh đại diện của người chơi (máy có ảnh robot), dùng với
  `this.add.image(x, y, this.avatar(player))`.
- `this.sprite('card')` hiện `assets/card.webp`; `this.texture('card')` cho `setTexture`;
  `this.sfx('deal')` phát `assets/deal.wav` theo âm lượng hiệu ứng của người chơi và trả về
  một promise hoàn thành khi âm thanh bắt đầu. Dùng `await this.sfx('deal')` để đồng bộ hoạt ảnh
  với lúc phát tiếng;
  `this.jingle('victory')` cũng vậy, nhưng nhạc nền nhỏ đi trong lúc nó phát (nhạc thắng).
- `assets/<name>.normal.webp` là normal map của hình hoặc atlas `<name>`, tự nạp ở phòng
  thật và sandbox. Trong `onCreate`, `this.lighting()` bật ánh sáng nền và đèn trên trái;
  `this.lighting({ pointer: true })` thêm đèn mềm theo hover/kéo. Tuỳ chỉnh `ambient`, `color`,
  `intensity`; kết quả có `key` và `pointer` (đèn Phaser). Đèn theo khung khi resize và dọn
  listener khi scene dừng. `const pieces = this.litLayer()` rồi
  `pieces.add(this.image(x, y, 'pieces', 'pawn'))` tạo quân từ khung atlas và bật chiếu sáng.
  Vị trí là đơn vị scene; depth của quân xếp trong layer, depth của layer xếp với UI.
  Giữ chữ/dấu bàn ngoài layer. Nhiều quân nên dùng chung một cặp atlas để tránh đổi texture;
  hình không có normal map dùng normal phẳng của Phaser.
- `this.button('Đánh', onTap, { image: 'button' })` là nút có nền `assets/button.webp`. Nền là
  9-slice: nút to nhỏ, dài ngắn thế nào thì bốn góc vẫn giữ nguyên hình, chỉ phần giữa giãn ra.
  Mặc định mỗi góc rộng bằng nửa cạnh ngắn của ảnh, hợp với nút viên thuốc hay hộp bo góc; ảnh
  khác thì đặt `slice` (số điểm ảnh từ mép vào, một số cho cả bốn cạnh hoặc `[trái, phải, trên,
  dưới]`).
- Hình có file `.json` cùng tên là atlas (nhiều khung gộp một ảnh): `this.anim('hop')` tạo hoạt
  ảnh từ mọi khung theo thứ tự tên, dùng với `sprite.play(...)`.
- `titleStyle(size)`, `hudScale()` (nhân cỡ chữ và nút với nó), `this.fitText(...)` và
  `this.boardArea()` giữ đúng phong cách và cỡ chữ của ứng dụng.
- Bảng thắng/hoà, nút "Chơi ván mới", thanh phòng và âm thanh khi thắng đã được ứng dụng làm sẵn.
  Game tự vẽ bảng xếp hạng thì đặt `defineClient({ showsResult: true })`: bảng của ứng dụng chỉ
  còn các nút. Game tự vẽ danh sách người chơi thì đặt `showsPlayers: true` để thanh phòng ẩn
  danh sách của nó trong lúc chơi.
- Thanh phòng chỉ có hai nút ở góc trái: ← (về danh sách phòng của game) và 🏠 (rời phòng, về
  thẳng trang chủ), cùng danh sách người chơi (👑 cạnh chủ phòng) nếu game không tự vẽ danh sách
  đó. Thanh không ghi tên game hay "Phòng của …": game nào tự vẽ người chơi thì tự thể hiện chủ
  phòng theo kiểu của mình (`ctx.hostId`, `ctx.isHost`). Bấm ← hoặc 🏠 giữa ván sẽ được hỏi lại "Bỏ dở ván này?" (rời đi là dừng ván cho cả
  bàn). Đổi chữ trong `client.ts`:
  `defineClient({ scene, leaveConfirm: { title, message, stay, leave } })` (chỗ nào không ghi thì
  giữ chữ mặc định), hoặc `leaveConfirm: false` để tắt.

## Tuỳ chọn phòng và chơi với máy (tuỳ chọn)

Một game có thể có màn cài đặt riêng (ví dụ "chơi với bạn hay với máy?") khi ai đó bấm
"Tạo phòng", và mở lại khi chủ phòng bấm "Tuỳ chỉnh" trong phòng giữa các ván. Thiết kế bằng
Phaser tuỳ thích, rồi trao lại một object: object đó là tuỳ chọn của phòng. Không có màn cài đặt
thì phòng được tạo ngay. `npm run new -- setup <id>` tạo sẵn khung.

```ts
// src/client.ts
export default defineClient({ scene: MyView, setup: MySetup });

// src/scenes/MySetup.ts: build() tạo đối tượng một lần; draw() đặt vị trí, chạy lại khi đổi cỡ
export class MySetup extends RoomSetupScene<Options> {
  protected build() { /* nút, hình, âm thanh của bạn */ }
  protected draw() { /* this.safeTop() chừa chỗ cho thanh trên cùng của ứng dụng */ }
  // khi bấm: this.submit({ opponent: 'bot', level: 'hard' })   (hoặc this.cancel())
  // this.current: tuỳ chọn hiện tại của phòng khi mở bằng "Tuỳ chỉnh", null nếu là phòng mới
}

// src/index.ts
export default definePlugin({
  meta,
  game: new MyGame(),
  room: {
    options: optionsSchema,                                  // zod; server kiểm tra object
    bots: (options) => (options.opponent === 'bot' ? 1 : 0), // tuỳ chọn: số ghế cho máy
  },
});
```

- Tuỳ chọn tới tay game dưới dạng `ctx.options`, ở cả `Game` lẫn `GameView`.
- Người chơi máy: viết hook `bot(ctx)` trong `Game`, trả về sự kiện của máy cho ghế `ctx.player`
  (ví dụ `{ event: 'place', payload: { x, y } }`), hoặc `null` khi chưa tới lượt. Server chơi nó
  sau một khoảng dừng ngắn và kiểm tra như mọi sự kiện. Test bằng `.bot(player)` của `testGame`.
- Giữa các ván, chủ phòng có thể đổi tuỳ chọn ngay trên màn hình bằng `this.changeOptions({...})`
  (kiểm tra `ctx.isHost`; `ctx.options` đã tính cả thay đổi đang gửi đi). `onStart` kế tiếp nhận
  tuỳ chọn mới. Caro dùng cách này cho nút đổi màu nhanh.

`optionsSchema.parse({})` phải chạy được: các giá trị mặc định đó dùng cho phòng tạo không qua
màn cài đặt. Ghế của máy đứng sau người thật. Khi tuỳ chọn mới cần nhiều hay ít máy hơn, máy sẽ
vào (nếu còn ghế) hoặc rời đi, và tỉ số tính lại từ đầu. Phòng đóng khi người thật cuối cùng rời
đi. Trong sandbox, nút "Tuỳ chỉnh" mở màn cài đặt của bạn và chơi lại từ đầu với tuỳ chọn đó. Caro
(games/tic-tac-toe) là ví dụ (`src/scenes/Setup.ts`, `src/game/bot.ts`).

## Hình và âm thanh

Đặt file hoàn chỉnh vào `assets/` là được dùng nguyên như vậy. Làm bằng cách nào cũng được: tự vẽ,
tạo bằng AI, render bằng Blender, vẽ bằng code (Phaser graphics), tài nguyên miễn phí trên mạng; chọn
cái trông và nghe hợp với game nhất, ghi nguồn khi tiện. `assets/island.webp` là hòn đảo của game
trên bản đồ trang chủ (`meta.portal.image`). Bản đồ giữ nguyên tỉ lệ ảnh và hiển thị cạnh dài của
mỗi đảo ở 640 đơn vị trước khi co cả cụm đảo và bảng tên theo khung hình, nên ảnh có độ phân giải
cao hơn không làm đảo hiển thị lớn hơn.

Hình gốc lớn có thể để trong `sources/` (lưu bằng Git LFS), rồi `npm run assets -- <id>` tạo file
sẵn dùng: mỗi hình trong `sources/` thành một `assets/<cùng tên>.webp` đã cắt viền và thu nhỏ (tuỳ
chọn cho từng hình trong `sources/prompts.json`: `transparent`, `maxSize`).

Âm thanh thì không có bước build: file trong `assets/` chính là bản dùng. Muốn cắt, đổi tốc độ hay
chỉnh âm lượng, sửa thẳng file đó (ví dụ bằng `ffmpeg`, hoặc nhờ Claude sửa giúp). Hiệu ứng ngắn
dùng WAV mono 16-bit (MP3 thêm một chút trễ ở đầu), nhạc dùng MP3.
Các file tên `music-*.mp3` trong `assets/` là nhạc nền của game: mỗi lần vào bàn chơi phát ngẫu
nhiên một bài.

Để tạo hình bằng Codex (nếu bạn có), thêm một prompt vào `sources/prompts.json`
(`{ "assets": { "card-back": { "transparent": true, "maxSize": 256, "prompt": "…" } } }`) rồi chạy
`npm run gen:asset -- <id>/card-back`.
Khung hình cho animation: thêm `"from": "<tên hình gốc>"` và `"preserveCanvas": true`, prompt chỉ
tả chỗ khác đi. Codex sẽ sửa từ hình gốc nên nhân vật và bố cục giữ nguyên (tạo hình gốc trước).

### Kết xuất Blender và normal map

Helper chung ở `tools/blender/psc_bake/`: vật liệu, `cube`/`sphere`/`lathe`, `setup`/`render`,
đèn trên trái và pass normal. Cờ Vua, Cờ Đam và Cờ Vây dùng cùng bộ này.

```sh
npm run blender -- chess pieces cloth
npm run blender -- chess piece-white-knight
npm run blender -- checkers cloth
npm run blender -- go cloth
```

Lệnh mặc định dùng `blender` và Pillow. Nếu máy không có Blender CLI, cài wheel bằng Python
3.13 rồi chọn Python đó cho lệnh:

```sh
python3.13 -m venv /tmp/psc-blender
/tmp/psc-blender/bin/python -m pip install bpy==5.1.2 Pillow
PSC_BLENDER_PYTHON=/tmp/psc-blender/bin/python npm run blender -- chess pieces
```

Cũng chạy trực tiếp được bằng `python games/chess/sources/render_assets.py -- pieces` hoặc
`blender -b -t 4 --python games/chess/sources/render_assets.py -- pieces`;
`PSC_BLENDER_BIN` chọn Blender ở đường dẫn khác. PNG trung gian nằm trong `.blender/<id>/`,
chỉ commit script Python và tài nguyên sẵn dùng; không cần thêm `.blend` hay file nguồn LFS.
Đổi một quân Cờ Vua sẽ ghép lại atlas `pieces`; lần đầu sẽ kết xuất thêm quân còn thiếu.
`npm run blender -- go bowl bowl-lid` kết xuất riêng hộp và nắp.

Normal map mang tên `assets/<name>.normal.webp`, cùng kích thước và alpha với `<name>.webp`;
atlas dùng cùng toạ độ khung, không xoay hoặc cắt canvas. Trục X sang phải, Y lên trên, Z
hướng người xem. Mặt phẳng nhìn thẳng phải đọc gần `(128,128,255)`. Xuất pass emission
camera-space bằng **Raw**, không dùng Standard vì vẫn chuyển sang sRGB; tắt dither và lưu
WebP **lossless**. Không đưa normal map qua bước cắt viền, chỉnh màu hay nén mất dữ liệu.
Kiểm tra bằng `python tools/blender/test_bake.py` hoặc
`blender -b --python tools/blender/test_bake.py`.

Nền vải dùng tile POT 256×256 liền mép và `TileSprite`, kéo tới `this.bleed` khi layout;
không cần ảnh phủ toàn màn hình trong bộ nhớ điện thoại.

## Xong chưa?

Đặt `status: 'ready'` trong `src/index.ts`. Trước đó game chơi được ở máy dev và bản xem trước của
PR, còn trên trang thật thì bị khoá ("sắp có"), nên bạn có thể merge phần làm dở bất cứ lúc nào.

Snapshot khi vừa mở scene đã có nước đi hoặc kết quả cũng gọi `onResync` trước `onState`, để dựng bàn hiện tại và không phát lại trình diễn/âm thanh cũ. `npm run e2e -- --changed origin/main` tính cả thay đổi chưa commit trong working tree.
