# Làm một game

Một game là một thư mục, `games/<id>/`, cộng kịch bản e2e của nó. Bạn không phải sửa gì khác:
ứng dụng tự tìm mọi thư mục trong `games/`.

```
npm run new:game -- my-game "Tên tiếng Việt" --genre bai    # hoặc --genre co; --layout hanh-dong
npm run new:event -- hoi-lang "Hội làng"                    # sự kiện: --opens/--closes YYYY-MM-DD
npm run godot:check
```

`new:game` tạo một game nhỏ chạy được ("đua tới 21", có người chơi máy), đánh dấu `wip`, đã
có đảo thể loại nên hiện ngay trong sảnh Godot. `new:event` tạo một sự kiện nhỏ ("hái lộc") mở
từ hôm nay trong 4 tuần, nếu không chỉ định ngày. Cả hai viết sẵn:

- luật TypeScript và test (`src/`), `RULES.md`, README và tranh thẻ tạm (`assets/island.webp`);
- bàn chơi trong client Godot (`godot/`) theo một bố cục mẫu: **Bàn** (mặc định) hoặc
  **Hành động** (`--layout hanh-dong`; sự kiện luôn dùng Hành động), kèm test GUT;
- kịch bản e2e `scripts/e2e/scenarios/godot-<id>.mjs` chơi hết một ván trên khổ điện thoại.

`npm run godot:check` lần đầu để Godot viết các file `.uid`; commit chúng cùng game. Rồi biến
game mẫu thành game của bạn từng bước một, lúc nào cũng giữ cho nó chơi được.

- **Chơi một mình:** `npm run godot:export -- --debug`, `npm run dev`, rồi mở
  http://localhost:5033/?play=my-game: một phòng thật với máy ngồi các ghế còn lại.
- **Chơi thật:** mở http://localhost:5033/, chọn đảo và thẻ của game; mở thêm một cửa sổ
  ẩn danh để làm người chơi còn lại.
- **Kịch bản e2e:** `npm run e2e -- --only godot-my-game` (cần bản debug và `npm run dev`). CI
  chạy mọi kịch bản `godot-*`.

Nếu `package-lock.json` bị xung đột khi bạn merge `main` vào nhánh của mình, chạy `npm install`.

## Một game gồm những gì

Một game có hai phần nói chuyện với nhau qua sự kiện:

- **`Game`** (phần logic, TypeScript, chạy trên server): khai báo người chơi làm được gì
  (`events`), và mỗi sự kiện chạy một hook trả về state kế tiếp. Server là bên quyết định mọi thứ.
  Mọi hook nhận một `ctx` chứa cả phòng: state, người chơi và ghế, chủ phòng, tỉ số, tuỳ chọn.
- **Bàn chơi Godot** (`godot/main.gd`, chạy trong client của từng người): vẽ `snapshot.view` mỗi
  khi có `state_changed`, gửi sự kiện khi người chơi bấm, và làm hiệu ứng theo nước vừa đi
  (`snapshot.last`).

```
 client của Lan                       server                           client của mọi người
 ──────────────                       ──────                           ────────────────────
 bấm nút
   └ _client.send("add", {amount}) ─► events.add kiểm tra dữ liệu
                                      onAdd(ctx) → State mới ────────► state_changed
                                      view(ctx, người xem)              vẽ snapshot.view
```

Mẫu tối thiểu nằm trong `scripts/templates/` (`game/`, `event/`, `godot/`, `e2e/`). Ví dụ hoàn
chỉnh: `games/tic-tac-toe` (Caro: tuỳ chọn phòng, người chơi máy, bảng Tạo phòng) và
`games/tien-len` (Tiến Lên trong Godot: bài, hiệu ứng, âm thanh).

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

`ctx` luôn chứa cả phòng: `state`, `players` (ghế, tên, có phải máy không), `hostId`, `score`,
`options`, `rng`, `finish()`, `lastResult` (kết quả ván trước) và, trong hook sự kiện, `player`,
`payload`, `reject()`. Bàn Godot nhận phòng qua `client.snapshot` (`view`, `seats`, `status`,
`options`, `score`, `last`, `timer`, `result`) và `client.player_id`.

## Thư mục

