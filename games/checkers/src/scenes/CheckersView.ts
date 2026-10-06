/**
 * The board, in the browser. The app calls the hooks in lifecycle order; `ctx` has the state,
 * `me`, the players, host, score, options, result and screen size.
 *
 *   onCreate  board, pieces' looks, texts, buttons   onMove   slide the piece hop by hop
 *   onLayout  place everything (and on resize)      onState  pieces, marks, status, buttons
 *   onStart   a new game: clean board
 *
 * On your turn the pieces that may move are ringed. Tap one, then the square to go to; a
 * capture of several pieces is tapped one landing square at a time. The side that moves second
 * sees the board turned round, so your pieces are always at the bottom.
 *
 * The wooden board and ridged discs are rendered assets. Presentation and audio use the SDK runtime.
 */
import {
  type Button,
  type FlowHandle,
  GameView,
  type ViewContext,
  type ViewEvent,
} from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type Move, type Options, RULES, type Side, type View } from '../game/model.js';
import { colOf, isDark, isKing, legalMoves, other, rowOf, sideOf } from '../game/rules.js';
import { PRIMARY_BUTTON, SECONDARY_BUTTON, styleButton } from './buttons.js';
import { formatPlayed, ResultPanel } from './ResultPanel.js';

type Ctx = ViewContext<View, Options>;

const DEPTH = { board: 0, marks: 1, piece: 5, moving: 7 } as const;

const COLORS = {
  last: 0xffe066,
  selected: 0x7fd4ff,
  target: 0x2e9d57,
  movable: 0xffe066,
} as const;

const SIDES: Record<Side, { name: string; art: string; text: string }> = {
  w: { name: 'Trắng', art: 'white', text: '#fff6e0' },
  b: { name: 'Đen', art: 'black', text: '#ffb199' },
};

interface PieceObj {
  piece: string;
  image: Phaser.GameObjects.Image;
}

