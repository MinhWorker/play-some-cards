import {
  type Button,
  type FlowHandle,
  GameView,
  type LitLayer,
  type ViewContext,
} from '@psc/sdk/client';
import type Phaser from 'phaser';
import { legalMoves, type Options, ROLL_MS, STEP_MS, type State } from '../game/model.js';
import { COLORS, horsePoint } from './board.js';

type Ctx = ViewContext<State, Options>;
interface Piece {
  image: Phaser.GameObjects.Image;
  number: Phaser.GameObjects.Text;
}

const RULES = [
  'Mỗi bên có 4 ngựa. Ra 1 hoặc 6 được xuất chuồng.',
  'Ra 6 được tung tiếp, kể cả khi không có nước đi.',
  'Đi đúng số nút. Không vượt qua ngựa, không đứng chung ô.',
  'Đến đúng ô ngựa đối thủ thì đá ngựa đó về chuồng.',
  'Đi hết một vòng, dừng đúng cửa chuồng rồi mới vào.',
  'Ở cửa: ra số nào vào ô số đó. Trong chuồng: ra số ô kế tiếp để nhích một ô.',
  'Lần lượt xếp đủ ngựa vào ô 6, 5, 4, 3 để thắng.',
  'Quá 30 giây: máy tự tung hoặc chọn một nước hợp lệ.',
].join('\n\n');

export class CoCaNguaView extends GameView<State, Options> {
  private board!: Phaser.GameObjects.Image;
  private marks!: Phaser.GameObjects.Graphics;
  private cards!: Phaser.GameObjects.Graphics;
  private pieces: Piece[][] = [];
  private lit!: LitLayer;
  private status!: Phaser.GameObjects.Text;
  private countdown!: Phaser.GameObjects.Text;
  private die!: Phaser.GameObjects.Image;
  private rollButton!: Button;
  private horseButtons: Button[] = [];
  private playerRows: {
    icon: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.Text;
    score: Phaser.GameObjects.Text;
  }[] = [];
  private rulesButton!: Button;
  private rulesPanel!: Phaser.GameObjects.Container;
  private rulesBackdrop!: Phaser.GameObjects.Graphics;
  private rulesShield!: Phaser.GameObjects.Zone;
  private rulesText!: Phaser.GameObjects.Text;
  private rulesClose!: Button;
  private moving = new Set<string>();
  private rolling = false;
  private moveFlow?: FlowHandle;
  private rollFlow?: FlowHandle;
  private layout = { left: 0, top: 0, side: 0, column: 0, rightX: 0, leftX: 0 };