```
games/<id>/
  src/index.ts        đầu vào phía server: definePlugin({ meta, game: new MyGame(), room? })
  src/game/           bản thân game: TypeScript thuần, không DOM (chạy trên server)
    MyGame.ts           State, các sự kiện và hook của chúng: đọc file này trước
    MyGame.test.ts      test (npm run check chạy chúng)
  godot/              bàn chơi trong client Godot (GDScript)
    main.tscn, main.gd  bàn chơi: vẽ snapshot.view, gửi sự kiện
    test/test_main.gd   test GUT (npm run godot:check)
    art/, sounds/, music/  hình, âm thanh và nhạc bàn chơi dùng (kèm file .import Godot viết)
  assets/             hình (.webp/.png) và âm thanh (.wav/.mp3) cỡ đầy đủ; godot/ chép bản cần dùng
  sources/            file gốc tuỳ chọn (PNG lớn, .psd/.kra, âm thanh thô); xem bên dưới
  RULES.md            luật hiện tại cho người chơi (bảng Luật trong client đọc file này)
  README.md           các file nằm ở đâu và ghi công
```

Chỉ `src/index.ts` là bắt buộc; không có `godot/main.tscn` thì thẻ trò trong sảnh hiện "Sắp có".
Phần còn lại sắp xếp tuỳ bạn. Server nạp `src/`, client Godot nạp `godot/` (thành một gói `.pck`
riêng của game).

Phần TypeScript của game chỉ được import `@xomdao/sdk`, `zod` và file của chính nó; lint sẽ kiểm
tra. Import tương đối kết thúc bằng `.js` (`./model.js`), vì server chạy JS đã biên dịch.

### Tạo file mới từ mẫu

Giống "Create > C# Script" trong Unity, `npm run new` viết sẵn một file có đủ các hook kèm chú
thích, chỉ việc điền vào. Chạy từ thư mục gốc của repo kèm id của game, hoặc chạy bên trong
`games/<id>/` thì bỏ id đi. Không ghi `Tên` thì lấy tên game; file đã có sẽ không bị ghi đè.

| Lệnh | Tạo ra |
| --- | --- |
| `npm run new -- logic <id> [Tên]` | `src/game/<Tên>Game.ts` (một `Game`) và file test |
| `npm run new -- options <id>` | `src/game/options.ts` (tuỳ chọn phòng) |
| `npm run new:game -- <id> "Tên" --genre <g> [--layout ban\|hanh-dong]` | cả một game: luật, test, `godot/`, e2e, RULES.md, README |
| `npm run new:event -- <id> "Tên" [--opens …] [--closes …]` | cả một sự kiện, như trên, thêm ngày mở/đóng và dải thưởng |

Lệnh in ra dòng cần thêm vào `index.ts` để dùng file mới. Các mẫu nằm trong
`scripts/templates/`.

## Màn hình Godot (`godot/`)

Client Godot (`apps/client/`) chỉ vẽ state và gửi nước đi; luật vẫn ở TypeScript trên server.
Mỗi game có `godot/main.tscn`, gốc là một `Control` có script `main.gd`:

- `bind(client: XomDaoClient)`: hub gọi một lần khi ván bắt đầu. Nghe `client.state_changed`,
  vẽ `client.snapshot` (`snapshot.view` là `view` của game, khoá camelCase như trên server;
  `snapshot.seats`, `snapshot.status`, `client.player_id`).
- Gửi sự kiện: `await _client.send("add", {"amount": 2})`.
- `sandbox_options() -> Dictionary`: tuỳ chọn phòng cho `?play=<id>` (bản debug), thường là có
  máy chơi.
- `room_setup() -> Array`: các hàng của bảng Tạo phòng,
  `{key, label, options: [[nhãn, giá trị], …], default?}`, khớp `room.options`.
- `result_detail() -> Dictionary`: phần game thêm vào bảng kết quả, dưới dòng Thời gian của hub:
  `{reason: "Đen thắng · Trắng hết nước", rows: [["Số lượt đi", 42], …]}`.
