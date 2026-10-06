/**
 * The two seas, in the browser. The app calls the hooks in lifecycle order; `ctx` has the state
 * as this player may see it, `me`, the players, score, options, result and screen size.
 *
 *   onCreate  texts, buttons, the drawing layers   onFire   a splash, a hit, a ship going down
 *   onLayout  place everything (and on resize)     onState  redraw the seas, status, buttons
 *
 * Setting up, the big sea is yours: tap a ship to pick it, tap it again to turn it, tap a cell
 * to move it there; "Xếp lại" shuffles the fleet, "Sẵn sàng" starts. In battle the big sea is
 * the other side's (tap a cell to fire on your turn) and yours is the small one on the left.
 *
 * Naval sprites and scoped shot presentations preserve the server's hidden information.
 */
import {
  type Button,
  type FlowHandle,
  GameView,
  type ViewContext,
  type ViewEvent,
} from '@psc/sdk/client';
import type Phaser from 'phaser';
import {
  FLEET,
  type Options,
  type Seat,
  SHIP_NAMES,
  type Ship,
  SIZE,
  type View,
  type Waters,
} from '../game/model.js';
import { cellOf, colOf, fits, isVertical, other, rowOf, shipAt } from '../game/rules.js';

type Ctx = ViewContext<View, Options>;

const COLORS = {
  water: 0x1f5f8b,
  grid: 0x6fa8cf,
  frame: 0x0f3552,
  hull: 0x9aa3ab,
  hullEdge: 0x4b545c,
  sunk: 0x3a3f45,
  hit: 0xff5a36,
  miss: 0xeaf6ff,
  picked: 0xffe066,
  last: 0xffe066,
  bad: 0xff3b30,
} as const;

const LETTERS = 'ABCDEFGHIJ';
/** "B5": a cell's name, column letter then row number. */
export const cellName = (cell: number) => `${LETTERS[colOf(cell)]}${rowOf(cell) + 1}`;

interface SeaBox {
  x0: number;
  y0: number;
  cell: number;
}