  protected onCreate(ctx: Ctx) {
    this.pieces = [];
    this.playerRows = [];
    this.moving = new Set();
    this.rolling = false;
    this.moveFlow = undefined;
    this.rollFlow = undefined;
    this.board = this.sprite('board');
    this.marks = this.add.graphics().setDepth(2);
    this.cards = this.add.graphics();
    this.lighting({ ambient: 0xd0d0d0, intensity: 0.32 });
    this.lit = this.litLayer();
    this.lit.layer.setDepth(3);
    this.status = this.label('', { size: 30, color: '#fff0ce' }).setStroke('#092b30', 2);
    this.countdown = this.label('', { size: 24, color: '#a8c7c7' }).setStroke('#092b30', 1);
    this.die = this.sprite('dice-1');
    this.rollButton = this.button(
      'Tung',
      () => {
        if (!this.rulesPanel.visible) this.send('roll');
      },
      {
        image: 'button',
        slice: 48,
        size: 34,
        hoverSound: false,
      },
    );
    this.horseButtons = Array.from({ length: 4 }, (_, horse) =>
      this.button(`${horse + 1}`, () => this.choose(horse), {
        image: 'button',
        slice: 48,
        size: 32,
        hoverSound: false,
      }),
    );
    this.rulesButton = this.button('Luật', () => this.showRules(true), { size: 28 });
    for (const [seat, team] of ctx.state.horses.entries()) {
      this.pieces.push(
        team.map((_, horse) => {
          const image = this.image(0, 0, 'horses', COLORS[ctx.state.colors[seat] ?? 0]?.frame);
          this.lit.add(image);
          image.setInteractive({ useHandCursor: true }).on('pointerup', () => {
            if (seat === this.ctx.state.turn) this.choose(horse);
          });
          return {
            image,
            number: this.label(`${horse + 1}`, { size: 24, color: '#ffffff' }).setDepth(4),
          };
        }),
      );
      this.playerRows.push({
        icon: this.image(0, 0, 'horses', COLORS[ctx.state.colors[seat] ?? 0]?.frame),
        name: this.label('', { size: 28 }).setStroke('#092b30', 2),
        score: this.label('', { size: 24, color: '#d4e1d8' }).setStroke('#092b30', 1),
      });
    }
    this.rulesBackdrop = this.add.graphics();
    this.rulesShield = this.add
      .zone(0, 0, ctx.screen.width, ctx.screen.height)
      .setOrigin(0)
      .setInteractive();
    this.rulesText = this.label(RULES, { size: 24, color: '#fff0ce' })
      .setStroke('#092b30', 1)
      .setOrigin(0, 0);
    this.rulesClose = this.button('Đóng', () => this.showRules(false), {
      image: 'button',
      slice: 48,
      size: 30,
    });
    this.rulesPanel = this.add
      .container(0, 0, [
        this.rulesShield,
        this.rulesBackdrop,
        this.rulesText,
        this.rulesClose.container,
      ])
      .setDepth(20)
      .setVisible(false);
    this.showRules(false);
  }

  protected onLayout(ctx: Ctx) {
    // Side controls retain 88-unit tap targets even on the narrowest 4:3 frame.
    const { width, height, top } = ctx.screen;
    const side = Math.min(640, height - top - 16, width - 416);
    const left = (width - side) / 2;
    const boardTop = top + (height - top - side - 16) / 2;
    const column = Math.min(232, left - 24);
    const leftX = left - column / 2 - 12;
    const rightX = left + side + column / 2 + 12;
    this.layout = { left, top: boardTop, side, column, leftX, rightX };
    this.board.setPosition(width / 2, boardTop + side / 2).setDisplaySize(side, side);
    const ui = Math.min(ctx.screen.hud, column / 172);
    this.status.setFontSize(28 * ui).setPosition(rightX, boardTop + 32);
    this.countdown.setFontSize(24 * ui).setPosition(rightX, boardTop + 76);
    this.die.setPosition(rightX, boardTop + 128).setDisplaySize(96, 96);
    this.rollButton.setSize(column, 88).setPosition(rightX, boardTop + 216);
    const buttonW = (column - 8) / 2;
    const choicesTop = boardTop + side - 236;
    this.horseButtons.forEach((button, horse) => {
      button
        .setSize(buttonW, 88)
        .setPosition(
          rightX + ((horse % 2 ? 1 : -1) * (buttonW + 8)) / 2,
          choicesTop + Math.floor(horse / 2) * 96,
        );
    });
    this.rulesButton.setSize(column, 72).setPosition(rightX, boardTop + side - 32);
    this.playerRows.forEach((row, seat) => {
      const y =
        boardTop +
        56 +
        seat * Math.min(140, (side - 112) / Math.max(1, this.playerRows.length - 1));
      row.icon.setPosition(leftX - column / 2 + 32, y - 6).setDisplaySize(66, 66);
      row.name
        .setFontSize(28 * ui)
        .setOrigin(0, 0.5)
        .setPosition(leftX - column / 2 + 64, y - 16);
      row.score.setFontSize(24 * ui).setPosition(leftX, y + 30);
    });
    for (const [seat, team] of this.pieces.entries())
      for (const [horse, piece] of team.entries()) {
        this.runtime.cancelTweens(piece.image);
        this.placePiece(piece, seat, horse, ctx.state.horses[seat]?.[horse]?.position ?? -1);
      }
    const panelW = Math.min(780, width - 64);
    const panelH = Math.min(640, height - 48);
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;
    this.rulesBackdrop
      .clear()
      .fillStyle(0x001a1e, 0.98)
      .fillRoundedRect(panelX, panelY, panelW, panelH, 24);
    this.rulesBackdrop.lineStyle(3, 0xd9b566).strokeRoundedRect(panelX, panelY, panelW, panelH, 24);
    this.rulesText
      .setFontSize(24)
      .setWordWrapWidth(panelW - 64)
      .setPosition(panelX + 32, panelY + 28);
    this.rulesClose.setSize(184, 80).setPosition(width / 2, panelY + panelH - 52);
    this.rulesShield.setSize(width, height);
    this.rulesShield.input?.hitArea.setTo(0, 0, width, height);
    // Container hit rectangles keep their creation size unless updated explicitly.
    for (const button of [
      this.rollButton,
      ...this.horseButtons,
      this.rulesButton,
      this.rulesClose,
    ]) {
      button.container.input?.hitArea.setTo(0, 0, button.container.width, button.container.height);
    }
  }