- Hình và âm thanh: chép bản cần dùng từ `assets/` vào `godot/art/`, `godot/sounds/`, rồi
  `load("res://content/<id>/art/<tên>.webp")`. Nhạc nền: đặt file nhạc vào `godot/music/`; hub
  phát ngẫu nhiên một bài khi game đang chơi.
- Hub vẽ nút ☰, phòng chờ, bảng kết quả (có **Xem bàn** để xem bàn cuối, **Kết quả** để mở lại)
  và bảng Luật (đọc `RULES.md`). Game để trống ô vuông
  88 × 88 ở góc trên trái cho nút ☰ và chỉ vẽ bàn chơi.
- Theo một bố cục mẫu trong `docs/experience.md`: **Bàn** (bàn ở giữa cao gần trọn khung, ô
  người chơi quanh bàn, của mình ở dưới, nút hành động dưới phải) hoặc **Hành động** (cảnh chơi,
  mục tiêu trên trái dưới ☰, bộ đếm trên phải, điều khiển dưới trái, nút hành động dưới phải).
- Dựng giao diện bằng bộ UI chung (`XomDaoButton`, `XomDaoPlayerSlot`, `XomDaoChip`, màu và font
  trong `XomDaoUi`), không tự làm nút hay font riêng. Toạ độ là đơn vị thiết kế trên khung cao
  720, rộng 960 đến 1600; đặt vị trí trong `_layout()` theo `XomDaoFrame.safe_inset(self)` và lề
  `XomDaoSettings.current().margin`.
- Script của game chỉ dùng thư mục của nó (`res://content/<id>/`) và `res://addons/xomdao_sdk/`;
  `npm run godot:check` kiểm tra điều này, định dạng, lint và chạy test GUT.
- Đặt tên mọi node mà test bấm hoặc đọc (`Add_1`, `Seat_0`, `Status`): test GUT tìm theo tên,
  kịch bản e2e bấm qua `window.xomdao` (`scripts/e2e/godot.mjs`).

`apps/client/AGENTS.md` (tiếng Anh) có đủ quy tắc của client; các mẫu bố cục nằm trong
`scripts/templates/godot/`, ví dụ đầy đủ là `games/tien-len/godot/`.

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
- Chỉ lấy ngẫu nhiên qua `ctx.rng` (`shuffle(ctx.rng, deck)`, `pick`, `int` từ `@xomdao/sdk`), không
  bao giờ dùng `Math.random()`, để test có thể chơi lại đúng một ván.
- **Hẹn giờ**: `ctx.setTimer(ms, 'turn-over')` hẹn server gọi `onTurnOver(ctx)` sau `ms` mili
  giây (ví dụ đồng hồ mỗi lượt, khoảng nghỉ giữa các vòng, chờ hoạt ảnh chia bài xong). Mỗi game
  có một hẹn giờ: đặt lại là thay cái cũ, `ctx.clearTimer()` để huỷ, ván kết thúc thì tự dừng.
  Người chơi không gửi được sự kiện hẹn giờ. Bàn Godot thấy nó qua `snapshot.timer` để vẽ đồng
  hồ.
- **Người rời bàn giữa ván**: mặc định ván dừng cho cả bàn. Viết `onLeave(ctx)` (`ctx.player` là
  người vừa rời) thì ván chơi tiếp không có họ, ví dụ xử thua. Ghế không bao giờ đổi trong một
  ván: người đã rời vẫn nằm trong `ctx.players` với `left: true`.
- Test bằng `testGame(plugin, ['a', 'b'])` (hoặc `testGame(new MyGame(), …)`):
  `.send('a', 'place', { cell: 4 })`, `.error(...)`, `.state`, `.result`, `.view(player)`,
  `.assertHidden(viewer, secret)`, `.bot(player)`, `.newGame()` (ván kế tiếp trong cùng phòng),
  `.timer` và `.fireTimer()` (cho hẹn giờ nổ ngay), `.leave(player)`. Tuỳ chọn
  `{ bots: ['b'] }` đánh dấu người chơi máy.

## Dùng Dev Console

`npm run dev` bật `XOMDAO_DEV=1` cho server. Vào **phòng thật** (hoặc sandbox `/?play=<id>`, cũng
là phòng thật) trên bản debug, mở DevTools của trình duyệt và gửi lệnh qua cầu nối test:

```js
xomdao.request('dev:command', { line: 'help' })   // gửi một dòng lệnh
xomdao.reply()                                    // câu trả lời ({ ok, ... }), null khi chưa có
```

Game nào cũng có các lệnh engine. `help` liệt kê lệnh, `help dice` xem một lệnh cụ thể. Chuỗi
nối bằng `;` chạy lần lượt từng lệnh; lỗi dừng chuỗi. Kịch bản e2e dùng đúng cách này (hàm `cmd`
trong `scripts/e2e/scenarios/godot-co-ty-phu-classic.mjs`).

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
log phòng (`dev:logs`) và terminal của server. Log giữ tối đa 500 dòng, chi tiết quá lớn bị cắt
quanh 20 KB. Server không có `XOMDAO_DEV=1` từ chối mọi lệnh dev.

## Lệnh dev (tuỳ chọn)

Game không cần khai báo gì để dùng lệnh engine và `as`. Muốn có lệnh riêng, khai báo
`commands` cùng hook `cmd<Name>`; `catalogs` cung cấp giá trị có tên cho `@danh-mục:id`:

```ts
import { catalog, type CommandContext, Game, type StartContext } from '@xomdao/sdk';
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

## Tuỳ chọn phòng và chơi với máy (tuỳ chọn)

Một game có thể có tuỳ chọn phòng (ví dụ "chơi với bạn hay với máy?"). Khi ai đó bấm
**Tạo phòng**, hub hiện bảng Tạo phòng với các hàng do bàn Godot khai trong `room_setup()`, rồi
gửi object đã chọn làm tuỳ chọn của phòng. Không có `room_setup()` thì phòng được tạo ngay.
`npm run new -- options <id>` tạo sẵn `src/game/options.ts`.

```gdscript
# godot/main.gd: mỗi hàng là một khoá của optionsSchema
func room_setup() -> Array:
	return [
		{"key": "opponent", "label": "Chơi với", "options": [["Bạn bè", "human"], ["Máy", "bot"]]},
		{"key": "level", "label": "Máy chơi", "options": [["Dễ", "easy"], ["Khó", "hard"]], "default": 1},
	]

# tuỳ chọn cho sandbox ?play=<id> (bản debug)
func sandbox_options() -> Dictionary:
	return {"opponent": "bot"}
