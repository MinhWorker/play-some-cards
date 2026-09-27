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

Ví dụ để xem: `games/counter` ("Bấm Nút", nhỏ nhất; README của nó liệt kê mọi hook) và
`games/tic-tac-toe` (Caro: thêm tuỳ chọn phòng, người chơi máy, màn cài đặt).

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

## Màn hình (`GameView`)

```ts
export class MyView extends GameView<State, Options> {
  onCreate(ctx) { /* tạo đối tượng: this.label, this.button, this.sprite, hoặc Phaser */ }
  onLayout(ctx) { /* đặt vị trí theo ctx.screen (chạy lại khi đổi cỡ màn hình) */ }
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
  `isHost`, `score`, `options`, `result`, `timer` (`endsAt`, `ms`: vẽ đồng hồ đếm ngược) và `screen`
  (cỡ, tâm, `top` = chỗ trống đầu tiên dưới thanh phòng, `hud` = tỉ lệ cho điện thoại nhỏ).
- `this.avatar(player)` cho ảnh đại diện của người chơi (máy có ảnh robot), dùng với
  `this.add.image(x, y, this.avatar(player))`.
- `this.sprite('card')` hiện `assets/card.webp`; `this.texture('card')` cho `setTexture`;
  `this.sfx('deal')` phát `assets/deal.wav` theo âm lượng hiệu ứng của người chơi.
- `this.button('Đánh', onTap, { image: 'button' })` là nút có nền `assets/button.webp`. Nền là
  9-slice: nút to nhỏ, dài ngắn thế nào thì bốn góc vẫn giữ nguyên hình, chỉ phần giữa giãn ra.
  Mặc định mỗi góc rộng bằng nửa cạnh ngắn của ảnh, hợp với nút viên thuốc hay hộp bo góc; ảnh
  khác thì đặt `slice` (số điểm ảnh từ mép vào, một số cho cả bốn cạnh hoặc `[trái, phải, trên,
  dưới]`).
- Hình có file `.json` cùng tên là atlas (nhiều khung gộp một ảnh): `this.anim('hop')` tạo hoạt
  ảnh từ mọi khung theo thứ tự tên, dùng với `sprite.play(...)`.
- `titleStyle(size)`, `hudScale()`, `this.fitText(...)` và `this.boardArea()` giữ đúng phong cách
  của ứng dụng và vừa điện thoại nhỏ.
- Bảng thắng/hoà, nút "Chơi ván mới", thanh phòng và âm thanh khi thắng đã được ứng dụng làm sẵn.
  Game tự vẽ bảng xếp hạng thì đặt `defineClient({ showsResult: true })`: bảng của ứng dụng chỉ
  còn các nút. Game tự vẽ danh sách người chơi thì đặt `showsPlayers: true` để thanh phòng ẩn
  danh sách của nó trong lúc chơi.
- Thanh phòng có "Rời phòng" (về danh sách phòng của game) và nút 🏠 (rời phòng, về thẳng trang
  chủ). Bấm một trong hai giữa ván sẽ được hỏi lại "Bỏ dở ván này?" (rời đi là dừng ván cho cả
  bàn). Đổi chữ trong `client.ts`:
  `defineClient({ scene, leaveConfirm: { title, message, stay, leave } })` (chỗ nào không ghi thì
  giữ chữ mặc định), hoặc `leaveConfirm: false` để tắt, như Bấm Nút.

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
trên bản đồ trang chủ (`meta.portal.image`).

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

## Xong chưa?

Đặt `status: 'ready'` trong `src/index.ts`. Trước đó game chơi được ở máy dev và bản xem trước của
PR, còn trên trang thật thì bị khoá ("sắp có"), nên bạn có thể merge phần làm dở bất cứ lúc nào.