export class CheckersView extends GameView<View, Options> {
  private board!: Phaser.GameObjects.Image;
  private cards!: Phaser.GameObjects.Graphics;
  private moveCount!: Phaser.GameObjects.Text;
  private panel!: ResultPanel;
  private resultDismissed = false;
  private moveFlow?: FlowHandle;
  private effects = true;
  private marks!: Phaser.GameObjects.Graphics;
  private zone!: Phaser.GameObjects.Zone;
  private status!: Phaser.GameObjects.Text;
  private score!: {
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    lines: Phaser.GameObjects.Text[];
  };
  private leftColumn = { x: 0, width: 200, top: 0, bottom: 400 };
  private buttons!: {
    draw: Button;
    decline: Button;
    resign: Button;
    result: Button;
    effects: Button;
  };
  private buttonStack = { x: 0, bottom: 0, width: 200, height: 40 };
  private pieces = new Map<number, PieceObj>();
  private leaving = new Set<Phaser.GameObjects.Image>();
  /** Where the top-left square's corner is, a square's size, the board's size and turn. */
  private grid = { x0: 0, y0: 0, cell: 60, size: 8, flip: false };
  /** The squares tapped so far for this move: the piece, then each landing square. */
  private path: number[] = [];
  /** The legal moves of this turn (on your turn). */
  private moves: Move[] = [];
  private resignArmed = false;
  private resignTimer?: FlowHandle;

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate() {
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.pieces = new Map();
    this.leaving = new Set();
    this.path = [];
    this.moves = [];
    this.resultDismissed = false;
    this.moveFlow = undefined;
    try {
      this.effects = localStorage.getItem('checkers-effects') !== 'off';
    } catch {
      this.effects = true;
    }
    this.board = this.image(0, 0, 'board').setDepth(DEPTH.board);
    this.cards = this.add.graphics();
    this.moveCount = this.label('', { size: 32, color: '#ead7ae' });
    this.marks = this.add.graphics().setDepth(DEPTH.marks);
    this.zone = this.add
      .zone(0, 0, 10, 10)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (p: Phaser.Input.Pointer) => this.tap(p.worldX, p.worldY));
    this.status = this.label('', { size: 34 });
    this.score = {
      icons: [0, 1].map(() => this.add.image(0, 0, this.pieceKey('w'))),
      names: [0, 1].map(() => this.label('', { size: 26 }).setOrigin(0, 0.5)),
      lines: [0, 1].map(() => this.label('', { size: 20 }).setOrigin(0, 0.5)),
    };
    const opts = SECONDARY_BUTTON;
    this.buttons = {
      draw: styleButton(this.button('Xin hoà', () => this.send('offer-draw'), opts)),
      decline: styleButton(this.button('Từ chối', () => this.send('decline-draw'), opts)),
      resign: styleButton(this.button('Đầu hàng', () => this.resign(), opts)),
      result: styleButton(
        this.button('Kết quả', () => this.showPanel(false), PRIMARY_BUTTON),
        true,
      ),
      effects: styleButton(this.button('', () => this.toggleEffects(), opts)),
    };
    const close = styleButton(
      this.button(
        'Xem bàn cờ',
        () => {
          this.panel.hide();
          this.resultDismissed = true;
        },
        PRIMARY_BUTTON,
      ),
      true,
    );
    this.panel = new ResultPanel(this, close, 20);
  }

  /**
   * On the frame (docs/ui-guide.md): the board as tall as it fits under the room bar, in the
   * middle; the players in the column on its left (yours below); the status line and the
   * buttons in the column on its right.
   */
  protected onLayout(ctx: Ctx) {
    this.runtime.cancelLane('move');
    this.runtime.cancelLane('result');
    for (const image of this.leaving) image.destroy();
    this.leaving.clear();
    const { width, height, top, hud } = ctx.screen;
    const margin = 16;
    const availH = height - top - margin;
    const side = Math.max(160, Math.min(width - 2 * 150 * hud, availH));
    const size = RULES.size;
    const frame = side * 0.03;
    const cell = (side - 2 * frame) / size;
    const left = (width - side) / 2;
    const boardTop = top + Math.max(0, (availH - side) / 2);
    const columnW = left - 2 * margin;
    const flip = this.mySide(ctx) === other(RULES.first);
    this.grid = { x0: left + frame, y0: boardTop + frame, cell, size, flip };
    this.drawBoard(left, boardTop, side);
    this.zone.setPosition(this.grid.x0, this.grid.y0).setSize(cell * size, cell * size);
    this.zone.input?.hitArea.setTo(0, 0, cell * size, cell * size);

    const rightX = left + side + margin + columnW / 2;
    this.status
      .setFontSize(30 * hud)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(columnW)
      .setPosition(rightX, boardTop + 8);
    this.leftColumn = {
      x: margin + columnW / 2,
      width: columnW,
      top: boardTop + 54 * hud,
      bottom: boardTop + side - 54 * hud,
    };
    this.layoutScore(ctx);
    this.buttonStack = {
      x: rightX,
      bottom: boardTop + side,
      width: Math.min(columnW, 190 * hud),
      height: 66 * hud,
    };
    this.placeButtons();
    for (const [sq, obj] of this.pieces) this.placePiece(obj, sq);
    this.drawMarks(ctx);
    this.moveCount.setFontSize(28 * hud).setPosition(this.leftColumn.x, boardTop + side / 2);
    if (ctx.result && !this.resultDismissed) this.showPanel(false);
  }

  /** A new game: an empty board (onState sets the pieces out). */
  protected onStart() {
    this.resetBoard();
    this.sfx('checkers-start');
  }

  private resetBoard() {
    this.panel.hide();
    this.resultDismissed = false;
    this.moveFlow = undefined;
    this.runtime.cancelLane('move');
    this.runtime.cancelLane('result');
    for (const image of this.leaving) image.destroy();
    this.leaving.clear();
    this.resignTimer?.cancel();
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.buttons.resign.setText('Đầu hàng');
    for (const obj of this.pieces.values()) obj.image.destroy();
    this.pieces.clear();
    this.path = [];
  }

  /** A move was played: the piece slides hop by hop, taken pieces fade, a new king is crowned. */
  protected onMove(ctx: Ctx, event: ViewEvent<{ path: number[] }>) {
    const last = ctx.state.last;
    const from = event.payload.path[0] ?? 0;
    const moving = this.pieces.get(from);
    this.path = [];
    if (!moving || !last) return; // onState draws whatever is missing
    const to = last.path[last.path.length - 1] ?? from;
    this.pieces.delete(from);
    const taken = last.captures.map((sq) => this.pieces.get(sq)).filter((o) => o !== undefined);
    for (const sq of last.captures) this.pieces.delete(sq);
    this.pieces.set(to, moving);
    moving.piece = ctx.state.board[to] ?? moving.piece;
    moving.image.setDepth(DEPTH.moving);
    const hops = last.path.slice(1).map((sq) => this.pointXY(sq));
    for (const obj of taken) this.leaving.add(obj.image);
    if (!this.effects) {
      for (const obj of taken) {
        this.leaving.delete(obj.image);
        obj.image.destroy();
      }
      this.placePiece(moving, to);
      this.sfx(
        last.crowned ? 'checkers-promote' : taken.length ? 'checkers-capture' : 'checkers-move',
      );
      return;
    }
    this.moveFlow = this.runtime.run(
      async (fx) => {
        for (const obj of taken)
          fx.defer(() => {
            this.leaving.delete(obj.image);
            obj.image.destroy();
          });
        for (let i = 0; i < hops.length; i++) {
          const at = hops[i];
          if (!at) continue;
          await fx.tween({
            targets: moving.image,
            x: at.x,
            y: at.y,
            duration: 180,
            ease: 'Sine.easeInOut',
          });
          const victim = taken[i];
          await fx.parallel(
            async (sound) => {
              await sound.sound(victim ? 'checkers-capture' : 'checkers-move', {
                wait: 'finished',
              });
            },
            async (capture) => {
              if (!victim) return;
              const { x, top, bottom } = this.leftColumn;
              const bottomSide = this.grid.flip ? other(RULES.first) : RULES.first;
              await capture.tween({
                targets: victim.image,
                x,
                y: sideOf(moving.piece) === bottomSide ? bottom : top,
                alpha: 0,
                scaleX: victim.image.scaleX * 0.3,
                scaleY: victim.image.scaleY * 0.3,
                duration: 180,
                ease: 'Sine.easeIn',
              });
            },
          );
        }
        fx.checkpoint();
        this.placePiece(moving, to);
        if (last.crowned) {
          const ring = this.add
            .graphics()
            .setPosition(moving.image.x, moving.image.y)
            .setDepth(DEPTH.moving);
          fx.defer(() => ring.destroy());
          ring.lineStyle(4, 0xffd56b, 1).strokeCircle(0, 0, this.grid.cell * 0.42);
          await fx.parallel(
            async (sound) => {
              await sound.sound('checkers-promote', { wait: 'finished' });
            },
            async (crown) => {
              await crown.tween({ targets: ring, scale: 1.8, alpha: 0, duration: 380 });
            },
          );
        }
      },
      { lane: 'move', onFailure: () => this.onResync(this.ctx) },
    );
  }

  protected onResync(ctx: Ctx) {
    this.resetBoard();
    this.onState(ctx);
    if (ctx.result) this.showPanel(false);
  }

  protected onState(ctx: Ctx) {
    const size = RULES.size;
    const flip = this.mySide(ctx) === other(RULES.first);
    if (size !== this.grid.size) this.resetBoard();
    if (size !== this.grid.size || flip !== this.grid.flip) this.onLayout(ctx);
    this.syncPieces(ctx);
    const mine = this.mySide(ctx);
    this.moves =
      mine && !ctx.result && ctx.state.turn === mine
        ? legalMoves(ctx.state.board, mine, RULES)
        : [];
    if (this.path.length && !this.moves.some((m) => this.startsWith(m, this.path))) this.path = [];
    this.drawMarks(ctx);
    this.showStatus(ctx);
    this.showButtons(ctx);
    this.layoutScore(ctx);
    this.moveCount.setText(`Nước ${Math.floor(ctx.state.plies / 2) + 1}`);
  }

  protected onEnd(ctx: Ctx) {
    const pending = this.moveFlow;
    this.runtime.run(
      async (fx) => {
        if (pending) await pending.done;
        fx.checkpoint();
        this.showPanel(this.effects);
        await fx.sound(ctx.state.end?.winner ? 'checkers-win' : 'checkers-draw', {
          wait: 'finished',
        });
      },
      { lane: 'result' },
    );
  }

  private toggleEffects() {
    this.effects = !this.effects;
    try {
      localStorage.setItem('checkers-effects', this.effects ? 'on' : 'off');
    } catch {
      /* Storage may be unavailable. */
    }
    const dismissed = this.resultDismissed;
    this.runtime.cancelLane('result');
    this.onResync(this.ctx);
    if (dismissed) {
      this.panel.hide();
      this.resultDismissed = true;
    }
  }

  private showPanel(pop: boolean) {
    const { state, clock } = this.ctx;
    if (!state.end) return;
    const winner = state.end.winner;
    const mine = this.mySide(this.ctx);
    const title = !winner
      ? 'Hoà'
      : mine
        ? winner === mine
          ? 'Chiến thắng!'
          : 'Thua rồi'
        : `${SIDES[winner].name} thắng`;
    const rows: [string, string][] = [];
    if (clock)
      rows.push(['Thời gian', formatPlayed((clock.endedAt ?? Date.now()) - clock.startedAt)]);
    rows.push(
      ['Số lượt đi', String(state.plies)],
      ['Quân đã ăn', `Trắng ${state.taken.w} · Đen ${state.taken.b}`],
    );
    const { x0, y0, cell } = this.grid;
    this.resultDismissed = false;
    this.panel.show(
      {
        title,
        reason: this.status.text,
        kings: winner
          ? [this.pieceKey(winner.toUpperCase())]
          : [this.pieceKey('W'), this.pieceKey('B')],
        rows,
      },
      { x: x0 + cell * 4, y: y0 + cell * 4, width: cell * 8, hud: this.ctx.screen.hud },
      pop,
    );
  }

  // ── Board ───────────────────────────────────────────────────────────────────────────────

  private mySide({ me, state }: Ctx): Side | null {
    if (!me) return null;
    const first = RULES.first;
    return state.players[0] === me.id ? first : state.players[1] === me.id ? other(first) : null;
  }

  /** Screen position of a square's center (turned round for the side moving second). */
  pointXY(sq: number) {
    const { x0, y0, cell, size, flip } = this.grid;
    const row = flip ? size - 1 - rowOf(size, sq) : rowOf(size, sq);
    const col = flip ? size - 1 - colOf(size, sq) : colOf(size, sq);
    return { x: x0 + (col + 0.5) * cell, y: y0 + (row + 0.5) * cell };
  }

  private squareAt(x: number, y: number) {
    const { x0, y0, cell, size, flip } = this.grid;
    let col = Math.floor((x - x0) / cell);
    let row = Math.floor((y - y0) / cell);
    if (col < 0 || col >= size || row < 0 || row >= size) return null;
    if (flip) {
      col = size - 1 - col;
      row = size - 1 - row;
    }
    return row * size + col;
  }

  private drawBoard(left: number, top: number, side: number) {
    this.board.setPosition(left + side / 2, top + side / 2).setDisplaySize(side, side);
  }

  private pieceKey(piece: string) {
    const side = sideOf(piece);
    return this.texture(`piece-${SIDES[side].art}-${isKing(piece) ? 'king' : 'man'}`);
  }

  private placePiece(obj: PieceObj, sq: number) {
    const { x, y } = this.pointXY(sq);
    const size = this.grid.cell * 0.86;
    this.runtime.cancelTweens(obj.image);
    obj.image
      .setTexture(this.pieceKey(obj.piece))
      .setPosition(x, y)
      .setDisplaySize(size, size)
      .setAlpha(1)
      .setDepth(DEPTH.piece);
  }

  /** Makes the screen match the state: pieces appear or go without animation. */
  private syncPieces({ state }: Ctx) {
    for (const [sq, obj] of this.pieces) {
      if (state.board[sq] === obj.piece) continue;
      obj.image.destroy();
      this.pieces.delete(sq);
    }
    for (let sq = 0; sq < state.board.length; sq++) {
      const piece = state.board[sq] ?? '.';
      if (piece === '.' || this.pieces.has(sq)) continue;
      const obj = { piece, image: this.add.image(0, 0, this.pieceKey(piece)) };
      this.pieces.set(sq, obj);
      this.placePiece(obj, sq);
    }
  }

  private startsWith(move: Move, prefix: number[]) {
    return prefix.every((sq, i) => move.path[i] === sq);
  }

  /**
   * The last move's squares; on your turn, rings on the pieces that may move; the picked piece,
   * the squares it has landed on so far, the pieces it takes on the way and where it may go next.
   */
  private drawMarks(ctx: Ctx) {
    const { state } = ctx;
    const { cell } = this.grid;
    const g = this.marks.clear();
    const fill = (sq: number, color: number, alpha: number) => {
      const { x, y } = this.pointXY(sq);
      g.fillStyle(color, alpha).fillRect(x - cell / 2, y - cell / 2, cell, cell);
    };
    if (state.last) for (const sq of state.last.path) fill(sq, COLORS.last, 0.3);
    for (const obj of this.pieces.values()) obj.image.setAlpha(1);
    if (!this.path.length) {
      const starts = new Set(this.moves.map((m) => m.path[0] ?? -1));
      g.lineStyle(Math.max(2, cell * 0.06), COLORS.movable, 0.9);
      for (const sq of starts) {
        const { x, y } = this.pointXY(sq);
        g.strokeCircle(x, y, cell * 0.47);
      }
      return;
    }
    for (const sq of this.path) fill(sq, COLORS.selected, 0.45);
    const matching = this.moves.filter((m) => this.startsWith(m, this.path));
    // Pieces taken on the hops tapped so far fade a little.
    const hops = this.path.length - 1;
    for (const sq of matching[0]?.captures.slice(0, hops) ?? [])
      this.pieces.get(sq)?.image.setAlpha(0.4);
    const next = new Set(matching.map((m) => m.path[this.path.length] ?? -1));
    g.fillStyle(COLORS.target, 0.55);
    for (const sq of next) {
      if (sq < 0) continue;
      const { x, y } = this.pointXY(sq);
      g.fillCircle(x, y, cell * 0.18);
    }
  }

  // ── Taps ────────────────────────────────────────────────────────────────────────────────

  /**
   * A tap: pick a piece that may move, or the next square of its move (the move is sent once
   * the tapped squares make a whole move), or drop the pick.
   */
  private tap(x: number, y: number) {
    const moving = this.runtime
      .inspect()
      .lanes.some((lane) => lane.name === 'move' && (lane.active || lane.pending > 0));
    if (this.panel.shown || moving) return;
    const sq = this.squareAt(x, y);
    if (sq === null || !isDark(this.grid.size, sq)) {
      this.path = [];
      this.drawMarks(this.ctx);
      return;
    }
    const extended = [...this.path, sq];
    const matching = this.path.length ? this.moves.filter((m) => this.startsWith(m, extended)) : [];
    if (matching.length) {
      const done = matching.find((m) => m.path.length === extended.length);
      if (done && matching.length === 1) {
        this.send('move', { path: done.path });
        this.path = [];
      } else this.path = extended;
    } else if (this.moves.some((m) => m.path[0] === sq)) {
      this.sfx('checkers-select');
      this.path = sq === this.path[0] && this.path.length === 1 ? [] : [sq];
    } else this.path = [];
    this.drawMarks(this.ctx);
  }

  // ── Status, score and buttons ───────────────────────────────────────────────────────────

  private nameOf(ctx: Ctx, side: Side) {
    const first = RULES.first;
    const id = ctx.state.players[side === first ? 0 : 1];
    if (id === ctx.me?.id) return 'Bạn';
    return ctx.players.find((p) => p.id === id)?.name ?? SIDES[side].name;
  }

  private showStatus(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    let text: string;
    if (state.end) {
      const { winner, reason } = state.end;
      const loser = winner ? other(winner) : null;
      const how = {
        blocked: loser ? `${this.nameOf(ctx, loser)} hết nước đi` : '',
        resign: loser ? `${this.nameOf(ctx, loser)} đầu hàng` : '',
        left: loser ? `${this.nameOf(ctx, loser)} rời bàn` : '',
        repetition: 'Lặp lại thế cờ ba lần',
        'move-limit': 'Lâu không ăn quân',
        agreement: 'Hai bên đồng ý',
      }[reason];
      text = winner ? `${this.nameOf(ctx, winner)} thắng · ${how}` : `Hoà · ${how}`;
    } else {
      const must = this.moves[0]?.captures.length ? ' · Phải ăn quân' : '';
      text =
        state.turn === mine
          ? `Tới lượt bạn${must}`
          : `Lượt ${SIDES[state.turn].name} · ${this.nameOf(ctx, state.turn)}`;
      if (state.drawOffer && mine && state.drawOffer !== mine) {
        text = `${this.nameOf(ctx, state.drawOffer)} xin hoà`;
      }
    }
    this.status.setText(text);
  }

  private showButtons(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    const playing = Boolean(mine && !state.end && !ctx.result);
    const offered = playing && state.drawOffer && state.drawOffer !== mine;
    const vsBot = ctx.players.some((p) => p.bot);
    const { draw, decline, resign, result, effects } = this.buttons;
    result.container.setVisible(Boolean(ctx.result));
    effects.container.setVisible(!ctx.result);
    effects.setText(`Hiệu ứng: ${this.effects ? 'Bật' : 'Tắt'}`);
    draw.container.setVisible(playing && !vsBot);
    resign.container.setVisible(playing);
    decline.container.setVisible(Boolean(offered));
    draw.setText(offered ? 'Đồng ý hoà' : state.drawOffer === mine ? 'Đã xin hoà' : 'Xin hoà');
    draw.setEnabled(state.drawOffer !== mine);
    resign.setText(this.resignArmed ? 'Chắc chưa?' : 'Đầu hàng');
    this.placeButtons();
  }

  private placeButtons() {
    const { x, bottom, width, height } = this.buttonStack;
    const shown = Object.values(this.buttons).filter((b) => b.container.visible);
    const gap = 8;
    if (this.ctx.result) {
      const top = this.status.y + this.status.height + 24;
      shown.forEach((b, i) => {
        b.setSize(width, height).setPosition(x, top + height / 2 + i * (height + gap));
      });
      return;
    }
    const span = shown.length * height + (shown.length - 1) * gap;
    shown.forEach((b, i) => {
      b.setSize(width, height).setPosition(x, bottom - span + height / 2 + i * (height + gap));
    });
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

  /** The two players in the left column beside their pieces: the bottom side below. */
  private layoutScore({ players, score, state }: Ctx) {
    const { hud } = this.ctx.screen;
    const col = this.leftColumn;
    const icon = 52 * hud;
    const textX = col.x - col.width / 2 + icon + 12 * hud;
    const textW = col.width - icon - 12 * hud;
    const first = RULES.first;
    const g = this.cards.clear();
    const bottomSide = this.grid.flip ? other(first) : first;
    [0, 1].forEach((seat) => {
      const name = this.score.names[seat];
      const line = this.score.lines[seat];
      const img = this.score.icons[seat];
      const player = players[seat];
      if (!name || !line || !img) return;
      const side: Side =
        player && state.players[1] === player.id
          ? other(first)
          : player
            ? first
            : seat
              ? other(first)
              : first;
      const y = side === bottomSide ? col.bottom : col.top;
      g.fillStyle(0x0a1c28, 0.9).fillRoundedRect(
        col.x - col.width / 2 - 4,
        y - 50 * hud,
        col.width + 8,
        100 * hud,
        12,
      );
      g.lineStyle(
        state.turn === side && !state.end ? 3 : 1,
        0xd9a441,
        state.turn === side && !state.end ? 0.9 : 0.25,
      ).strokeRoundedRect(col.x - col.width / 2 - 4, y - 50 * hud, col.width + 8, 100 * hud, 12);
      img
        .setTexture(this.pieceKey(side))
        .setDisplaySize(icon, icon)
        .setPosition(col.x - col.width / 2 + icon / 2, y - 12 * hud);
      name
        .setFontSize(26 * hud)
        .setColor(SIDES[side].text)
        .setPosition(textX, y - 18 * hud);
      this.fitText(
        name,
        player ? `${this.ctx.hostId === player.id ? '♛ ' : ''}${player.name}` : '…',
        textW,
        18 * hud,
      );
      line
        .setFontSize(24 * hud)
        .setText(`Thắng ${score.wins[seat] ?? 0} · Ăn ${state.taken[side]}`)
        .setPosition(col.x - col.width / 2 + 12 * hud, y + 26 * hud);
      this.fitText(line, line.text, col.width - 24 * hud, 24);
    });
  }
}