  pointXY(
    seat: number,
    horse: number,
    position = this.ctx.state.horses[seat]?.[horse]?.position ?? -1,
  ) {
    const [gx = 7, gy = 7] = horsePoint(this.ctx.state, seat, horse, position);
    const { left, top, side } = this.layout;
    return {
      x: left + side / 2 + ((gx - 7) * side * 0.4) / 6.5,
      y: top + side / 2 + ((gy - 7) * side * 0.4) / 6.5,
    };
  }

  private placePiece(piece: Piece, seat: number, horse: number, position: number) {
    const at = this.pointXY(seat, horse, position);
    const size = this.layout.side * 0.081;
    piece.image
      .setPosition(at.x, at.y - size * 0.12)
      .setDisplaySize(size, size)
      .setAlpha(1);
    piece.number.setPosition(at.x, at.y + size * 0.39).setFontSize(Math.max(18, size * 0.44));
    piece.image.setVisible(!this.ctx.players[seat]?.left);
    piece.number.setVisible(!this.ctx.players[seat]?.left);
  }

  private reset(ctx: Ctx) {
    this.runtime.cancelLane('roll');
    this.runtime.cancelLane('move');
    this.runtime.cancelLane('result');
    this.rolling = false;
    this.moving.clear();
    this.rollFlow = undefined;
    this.moveFlow = undefined;
    this.showRules(false);
    this.die.setAngle(0).setAlpha(1);
    this.die.setTexture(this.texture(`dice-${ctx.state.lastRoll?.value ?? 1}`));
    for (const [seat, team] of this.pieces.entries())
      for (const [horse, piece] of team.entries()) {
        this.placePiece(piece, seat, horse, ctx.state.horses[seat]?.[horse]?.position ?? -1);
      }
  }

  protected onStart(ctx: Ctx) {
    this.reset(ctx);
    this.sfx('ludo-game-start');
  }

  protected onResync(ctx: Ctx) {
    this.reset(ctx);
  }

  private showRules(visible: boolean) {
    this.rulesPanel.setVisible(visible);
    if (this.rulesShield.input) this.rulesShield.input.enabled = visible;
    if (this.rulesClose.container.input) this.rulesClose.container.input.enabled = visible;
  }

  protected onRoll(ctx: Ctx) {
    this.animateRoll(ctx);
  }
  protected onRollDice(ctx: Ctx) {
    this.animateRoll(ctx);
  }
  protected onTimeout(ctx: Ctx) {
    if (ctx.state.lastMove) this.animateMove(ctx);
    else this.animateRoll(ctx);
  }