```

```ts
// src/index.ts
export default definePlugin({
  meta,
  game: new MyGame(),
  room: {
    options: optionsSchema,                                  // zod; server kiểm tra object
    bots: (options) => (options.opponent === 'bot' ? 1 : 0), // tuỳ chọn: số ghế cho máy
    // tuỳ chọn: tuỳ chọn khi máy ngồi `count` ghế trống của phòng ghép nhanh (nút CHƠI)
    withBots: (options, count) => ({ ...options, opponent: count > 0 ? 'bot' : 'human' }),
  },
});
```

- Tuỳ chọn tới tay game dưới dạng `ctx.options`; bàn Godot đọc `snapshot.options`.
- Ghép nhanh (CHƠI ở sảnh) cho người vào phòng đang chờ của trò; không ai tới sau vài giây
  thì server gọi `withBots` để máy ngồi các ghế trống rồi bắt đầu. Trò không có `withBots` thì
  phòng ghép nhanh chỉ chờ người.
- Người chơi máy: viết hook `bot(ctx)` trong `Game`, trả về sự kiện của máy cho ghế `ctx.player`
  (ví dụ `{ event: 'place', payload: { x, y } }`), hoặc `null` khi chưa tới lượt. Server chơi nó
  sau một khoảng dừng ngắn và kiểm tra như mọi sự kiện. Test bằng `.bot(player)` của `testGame`.
- Giữa các ván, chủ phòng có thể thay tuỳ chọn bằng yêu cầu `room:options`; `onStart` kế tiếp
  nhận tuỳ chọn mới.

`optionsSchema.parse({})` phải chạy được: các giá trị mặc định đó dùng cho phòng tạo không qua
bảng Tạo phòng. Ghế của máy đứng sau người thật. Khi tuỳ chọn mới cần nhiều hay ít máy hơn, máy
sẽ vào (nếu còn ghế) hoặc rời đi, và tỉ số tính lại từ đầu. Phòng đóng khi người thật cuối cùng
rời đi. Caro (games/tic-tac-toe) là ví dụ (`godot/main.gd`, `src/game/bot.ts`).

## Phần thưởng

Khi hết ván, game thưởng tài nguyên cho người chơi bằng `ctx.reward`:

```ts
ctx.finish([player.id]);
ctx.reward(player.id, 'core:coin', WIN_COINS); // tài nguyên có không gian tên, số nguyên > 0
```

- Khai báo mức tối đa một người nhận trong một ván ở `meta.rewardCap` (`{ 'core:coin': 20 }`).
  Server từ chối phần vượt mức, chỉ trả một lần cho mỗi ván và không trả cho máy.
- Game không tự cộng tiền: sổ cái trên server ghi lại, rồi gửi `reward` kèm số dư mới cho người
  chơi. Caro và Tiến Lên thưởng xu khi thắng (`WIN_COINS` trong `src/game/model.ts`, con số tạm).
- Trong test, phần thưởng nằm ở `game.result.rewards`.

## Thống kê và thành tích

Server tự đếm cho mọi ván xong: `played` (số ván) và `won` (số ván thắng), theo từng người và
từng trò, không đếm máy. Game đếm thêm điều riêng của nó bằng `ctx.stat`:

```ts
if (isChop(combo, table)) ctx.stat(player.id, 'chop'); // tên chữ thường, có thể có gạch nối
ctx.stat(player.id, 'golden-carp', 2);                 // số nguyên > 0, mặc định 1
```

Thành tích là dữ liệu trong `meta.achievements`, không cần viết code:

```ts
achievements: [
  { id: 'chop', name: 'Chặt heo', stat: 'chop', at: 1, xp: 30, reward: { 'core:coin': 30 } },
],
```

- Khi số đếm của `stat` trong trò này chạm `at`, server mở thành tích, cộng `xp` vào kinh nghiệm
  và trả `reward` qua sổ cái đúng một lần. Người chơi nhận thông báo "Thành tích: …".
- Thành tích chung của cả xóm (Ván đầu tiên, Mười trận thắng…) ở
  `packages/shared/src/achievements.ts`; chúng đếm `played` và `won` trên mọi trò.
- Kinh nghiệm: 10 cho mỗi ván, cộng `xp` của các thành tích đã đạt. Cấp N bắt đầu ở
  50 × N × (N − 1) kinh nghiệm: cấp 2 ở 100, cấp 3 ở 300, cấp 4 ở 600.
- Xếp hạng: Cả xóm theo kinh nghiệm, mỗi trò theo số ván thắng. Xem ở Đình, và hạng của từng người
  ở tab Xếp hạng trong Nhà.
- Đừng đổi hay dùng lại `id` của thành tích đã phát hành: người chơi giữ thành tích theo nó.
- Trong test, số đếm nằm ở `game.result.stats`.

## Thẻ trò trong sảnh

`meta` trong `src/index.ts` cũng là thẻ trò của game ở sảnh Godot:

```ts
meta: {
  id: 'tien-len',
  name: 'Tiến Lên',
  minPlayers: 2,
  maxPlayers: 4,
  status: 'ready',
  portal: { image: 'island' },
  genre: 'bai',                                        // đảo thể loại; bỏ trống = chưa lên sảnh
  tagline: 'Đánh hết bài trên tay trước mọi người.',   // một câu, tối đa 80 ký tự
  duration: { min: 5, max: 15 },                       // phút một ván
  card: 'card',                                        // tuỳ chọn: tranh thẻ trong assets/, mặc định portal.image
  rewardCap: { 'core:coin': 50 },                      // tuỳ chọn: thưởng tối đa một ván
}
```

- `genre` là id trong danh sách thể loại của lõi (`genres` trong
  `packages/shared/src/catalog.ts`): `co` (Cờ), `bai` (Bài) hoặc `su-kien` (Sự kiện). Thêm thể
  loại là thêm một dòng ở đó, không sửa code sảnh.
- `kind` mặc định là `table`. Sự kiện dùng `kind: 'event'`, `genre: 'su-kien'` và thêm
  `event: { opensAt, closesAt, tiers, color? }` (ngày ISO, dải thưởng theo mốc điểm tăng dần,
  màu bảng chi tiết `#RRGGBB`). Xem mục "Sự kiện" bên dưới.