export class BattleshipView extends GameView<View, Options> {
  private big!: Phaser.GameObjects.Graphics;
  private small!: Phaser.GameObjects.Graphics;
  private panels!: Phaser.GameObjects.Graphics;
  private bigFleet!: Phaser.GameObjects.Container;
  private smallFleet!: Phaser.GameObjects.Container;
  private bigMarks!: Phaser.GameObjects.Graphics;
  private smallMarks!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Text[];
  private zone!: Phaser.GameObjects.Zone;
  private status!: Phaser.GameObjects.Text;
  /** The other fleet's ships, one line each, crossed out once sunk. */
  private fleetLines!: Phaser.GameObjects.Text[];
  private names!: Phaser.GameObjects.Text[];
  private lines!: Phaser.GameObjects.Text[];
  private buttons!: { shuffle: Button; ready: Button; resign: Button };
  private bigSea: SeaBox = { x0: 0, y0: 0, cell: 40 };
  private smallSea: SeaBox = { x0: 0, y0: 0, cell: 10 };
  private column = { left: 0, right: 0, width: 200, top: 0, bottom: 400 };
  private buttonStack = { x: 0, bottom: 0, width: 200, height: 40 };
  /** Setting up: the fleet as placed on this screen (sent on every change). */
  private draft: Ship[] = [];
  /** Setting up: the picked ship. */
  private picked: number | null = null;
  private resignArmed = false;
  private resignTimer?: FlowHandle;

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate() {
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.draft = [];
    this.picked = null;
    this.big = this.add.graphics();
    this.small = this.add.graphics();
    this.panels = this.add.graphics().setDepth(-1);
    this.bigFleet = this.add.container(0, 0).setDepth(1);
    this.smallFleet = this.add.container(0, 0).setDepth(1);
    this.bigMarks = this.add.graphics().setDepth(2);
    this.smallMarks = this.add.graphics().setDepth(2);
    this.effects = this.add.graphics().setDepth(5);
    this.labels = Array.from({ length: SIZE * 2 }, () =>
      this.label('', { size: 18 }).setColor('#dff1ff'),
    );
    this.zone = this.add
      .zone(0, 0, 10, 10)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (p: Phaser.Input.Pointer) => this.tap(p.worldX, p.worldY));
    this.status = this.label('', { size: 30 });
    this.fleetLines = FLEET.map(() => this.label('', { size: 20 }).setOrigin(0.5, 0));
    this.names = [0, 1].map(() => this.label('', { size: 26 }).setOrigin(0, 0.5));
    this.lines = [0, 1].map(() => this.label('', { size: 20 }).setOrigin(0, 0.5));
    const opts = { image: 'button', size: 24 };
    this.buttons = {
      shuffle: this.button('Xếp lại', () => this.shuffle(), opts),
      ready: this.button('Sẵn sàng', () => this.send('ready'), opts),
      resign: this.button('Đầu hàng', () => this.resign(), opts),
    };
  }

  /**
   * On the frame (docs/ui-guide.md): the big sea as tall as it fits under the room bar, in the
   * middle, with its column letters and row numbers; the players and your small sea in the
   * column on its left; the status, the other fleet and the buttons on its right.
   */
  protected onLayout(ctx: Ctx) {
    const { width, height, top, hud } = ctx.screen;
    const margin = 16;
    const availH = height - top - margin;
    const side = Math.max(160, Math.min(width - 2 * 150 * hud, availH));
    const left = (width - side) / 2;
    const boardTop = top + Math.max(0, (availH - side) / 2);
    const cell = side / (SIZE + 0.6);
    this.bigSea = { x0: left + cell * 0.6, y0: boardTop + cell * 0.6, cell };
    const seaW = cell * SIZE;
    this.zone.setPosition(this.bigSea.x0, this.bigSea.y0).setSize(seaW, seaW);
    this.zone.input?.hitArea.setTo(0, 0, seaW, seaW);
    const font = `${Math.round(cell * 0.36)}px`;
    this.labels.forEach((text, i) => {
      const k = i % SIZE;
      if (i < SIZE) {
        text
          .setText(LETTERS[k] ?? '')
          .setPosition(this.bigSea.x0 + (k + 0.5) * cell, boardTop + cell * 0.3);
      } else {
        text
          .setText(String(k + 1))
          .setPosition(left + cell * 0.3, this.bigSea.y0 + (k + 0.5) * cell);
      }
      text.setFontSize(font);
    });

    const columnW = left - 2 * margin;
    this.column = {
      left: margin + columnW / 2,
      right: left + side + margin + columnW / 2,
      width: columnW,
      top: boardTop + 30 * hud,
      bottom: boardTop + side - 30 * hud,
    };
    // Your small sea between the two players.
    const room = this.column.bottom - this.column.top - 110 * hud;
    const smallSide = Math.max(60, Math.min(columnW, room));
    this.smallSea = {
      x0: this.column.left - smallSide / 2,
      y0: (this.column.top + this.column.bottom) / 2 - smallSide / 2,
      cell: smallSide / SIZE,
    };
    this.status
      .setFontSize(24 * hud)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(columnW)
      .setPosition(this.column.right, boardTop + 8);
    this.buttonStack = {
      x: this.column.right,
      bottom: boardTop + side,
      width: Math.min(columnW, 190 * hud),
      height: 56 * hud,
    };
    this.panels.clear().fillStyle(0x082b40, 0.82).lineStyle(1.5, 0x75c4c8, 0.35);
    for (const x of [this.column.left, this.column.right]) {
      this.panels.fillRoundedRect(x - columnW / 2 - 8, boardTop, columnW + 16, side, 18);
      this.panels.strokeRoundedRect(x - columnW / 2 - 8, boardTop, columnW + 16, side, 18);
    }
    this.redraw(ctx);
  }

  /** A new game: the fleet on this screen comes from the server again. */
  protected onStart() {
    this.resignTimer?.cancel();
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.buttons.resign.setText('Đầu hàng');
    this.runtime.cancelLane('placement');
    this.draft = [];
    this.picked = null;
    this.effects.clear();
    this.cameras.main.resetFX();
  }

  protected onShuffle() {
    void this.sfx('battleship-place');
  }

  protected onReady() {
    void this.sfx('battleship-ready');
  }

  protected onEnd(ctx: Ctx) {
    const mine = this.mySeat(ctx);
    if (mine !== null && ctx.state.end?.winner === mine) {
      this.runtime.run(
        async (fx) => {
          await fx.sound('battleship-win', { duck: true, wait: 'finished' });
        },
        { lane: 'shots', policy: 'queue' },
      );
    }
  }

  /** A shell, impact and sinking, all cancelled together on resync or a new game. */
  protected onFire(ctx: Ctx, _event: ViewEvent<{ cell: number }>) {
    const last = ctx.state.last;
    if (!last) return;
    const mine = this.mySeat(ctx);
    // Shots at your sea land on the small one; everyone else's (and yours) on the big one.
    const onSmall = other(last.by) === (mine ?? 0);
    const box = onSmall ? this.smallSea : this.bigSea;
    const x = box.x0 + (colOf(last.cell) + 0.5) * box.cell;
    const y = box.y0 + (rowOf(last.cell) + 0.5) * box.cell;
    this.runtime.run(
      async (fx) => {
        const originX = onSmall
          ? this.bigSea.x0 + (SIZE * this.bigSea.cell) / 2
          : this.smallSea.x0 + (SIZE * this.smallSea.cell) / 2;
        const originY = onSmall ? this.bigSea.y0 : this.smallSea.y0 + SIZE * this.smallSea.cell;
        const shell = this.add.ellipse(originX, originY, 8, 18, 0xffe9a6).setDepth(7);
        shell.setRotation(Math.atan2(y - originY, x - originX) + Math.PI / 2);
        fx.defer(() => shell.destroy());
        await fx.parallel(
          async (flight) => {
            await flight.sound('battleship-fire');
          },
          async (flight) => {
            await flight.tween({ targets: shell, x, y, duration: 220, ease: 'Quad.In' });
          },
        );
        shell.setVisible(false);
        const impact = this.image(x, y, last.hit ? 'burst' : 'splash').setDepth(7);
        impact.setDisplaySize(box.cell * 1.4, box.cell * 1.4);
        fx.defer(() => impact.destroy());
        const ring = this.add.circle(x, y, box.cell * 0.2).setDepth(6);
        ring.setStrokeStyle(Math.max(2, box.cell * 0.06), last.hit ? COLORS.hit : COLORS.miss);
        fx.defer(() => ring.destroy());
        const smoke = last.hit ? this.add.container(x, y).setDepth(6) : null;
        if (smoke) {
          for (let i = 0; i < 3; i++) {
            smoke.add(
              this.add.circle(
                (i - 1) * box.cell * 0.15,
                -i * box.cell * 0.1,
                box.cell * 0.22,
                0x354957,
                0.65,
              ),
            );
          }
          fx.defer(() => smoke.destroy());
        }
        await fx.parallel(
          async (hit) => {
            await hit.sound(last.hit ? 'battleship-hit' : 'battleship-miss');
          },
          async (hit) => {
            await hit.tween({ targets: ring, scale: 3, alpha: 0, duration: 460 });
          },
          async (hit) => {
            await hit.tween({
              targets: impact,
              y: y - box.cell * 0.3,
              scaleX: impact.scaleX * 1.5,
              scaleY: impact.scaleY * 1.5,
              alpha: 0,
              duration: 520,
            });
          },
          async (hit) => {
            if (smoke)
              await hit.tween({
                targets: smoke,
                y: y - box.cell * 0.8,
                scale: 1.8,
                alpha: 0,
                duration: 650,
              });
          },
        );
        if (last.sunk) {
          const wreck = this.shipImage({ cells: last.sunk }, box).setDepth(6);
          fx.defer(() => wreck.destroy());
          fx.defer(() => this.cameras.main.resetFX());
          this.cameras.main.shake(160 + last.sunk.length * 45, 0.001 * last.sunk.length);
          await fx.parallel(
            async (sink) => {
              await sink.sound('battleship-sunk');
            },
            async (sink) => {
              await sink.tween({
                targets: wreck,
                y: wreck.y + box.cell * 0.35,
                alpha: 0,
                duration: 850,
                ease: 'Sine.In',
              });
            },
          );
        }
      },
      { lane: 'shots', policy: 'queue' },
    );
  }

  protected onResync(ctx: Ctx) {
    this.onStart();
    this.onState(ctx);
  }

  protected onState(ctx: Ctx) {
    const mine = this.mySeat(ctx);
    // The server's fleet wins unless this screen is in the middle of arranging it.
    if (mine !== null && ctx.state.phase === 'setup' && !ctx.state.ready[mine]) {
      const theirs = ctx.state.waters[mine].ships;
      if (!this.draft.length || this.picked === null)
        this.draft = theirs.map((s) => ({ cells: [...s.cells] }));
    } else {
      this.draft = [];
      this.picked = null;
    }
    this.redraw(ctx);
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────────────────

  private mySeat({ me, state }: Ctx): Seat | null {
    const i = me ? state.players.indexOf(me.id) : -1;
    return i === 0 || i === 1 ? i : null;
  }

  /** Which sea is big: yours while setting up, the other one in battle (seat 1's for spectators). */
  private bigSeat(ctx: Ctx): Seat {
    const mine = this.mySeat(ctx);
    if (mine === null) return 1;
    return ctx.state.phase === 'setup' && !ctx.result ? mine : other(mine);
  }

  /** Screen position of a cell's center on the big sea (for taps and tests). */
  pointXY(cell: number) {
    const { x0, y0, cell: c } = this.bigSea;
    return { x: x0 + (colOf(cell) + 0.5) * c, y: y0 + (rowOf(cell) + 0.5) * c };
  }

  private redraw(ctx: Ctx) {
    const big = this.bigSeat(ctx);
    const setup = ctx.state.phase === 'setup' && !ctx.result;
    const mine = this.mySeat(ctx);
    const bigWaters =
      setup && big === mine && this.draft.length
        ? { ...ctx.state.waters[big], ships: this.draft }
        : ctx.state.waters[big];
    this.drawSea(this.big, this.bigFleet, this.bigMarks, this.bigSea, bigWaters, ctx, big);
    // The small sea: yours in battle (the first player's for spectators).
    const smallSeat: Seat = mine ?? 0;
    const showSmall = !setup;
    this.small.clear().setVisible(showSmall);
    this.smallFleet.removeAll(true).setVisible(showSmall);
    this.smallMarks.clear().setVisible(showSmall);
    if (showSmall)
      this.drawSea(
        this.small,
        this.smallFleet,
        this.smallMarks,
        this.smallSea,
        ctx.state.waters[smallSeat],
        ctx,
        smallSeat,
      );
    this.showStatus(ctx);
    this.showFleet(ctx);
    this.showPlayers(ctx);
    this.showButtons(ctx);
  }

  /** One sea: water, grid, ships (shown ones), shots, and the last shot or picked ship. */
  private drawSea(
    g: Phaser.GameObjects.Graphics,
    fleet: Phaser.GameObjects.Container,
    marks: Phaser.GameObjects.Graphics,
    box: SeaBox,
    waters: Waters,
    ctx: Ctx,
    seat: Seat,
  ) {
    const { x0, y0, cell } = box;
    const w = cell * SIZE;
    g.clear();
    fleet.removeAll(true);
    marks.clear();
    g.fillStyle(COLORS.frame, 1).fillRoundedRect(
      x0 - cell * 0.12,
      y0 - cell * 0.12,
      w + cell * 0.24,
      w + cell * 0.24,
      cell * 0.2,
    );
    g.fillStyle(COLORS.water, 1).fillRect(x0, y0, w, w);
    for (let row = 0; row < SIZE; row++) {
      g.fillStyle(row % 2 ? 0x246e87 : 0x205e79, 0.7).fillRect(x0, y0 + row * cell, w, cell);
      for (let col = 0; col < SIZE; col++) {
        const cx = x0 + (col + 0.25) * cell;
        const cy = y0 + (row + 0.7) * cell;
        g.lineStyle(1, 0x90dae0, 0.16).lineBetween(cx, cy, cx + cell * 0.25, cy - cell * 0.04);
      }
    }
    g.lineStyle(Math.max(1, cell * 0.03), COLORS.grid, 0.55);
    for (let i = 0; i <= SIZE; i++) {
      g.lineBetween(x0, y0 + i * cell, x0 + w, y0 + i * cell);
      g.lineBetween(x0 + i * cell, y0, x0 + i * cell, y0 + w);
    }
    const shot = new Set(waters.shots.map((s) => s.cell));
    waters.ships.forEach((ship, i) => {
      const sunk = ship.cells.every((c) => shot.has(c));
      const sprite = this.shipImage(ship, box);
      if (sunk) sprite.setTint(0x657a83).setAlpha(0.6);
      fleet.add(sprite);
      const picked = this.picked === i && seat === this.mySeat(ctx) && this.draft.length > 0;
      if (picked) {
        marks.lineStyle(Math.max(2, cell * 0.06), COLORS.picked, 1);
        for (const c of ship.cells)
          marks.strokeRoundedRect(
            x0 + colOf(c) * cell + 2,
            y0 + rowOf(c) * cell + 2,
            cell - 4,
            cell - 4,
            4,
          );
      }
    });
    for (const { cell: at, hit } of waters.shots) {
      const cx = x0 + (colOf(at) + 0.5) * cell;
      const cy = y0 + (rowOf(at) + 0.5) * cell;
      if (hit) {
        marks.fillStyle(0x361f25, 1).fillCircle(cx, cy, cell * 0.27);
        marks
          .lineStyle(Math.max(1.5, cell * 0.05), COLORS.hit, 1)
          .strokeCircle(cx, cy, cell * 0.27);
        marks.lineStyle(Math.max(1.5, cell * 0.06), 0xffd69a, 1);
        const d = cell * 0.14;
        marks
          .lineBetween(cx - d, cy - d, cx + d, cy + d)
          .lineBetween(cx - d, cy + d, cx + d, cy - d);
      } else {
        marks
          .lineStyle(Math.max(1, cell * 0.03), COLORS.miss, 0.6)
          .strokeCircle(cx, cy, cell * 0.22);
        marks.fillStyle(COLORS.miss, 0.85).fillCircle(cx, cy, cell * 0.08);
      }
    }
    const last = ctx.state.last;
    if (last && last.by !== seat && !ctx.result) {
      marks.lineStyle(Math.max(2, cell * 0.05), COLORS.last, 1);
      marks.strokeRect(x0 + colOf(last.cell) * cell, y0 + rowOf(last.cell) * cell, cell, cell);
    }
  }

  private shipImage(ship: Ship, box: SeaBox) {
    const first = ship.cells[0] ?? 0;
    const vertical = isVertical(ship);
    const length = ship.cells.length;
    const x = box.x0 + (colOf(first) + (vertical ? 0.5 : length / 2)) * box.cell;
    const y = box.y0 + (rowOf(first) + (vertical ? length / 2 : 0.5)) * box.cell;
    return this.image(x, y, `ship-${length}`)
      .setDisplaySize(length * box.cell - box.cell * 0.1, box.cell * 0.88)
      .setRotation(vertical ? Math.PI / 2 : 0);
  }

  /** In battle, the fleet on the big sea: each ship, crossed out once sunk. */
  private showFleet(ctx: Ctx) {
    const big = this.bigSeat(ctx);
    const sunk = [...ctx.state.waters[big].sunk];
    const { hud } = ctx.screen;
    const top = this.status.y + this.status.height + 20 * hud;
    const setup = ctx.state.phase === 'setup' && !ctx.result;
    FLEET.forEach((length, i) => {
      const text = this.fleetLines[i];
      if (!text) return;
      const gone = sunk.indexOf(length);
      if (gone >= 0) sunk.splice(gone, 1);
      text
        .setFontSize(20 * hud)
        .setText(`${SHIP_NAMES[length]} ${'■'.repeat(length)}`)
        .setAlpha(gone >= 0 ? 0.35 : 1)
        .setColor(gone >= 0 ? '#ff8a80' : '#ffffff')
        .setPosition(this.column.right, top + i * 28 * hud)
        .setVisible(!setup);
      this.fitText(text, text.text, this.column.width, 14 * hud);
    });
  }

  private nameOf(ctx: Ctx, seat: Seat) {
    const id = ctx.state.players[seat];
    if (id === ctx.me?.id) return 'Bạn';
    return ctx.players.find((p) => p.id === id)?.name ?? `Người ${seat + 1}`;
  }

  private showStatus(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySeat(ctx);
    let text: string;
    if (state.end) {
      const loser = other(state.end.winner);
      const how = {
        sunk: 'Cả hạm đội bị đánh chìm',
        resign: `${this.nameOf(ctx, loser)} đầu hàng`,
        left: `${this.nameOf(ctx, loser)} rời trận`,
      }[state.end.reason];
      text = `${this.nameOf(ctx, state.end.winner)} thắng · ${how}`;
    } else if (state.phase === 'setup') {
      if (mine === null) text = 'Hai bên đang xếp tàu';
      else if (state.ready[mine]) text = 'Đã sẵn sàng · Chờ đối thủ';
      else text = 'Xếp tàu của bạn';
    } else {
      const turn = state.turn === mine ? 'Tới lượt bạn' : `Lượt ${this.nameOf(ctx, state.turn)}`;
      const last = state.last;
      let shot = '';
      if (last) {
        const result = last.sunk
          ? `Chìm ${SHIP_NAMES[last.sunk.length] ?? 'tàu'}!`
          : last.hit
            ? 'Trúng!'
            : 'Trượt';
        shot = `${this.nameOf(ctx, last.by)} bắn ${cellName(last.cell)} · ${result}\n`;
      }
      text = shot + turn;
    }
    this.status.setText(text);
  }

  /** The other player at the top of the left column, you at the bottom. */
  private showPlayers(ctx: Ctx) {
    const { hud } = ctx.screen;
    const mine = this.mySeat(ctx) ?? 0;
    [0, 1].forEach((seat) => {
      const name = this.names[seat];
      const line = this.lines[seat];
      if (!name || !line) return;
      const s = seat as Seat;
      const y = s === mine ? this.column.bottom : this.column.top;
      const x = this.column.left - this.column.width / 2;
      name.setFontSize(26 * hud).setPosition(x, y - 14 * hud);
      const player = ctx.players.find((p) => p.id === ctx.state.players[s]);
      this.fitText(name, player?.name ?? '…', this.column.width, 18 * hud);
      const afloat = FLEET.length - ctx.state.waters[s].sunk.length;
      const wins = ctx.score.wins[player?.seat ?? s] ?? 0;
      const doing =
        ctx.state.phase === 'setup'
          ? ctx.state.ready[s]
            ? 'Sẵn sàng'
            : 'Đang xếp tàu'
          : `Còn ${afloat} tàu`;
      line
        .setFontSize(20 * hud)
        .setText(`Thắng ${wins} · ${doing}`)
        .setPosition(x, y + 16 * hud);
      this.fitText(line, line.text, this.column.width, 14 * hud);
    });
  }

  private showButtons(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySeat(ctx);
    const on = mine !== null && !state.end && !ctx.result;
    const arranging = on && state.phase === 'setup' && mine !== null && !state.ready[mine];
    const { shuffle, ready, resign } = this.buttons;
    shuffle.container.setVisible(arranging);
    ready.container.setVisible(arranging);
    resign.container.setVisible(on && state.phase === 'battle');
    resign.setText(this.resignArmed ? 'Chắc chưa?' : 'Đầu hàng');
    const { x, bottom, width, height } = this.buttonStack;
    const shown = Object.values(this.buttons).filter((b) => b.container.visible);
    const gap = 8;
    const span = shown.length * height + (shown.length - 1) * gap;
    shown.forEach((b, i) => {
      b.setSize(width, height).setPosition(x, bottom - span + height / 2 + i * (height + gap));
    });
  }

  // ── Taps ────────────────────────────────────────────────────────────────────────────────

  private cellAt(x: number, y: number) {
    const { x0, y0, cell } = this.bigSea;
    const col = Math.floor((x - x0) / cell);
    const row = Math.floor((y - y0) / cell);
    if (col < 0 || col >= SIZE || row < 0 || row >= SIZE) return null;
    return cellOf(row, col);
  }

  /** Setting up: pick, turn or move a ship. In battle: fire at the cell on your turn. */
  private tap(x: number, y: number) {
    const ctx = this.ctx;
    const at = this.cellAt(x, y);
    const mine = this.mySeat(ctx);
    if (at === null || mine === null || ctx.result) return;
    const { state } = ctx;
    if (state.phase === 'battle') {
      if (state.turn !== mine || state.waters[other(mine)].shots.some((s) => s.cell === at)) return;
      this.send('fire', { cell: at });
      return;
    }
    if (state.ready[mine] || !this.draft.length) return;
    const hit = this.draft.findIndex((s) => s.cells.includes(at));
    if (hit >= 0 && hit !== this.picked) this.picked = hit;
    else if (hit >= 0) this.turn(hit);
    else if (this.picked !== null) this.move(this.picked, at);
    this.redraw(ctx);
  }

  /** Turns the picked ship round its first cell (if it fits there). */
  private turn(i: number) {
    const ship = this.draft[i];
    const first = ship?.cells[0];
    if (!ship || first === undefined) return;
    const turned = shipAt(rowOf(first), colOf(first), ship.cells.length, !isVertical(ship));
    this.place(i, turned);
  }

  /** Moves the picked ship to start on `at` (or end at the sea's edge when it wouldn't fit). */
  private move(i: number, at: number) {
    const ship = this.draft[i];
    if (!ship) return;
    const vertical = isVertical(ship);
    const length = ship.cells.length;
    const row = vertical ? Math.min(rowOf(at), SIZE - length) : rowOf(at);
    const col = vertical ? colOf(at) : Math.min(colOf(at), SIZE - length);
    this.place(i, shipAt(row, col, length, vertical));
  }

  /** Puts ship `i` at `ship` if it fits among the others, and tells the server; else a red flash. */
  private place(i: number, ship: Ship | null) {
    const others = this.draft.filter((_, k) => k !== i);
    if (!ship || !fits(ship, others, this.ctx.options.spacing)) {
      this.flash(ship ?? this.draft[i]);
      return;
    }
    this.draft = this.draft.map((s, k) => (k === i ? ship : s));
    void this.sfx('battleship-place');
    this.send('arrange', { ships: this.draft });
  }

  /** A red outline where a ship can't go. */
  private flash(ship: Ship | undefined) {
    if (!ship) return;
    const { x0, y0, cell } = this.bigSea;
    const g = this.effects.clear();
    g.lineStyle(Math.max(2, cell * 0.08), COLORS.bad, 1);
    for (const c of ship.cells)
      g.strokeRect(x0 + colOf(c) * cell, y0 + rowOf(c) * cell, cell, cell);
    this.runtime.run(
      async (fx) => {
        await fx.wait(350);
        fx.checkpoint();
        this.effects.clear();
      },
      { lane: 'placement', policy: 'replace' },
    );
  }

  private shuffle() {
    this.picked = null;
    this.draft = [];
    this.send('shuffle');
  }

  private resign() {
    if (this.resignArmed) {
      this.resignTimer?.cancel();
      this.resignArmed = false;
      this.send('resign');
      return;
    }
    this.resignArmed = true;
    this.buttons.resign.setText('Chắc chưa?');
    this.resignTimer = this.runtime.after(3000, () => {
      this.resignArmed = false;
      this.buttons.resign.setText('Đầu hàng');
    });
  }
}