  private animateRoll(ctx: Ctx) {
    const value = ctx.state.lastRoll?.value ?? 1;
    this.rolling = true;
    this.rollFlow = this.runtime.run(
      async (fx) => {
        await fx.sound('ludo-dice-roll');
        for (let frame = 0; frame < 6; frame++) {
          this.die.setTexture(this.texture(`dice-${((value + frame) % 6) + 1}`));
          await fx.tween({ targets: this.die, angle: frame % 2 ? -12 : 12, duration: ROLL_MS / 6 });
        }
        fx.checkpoint();
        this.die.setAngle(0).setTexture(this.texture(`dice-${value}`));
        this.rolling = false;
        this.refresh(this.ctx);
        if (value === 6) this.sfx('ludo-dice-six');
        else if (ctx.state.phase === 'pause') this.sfx('ludo-no-move');
      },
      { lane: 'roll', policy: 'replace', onFailure: () => this.onResync(this.ctx) },
    );
  }

  protected onMove(ctx: Ctx) {
    this.animateMove(ctx);
  }

  private animateMove(ctx: Ctx) {
    const move = ctx.state.lastMove;
    if (!move) return;
    const piece = this.pieces[move.seat]?.[move.horse];
    if (!piece) return;
    const key = `${move.seat}:${move.horse}`;
    this.moving.add(key);
    const victim = move.capture ? this.pieces[move.capture.seat]?.[move.capture.horse] : undefined;
    if (move.capture) this.moving.add(`${move.capture.seat}:${move.capture.horse}`);
    const pendingRoll = this.rollFlow;
    this.moveFlow = this.runtime.run(
      async (fx) => {
        if (pendingRoll) await pendingRoll.done;
        fx.checkpoint();
        for (const position of move.path) {
          const at = this.pointXY(move.seat, move.horse, position);
          const size = this.layout.side * 0.081;
          await fx.sound(move.from < 0 ? 'ludo-token-leave' : 'ludo-token-step');
          await fx.tween({
            targets: piece.image,
            x: at.x,
            y: at.y - size * 0.12 - 6,
            duration: STEP_MS * 0.55,
            ease: 'Sine.easeOut',
          });
          await fx.tween({
            targets: piece.image,
            y: at.y - size * 0.12,
            duration: STEP_MS * 0.45,
            ease: 'Sine.easeIn',
          });
          fx.checkpoint();
          piece.number.setPosition(at.x, at.y + size * 0.39);
        }
        if (victim && move.capture) {
          await fx.sound('ludo-token-bump');
          const home = this.pointXY(move.capture.seat, move.capture.horse, -1);
          await fx.tween({
            targets: victim.image,
            x: home.x,
            y: home.y - this.layout.side * 0.081 * 0.12,
            duration: 260,
            ease: 'Sine.easeInOut',
          });
        }
        fx.checkpoint();
        this.moving.delete(key);
        if (move.capture) this.moving.delete(`${move.capture.seat}:${move.capture.horse}`);
        this.placePiece(piece, move.seat, move.horse, move.to);
        if (victim && move.capture)
          this.placePiece(victim, move.capture.seat, move.capture.horse, -1);
        if (move.finish) this.sfx('ludo-token-finish');
        else if (move.to >= 52) this.sfx('ludo-token-safe');
        this.refresh(this.ctx);
      },
      { lane: 'move', onFailure: () => this.onResync(this.ctx) },
    );
  }

  protected onEnd(ctx: Ctx) {
    const pending = this.moveFlow;
    this.runtime.run(
      async (fx) => {
        if (pending) await pending.done;
        fx.checkpoint();
        this.refresh(ctx);
        await fx.sound('ludo-win', { duck: true, wait: 'finished' });
      },
      { lane: 'result' },
    );
  }

  protected onState(ctx: Ctx) {
    for (const [seat, team] of this.pieces.entries())
      for (const [horse, piece] of team.entries()) {
        if (!this.moving.has(`${seat}:${horse}`))
          this.placePiece(piece, seat, horse, ctx.state.horses[seat]?.[horse]?.position ?? -1);
      }
    if (!this.rolling) this.die.setTexture(this.texture(`dice-${ctx.state.lastRoll?.value ?? 1}`));
    this.refresh(ctx);
  }

