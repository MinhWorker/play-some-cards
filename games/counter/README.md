# Bấm Nút

One or two players, a button each, one shared number: every press adds 1. No winner.

A prototype of the **experimental** way to write a game: two classes with lifecycle hooks,
like Unity scripts. `Game` (the logic) runs on the server, which decides everything; `GameView`
(the screen) runs in each player's browser. They talk through events.

```
src/
  index.ts                server entry: meta + gameRules(new CounterGame())
  client.ts               browser entry: defineClient({ scene: CounterView })
  game/CounterGame.ts     the logic: State, events, hooks (server)
  game/CounterGame.test.ts
  scenes/CounterView.ts   the screen: hooks and objects (browser)
assets/                   button.webp, press.wav, island.webp
```

## What happens when someone presses

```
 Lan's browser                     server                           everyone's browser
 ─────────────                     ──────                           ──────────────────
 button tap
   └ this.send('press') ─────────► events.press checks the data
                                   onPress(ctx) → new State ──────► onPress(ctx, event)  bounce
                                                                    onState(ctx)          show
```

## Hooks

| `CounterGame` (server) | when |
| --- | --- |
| `onStart(ctx)` | "Bắt đầu" / "Chơi ván mới": return the first state |
| `on<Event>(ctx)` | a player sent that event (`press` → `onPress`): return the next state, or `ctx.reject('…')` |
| `onEnd(ctx)` | after `ctx.finish(winners)` (optional) |
| `view(ctx, viewer)` | what each player may see (optional; hide cards here) |

| `CounterView` (browser) | when |
| --- | --- |
| `onCreate(ctx)` | the screen opens: make objects (`this.label`, `this.button`, `this.sprite`, or Phaser) |
| `onLayout(ctx)` | after onCreate and on resize: place them (`ctx.screen`) |
| `onStart(ctx)` | a new game began |
| `on<Event>(ctx, event)` | someone's event was played: animate it (`event.player`, `event.isMe`) |
| `onState(ctx)` | after any change: show the state |
| `onEnd(ctx)` | the game is over (`ctx.result`) |
| `onUpdate(ctx, dt)` | every frame (browser only) |

`ctx` always has the whole room: `state`, `players` (seat, name, bot), `hostId`, `score`,
`options`; on the server also `rng`, `finish()` and, in event hooks, `player`, `payload`,
`reject()`; in the browser `me`, `isHost`, `result` and `screen`.

Try it alone: http://localhost:5033/?play=counter&players=2 (with `npm run dev`).