- Test registry (`npm run check`) báo lỗi khi khai báo sai: thể loại không có, thời lượng ngược,
  tài nguyên không có không gian tên (`core:coin`), sự kiện thiếu ngày.
- Server gửi danh mục qua `catalog:get`: thể loại, thẻ trò, số người đang chơi và số phòng còn
  chỗ. Trò `wip` không có trong danh mục của server thật (Render).

## Sự kiện

Sự kiện là một trò có ngày mở và ngày đóng. `npm run new:event -- <id> "Tên"` tạo một sự kiện
mẫu; ví dụ đầy đủ là `games/trung-thu` (Câu cá Trung Thu, một người chơi).

```ts
meta: {
  kind: 'event',
  genre: 'su-kien',
  rewardCap: { [EVENT_POINTS]: MAX_POINTS },           // điểm sự kiện tối đa một ván
  event: {
    opensAt: '2026-09-18T00:00:00+07:00',
    closesAt: '2026-10-04T00:00:00+07:00',
    color: '#B3261E',
    tiers: [{ points: 10, reward: { 'core:coin': 50 } }, { points: 25, reward: { 'core:coin': 100 } }],
  },
}
```

- Game cho điểm sự kiện bằng `ctx.reward(player.id, EVENT_POINTS, n)` (`EVENT_POINTS` =
  `'event:point'` trong `@xomdao/sdk`). Điểm không vào số dư: server cộng vào tiến độ của người chơi
  trong sự kiện, mỗi ván một lần, chỉ khi sự kiện đang mở.
- Người chơi bấm **Nhận** ở mỗi mốc đã đủ điểm; sổ cái trả `reward` của mốc đó đúng một lần.
- Ngoài khoảng ngày, sự kiện không có trong danh mục và server từ chối mở phòng mới của nó.
- Thử sự kiện ngoài ngày của nó: chạy server với `XOMDAO_NOW=2026-09-25T20:00:00+07:00`, hoặc gửi
  `dev:clock { at }` (chế độ dev; `at: null` trả về giờ thật).

## Hình và âm thanh

`assets/` giữ file hoàn chỉnh cỡ đầy đủ; bàn Godot dùng bản chép trong `godot/art/`,
`godot/sounds/` và `godot/music/` (thư mục `godot/` là gói của game, nên chỉ chép thứ bàn vẽ hay
phát). Làm bằng cách nào cũng được: tự vẽ, tạo bằng AI, render bằng Blender, vẽ bằng code
(`_draw()` trong GDScript), tài nguyên miễn phí trên mạng; chọn cái trông và nghe hợp với game
nhất, ghi nguồn khi tiện. `assets/island.webp` là tranh thẻ của game (`meta.portal.image`, hoặc
`meta.card`); chừng nào client chưa hiện tranh thẻ, sảnh vẽ một thẻ tạm.

Hình gốc lớn có thể để trong `sources/` (lưu bằng Git LFS), rồi `npm run assets -- <id>` tạo file
sẵn dùng: mỗi hình trong `sources/` thành một `assets/<cùng tên>.webp` đã cắt viền và thu nhỏ (tuỳ
chọn cho từng hình trong `sources/prompts.json`: `transparent`, `maxSize`).

Âm thanh thì không có bước build: file trong `assets/` chính là bản gốc dùng được. Muốn cắt, đổi
tốc độ hay chỉnh âm lượng, sửa thẳng file đó (ví dụ bằng `ffmpeg`, hoặc nhờ Claude sửa giúp) rồi
chép lại vào `godot/sounds/`. Hiệu ứng ngắn dùng WAV mono 16-bit (MP3 thêm một chút trễ ở đầu),
nhạc dùng MP3. Các file trong `godot/music/` là nhạc nền của game: khi bàn chơi hiện, hub phát
ngẫu nhiên một bài.