  private canPlay(ctx: Ctx) {
    return (
      !ctx.result &&
      ctx.me?.seat === ctx.state.turn &&
      !ctx.me.left &&
      !this.rolling &&
      this.moving.size === 0
    );
  }

  private choose(horse: number) {
    const ctx = this.ctx;
    if (this.rulesPanel.visible || !this.canPlay(ctx) || ctx.state.phase !== 'choose') return;
    if (!legalMoves(ctx.state).some((m) => m.horse === horse)) return;
    this.sfx('ludo-token-select');
    this.send('move', { horse });
  }

  private refresh(ctx: Ctx) {
    const { state, players, me, result } = ctx;
    const turn = players[state.turn];
    const winner = state.winner === null ? null : players[state.winner];
    const color = COLORS[state.colors[state.turn] ?? 0];
    const mine = turn?.id === me?.id;
    const status = result
      ? `${winner?.id === me?.id ? 'Bạn' : (winner?.name ?? '…')} thắng!`
      : mine
        ? 'Lượt bạn'
        : `Lượt ${turn?.name ?? ''}`;
    this.status.setColor(result ? '#ffe2a0' : (color?.text ?? '#fff0ce'));
    this.fitText(this.status, status, this.layout.column, 24);
    this.rollButton.setText(
      state.phase === 'roll'
        ? 'Tung'
        : state.phase === 'choose'
          ? 'Chọn ngựa'
          : state.lastMove
            ? state.notice || 'Đang đi'
            : state.dice === 6
              ? 'Thêm lượt'
              : 'Bỏ lượt',
    );
    this.rollButton.setEnabled(this.canPlay(ctx) && state.phase === 'roll');
    const moves = this.canPlay(ctx) && state.phase === 'choose' ? legalMoves(state) : [];
    const g = this.marks.clear();
    for (const move of moves) {
      const at = this.pointXY(state.turn, move.horse);
      g.lineStyle(3, 0xffe2a0).strokeCircle(at.x, at.y, this.layout.side * 0.036);
    }
    this.horseButtons.forEach((button, horse) => {
      const valid = moves.some((m) => m.horse === horse);
      button.setEnabled(valid);
      const h = state.horses[state.turn]?.[horse];
      button.setText(h?.finished ? `${horse + 1} ✓` : `${horse + 1}`);
    });
    const cards = this.cards.clear();
    this.playerRows.forEach((row, seat) => {
      const player = players[seat];
      const y = row.name.y + 16;
      const { leftX, column } = this.layout;
      cards.fillStyle(0x062b31, 0.9).fillRoundedRect(leftX - column / 2, y - 54, column, 108, 16);
      cards
        .lineStyle(
          state.turn === seat && !result ? 3 : 1,
          state.turn === seat ? 0xf4d88a : 0x53716e,
          0.9,
        )
        .strokeRoundedRect(leftX - column / 2, y - 54, column, 108, 16);
      row.name.setColor(COLORS[state.colors[seat] ?? 0]?.text ?? '#ffffff');
      const name = `${ctx.hostId === player?.id ? '♛ ' : ''}${player?.id === me?.id ? 'Bạn' : (player?.name ?? '')}`;
      this.fitText(row.name, name, column - 70, 24);
      row.score.setText(
        player?.left
          ? 'Đã rời bàn'
          : `${state.horses[seat]?.filter((h) => h.finished).length ?? 0}/4 về đích`,
      );
      row.icon.setAlpha(player?.left ? 0.3 : 1);
    });
    this.updateClock(ctx);
  }

  private updateClock(ctx: Ctx) {
    this.countdown.setText(
      ctx.result || ctx.timer?.event !== 'timeout'
        ? ''
        : `${Math.max(0, Math.ceil((ctx.timer.endsAt - Date.now()) / 1000))} giây`,
    );
  }
  protected onUpdate(ctx: Ctx) {
    this.updateClock(ctx);
  }
}