Để tạo hình bằng Codex (nếu bạn có), thêm một prompt vào `sources/prompts.json`
(`{ "assets": { "card-back": { "transparent": true, "maxSize": 256, "prompt": "…" } } }`) rồi chạy
`npm run gen:asset -- <id>/card-back`.
Khung hình cho animation: thêm `"from": "<tên hình gốc>"` và `"preserveCanvas": true`, prompt chỉ
tả chỗ khác đi. Codex sẽ sửa từ hình gốc nên nhân vật và bố cục giữ nguyên (tạo hình gốc trước).

### Kết xuất Blender và normal map

Helper chung ở `tools/blender/xomdao_bake/`: vật liệu, `cube`/`sphere`/`lathe`, `setup`/`render`,
đèn trên trái và pass normal. Cờ Vua, Cờ Đam và Cờ Vây dùng cùng bộ này.

```sh
npm run blender -- chess pieces cloth
npm run blender -- chess piece-white-knight
npm run blender -- checkers cloth
npm run blender -- go cloth
```

Cách dễ nhất là cài Blender dạng module Python (`bpy`) bằng một lệnh. Lệnh cần Python 3.13
và cài vào `.tools/blender` (git bỏ qua); phiên bản ghim trong `tools/blender/requirements.txt`:

```sh
npm run setup:blender
npm run blender -- chess pieces
```

Khi chưa cài, lệnh dùng `blender` (Blender CLI) và Pillow của máy. `XOMDAO_BLENDER_PYTHON` chọn
một Python khác có `bpy` và Pillow; Python 3.13 không phải `python3` thì đặt `XOMDAO_PYTHON` cho
`setup:blender`.

Lệnh chạy lần lượt mọi `sources/render*.py` của game; mỗi script chỉ kết xuất những tên của
nó trong danh sách (không ghi tên thì kết xuất hết). Cũng chạy trực tiếp được bằng `python games/chess/sources/render_assets.py -- pieces` hoặc
`blender -b -t 4 --python games/chess/sources/render_assets.py -- pieces`;
`XOMDAO_BLENDER_BIN` chọn Blender ở đường dẫn khác. PNG trung gian nằm trong `.blender/<id>/`,
chỉ commit script Python và tài nguyên sẵn dùng; không cần thêm `.blend` hay file nguồn LFS.
Đổi một quân Cờ Vua sẽ ghép lại atlas `pieces`; lần đầu sẽ kết xuất thêm quân còn thiếu.
`npm run blender -- go bowl bowl-lid` kết xuất riêng hộp và nắp.

Normal map mang tên `assets/<name>.normal.webp`, cùng kích thước với `<name>.webp` và
**đục hoàn toàn** (không alpha): khi nạp hình theo kiểu premultiplied alpha, pixel viền nửa
trong suốt sẽ làm vector normal ngắn lại và sáng tối sai. Chỗ trống là mặt phẳng
`(128,128,255)`; viền hoà dần về mặt phẳng. Atlas dùng cùng toạ độ khung, không xoay hoặc cắt
canvas. Trục X sang phải, Y lên trên, Z
hướng người xem. Mặt phẳng nhìn thẳng phải đọc gần `(128,128,255)`. Xuất pass emission
camera-space bằng **Raw**, không dùng Standard vì vẫn chuyển sang sRGB; tắt dither và lưu
WebP **lossless**. Không đưa normal map qua bước cắt viền, chỉnh màu hay nén mất dữ liệu.
Kiểm tra bằng `python tools/blender/test_bake.py` hoặc
`blender -b --python tools/blender/test_bake.py`.

Nền vải dùng tile POT 256×256 liền mép: bàn Godot lát nó kín màn hình (`TextureRect` với
`STRETCH_TILE`, như `games/chess/godot/main.gd`), nên không cần ảnh phủ toàn màn hình trong bộ
nhớ điện thoại.

## Xong chưa?

Đặt `status: 'ready'` trong `src/index.ts`. Trước đó game hiện ở máy dev, còn server thật (Render,
cũng là server của bản xem trước PR) không đưa nó vào danh mục, nên bạn có thể merge phần làm dở
bất cứ lúc nào.

Trước khi xong: `npm run check`, `npm run godot:check`, chơi thử ở sandbox, và
`npm run e2e -- --changed origin/main` (tính cả thay đổi chưa commit trong working tree).
