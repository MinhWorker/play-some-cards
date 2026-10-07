import {
  type Button,
  type FlowHandle,
  GameView,
  type LitLayer,
  type ViewContext,
} from '@psc/sdk/client';
import type Phaser from 'phaser';
import {
  CELEBRATION_MS,
  legalMoves,
  type Options,
  ROLL_MS,
  STEP_MS,
  type State,
} from '../game/model.js';
import { COLORS, horsePoint } from './board.js';
import { victoryBadge } from './victoryBadge.js';

type Ctx = ViewContext<State, Options>;
interface Piece {
  image: Phaser.GameObjects.Image;
  number: Phaser.GameObjects.Text;
}

const RULES = [
  {
    title: 'Xuất chuồng',
    text: 'Mỗi người có bốn ngựa cùng màu. Tung được một trong hai mặt dưới đây để đưa ngựa ra ô xuất phát.',
    illustration: 'spawn',
  },
  {
    title: 'Thêm lượt',
    text: 'Tung được mặt dưới đây thì được tung tiếp, kể cả khi không có nước đi. Đá ngựa và về đích không tự cho thêm lượt.',
    illustration: 'six',
  },
  {
    title: 'Chạy trên bàn',
    text: 'Đi đúng số nút trên xúc xắc. Không vượt qua bất kỳ ngựa nào, kể cả ngựa của mình. Không dừng ở ô có ngựa cùng màu.',
  },
  {
    title: 'Đá ngựa',
    text: 'Đến đúng ô có ngựa đối thủ thì đá ngựa đó về chuồng. Ô xuất phát cũng đá được; không có ô an toàn.',
  },
  {
    title: 'Đến cửa chuồng',
    text: 'Đi hết một vòng và dừng đúng cửa chuồng của màu mình, ngay trước ô xuất phát. Không dùng số dư để đi thẳng vào chuồng.',
  },
  {
    title: 'Vào chuồng',
    text: 'Ở cửa chuồng, tung được mặt nào thì vào ô mang số đó. Không được vượt qua ngựa khác hoặc đi quá ô đích đang cần.',
    illustration: 'entry',
  },
  {
    title: 'Nhích trong chuồng',
    text: 'Trong chuồng, chỉ nhích một ô khi tung đúng số của ô tiếp theo. Ví dụ: đang ở ô ngay trước ô minh họa dưới đây.',
    illustration: 'promote',
  },
  {
    title: 'Về đích',
    text: 'Đưa bốn ngựa lần lượt tới các ô dưới đây. Ngựa đã về đích đứng yên và không đi tiếp.',
    illustration: 'finish',
  },
  {
    title: 'Thường hoặc phân hạng',
    text: 'Thường: ván kết thúc khi có người về đích đủ bốn ngựa. Phân hạng: người đã hoàn thành nghỉ lượt; bàn chơi tiếp đến khi xác định hết thứ hạng. Người còn lại cuối cùng nhận hạng cuối.',
  },
  {
    title: 'Thời gian và rời bàn',
    text: 'Mỗi lần tung hoặc chọn ngựa có 30 giây. Hết giờ, máy tự chơi. Không có nước đi thì bỏ lượt. Người rời bàn được bỏ qua; người chưa hoàn thành rời bàn không được xếp hạng.',
  },
];

export class CoCaNguaView extends GameView<State, Options> {
  private board!: Phaser.GameObjects.Image;
  private marks!: Phaser.GameObjects.Graphics;
  private cards!: Phaser.GameObjects.Graphics;
  private pieces: Piece[][] = [];
  private lit!: LitLayer;
  private status!: Phaser.GameObjects.Text;
  private countdown!: Phaser.GameObjects.Text;
  private die!: Phaser.GameObjects.Image;
  private rollHint!: Phaser.GameObjects.Text;
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
  private rulesTitle!: Phaser.GameObjects.Text;
  private rulesArt!: Phaser.GameObjects.Graphics;
  private rulesArtLabels: Phaser.GameObjects.Text[] = [];
  private rulesPrevious!: Button;
  private rulesNext!: Button;
  private rulesPageLabel!: Phaser.GameObjects.Text;
  private rulesPage = 0;
  private rulesLayout = { x: 0, y: 0, width: 0, height: 0 };
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
    this.rulesPage = 0;
    this.rulesArtLabels = [];
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
    this.die.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (!this.rulesPanel.visible && this.canPlay(this.ctx) && this.ctx.state.phase === 'roll')
        this.send('roll');
    });
    this.rollHint = this.label('', { size: 28, color: '#ffe2a0' }).setStroke('#092b30', 2);
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
    this.rulesTitle = this.label('', { size: 40, color: '#ffe2a0' }).setOrigin(0, 0);
    this.rulesArt = this.add.graphics();
    this.rulesPageLabel = this.label('', { size: 28, color: '#d4e1d8' });
    this.rulesPrevious = this.button('‹', () => this.changeRule(-1), {
      image: 'button',
      slice: 48,
      size: 64,
    });
    this.rulesNext = this.button('›', () => this.changeRule(1), {
      image: 'button',
      slice: 48,
      size: 64,
    });
    this.rulesText = this.label('', { size: 36, color: '#fff0ce' })
      .setStroke('#092b30', 1)
      .setOrigin(0, 0)
      .setAlign('left');
    this.rulesClose = this.button('Đóng', () => this.showRules(false), {
      image: 'button',
      slice: 48,
      size: 30,
    });
    this.rulesPanel = this.add
      .container(0, 0, [
        this.rulesShield,
        this.rulesBackdrop,
        this.rulesTitle,
        this.rulesText,
        this.rulesArt,
        this.rulesPageLabel,
        this.rulesPrevious.container,
        this.rulesNext.container,
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
    this.die
      .setPosition(rightX, boardTop + 168)
      .setDisplaySize(Math.min(180, column, side * 0.28), Math.min(180, column, side * 0.28));
    this.rollHint.setFontSize(28 * ui).setPosition(rightX, boardTop + 272);
    const buttonW = (column - 8) / 2;
    const choicesTop = boardTop + side - 212;
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
    const panelW = Math.min(1120, width - 32);
    const panelH = Math.min(640, height - top - 32);
    const panelX = (width - panelW) / 2;
    const panelY = top + (height - top - panelH) / 2;
    this.rulesLayout = { x: panelX, y: panelY, width: panelW, height: panelH };
    this.rulesBackdrop
      .clear()
      .fillStyle(0x001a1e, 0.98)
      .fillRoundedRect(panelX, panelY, panelW, panelH, 24);
    this.rulesBackdrop.lineStyle(3, 0xd9b566).strokeRoundedRect(panelX, panelY, panelW, panelH, 24);
    this.rulesTitle.setPosition(panelX + 140, panelY + 32);
    this.rulesText
      .setFontSize(36)
      .setWordWrapWidth(panelW - 280)
      .setPosition(panelX + 140, panelY + 114);
    this.rulesClose.setSize(124, 64).setPosition(panelX + panelW - 82, panelY + 52);
    this.rulesPrevious.setSize(104, 144).setPosition(panelX + 64, panelY + panelH / 2);
    this.rulesNext.setSize(104, 144).setPosition(panelX + panelW - 64, panelY + panelH / 2);
    this.rulesPageLabel.setPosition(width / 2, panelY + panelH - 36);
    this.drawRule();
    this.rulesShield.setSize(width, height);
    this.rulesShield.input?.hitArea.setTo(0, 0, width, height);
    // Container hit rectangles keep their creation size unless updated explicitly.
    for (const button of [
      ...this.horseButtons,
      this.rulesButton,
      this.rulesClose,
      this.rulesPrevious,
      this.rulesNext,
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
    this.runtime.cancelLane('celebration');
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
    for (const button of [this.rulesClose, this.rulesPrevious, this.rulesNext])
      if (button.container.input) button.container.input.enabled = visible;
  }

  private changeRule(delta: number) {
    this.rulesPage = Math.max(0, Math.min(RULES.length - 1, this.rulesPage + delta));
    this.drawRule();
  }

  private drawRule() {
    const rule = RULES[this.rulesPage];
    if (!rule) return;
    this.rulesTitle.setText(rule.title);
    this.rulesText.setText(rule.text);
    this.rulesPageLabel.setText(`${this.rulesPage + 1} / ${RULES.length}`);
    this.rulesPrevious.setEnabled(this.rulesPage > 0);
    this.rulesNext.setEnabled(this.rulesPage < RULES.length - 1);
    for (const label of this.rulesArtLabels) label.destroy();
    this.rulesArtLabels = [];
    const g = this.rulesArt.clear();
    const { x, y, width, height } = this.rulesLayout;
    const cy = y + height - 150;
    const addLabel = (text: string, cx: number, color = '#ffe2a0', size = 40) => {
      const label = this.label(text, { size, color }).setPosition(cx, cy).setFontSize(size);
      this.rulesArtLabels.push(label);
      this.rulesPanel.add(label);
    };
    const dice = (value: number, cx: number) => {
      g.fillStyle(0xfff4de).fillRoundedRect(cx - 42, cy - 42, 84, 84, 12);
      g.lineStyle(3, 0xd9b566).strokeRoundedRect(cx - 42, cy - 42, 84, 84, 12);
      const pips =
        value === 1
          ? [[0, 0]]
          : value === 3
            ? [
                [-22, -22],
                [0, 0],
                [22, 22],
              ]
            : [
                [-22, -24],
                [-22, 0],
                [-22, 24],
                [22, -24],
                [22, 0],
                [22, 24],
              ];
      g.fillStyle(0x132d32);
      for (const [dx = 0, dy = 0] of pips) g.fillCircle(cx + dx, cy + dy, 7);
    };
    const square = (value: number, cx: number) => {
      g.fillStyle(0xbf443e).fillRect(cx - 42, cy - 42, 84, 84);
      g.lineStyle(3, 0xffb5a4).strokeRect(cx - 42, cy - 42, 84, 84);
      addLabel(`${value}`, cx, '#fff4de');
    };
    const cx = x + width / 2;
    switch (rule.illustration) {
      case 'spawn':
        dice(1, cx - 112);
        addLabel('hoặc', cx, '#fff0ce', 30);
        dice(6, cx + 112);
        break;
      case 'six':
        dice(6, cx);
        break;
      case 'entry':
        dice(1, cx - 228);
        addLabel('→', cx - 140);
        square(1, cx - 52);
        dice(6, cx + 52);
        addLabel('→', cx + 140);
        square(6, cx + 228);
        break;
      case 'promote':
        square(2, cx - 224);
        addLabel('+', cx - 112);
        dice(3, cx);
        addLabel('→', cx + 112);
        square(3, cx + 224);
        break;
      case 'finish':
        [6, 5, 4, 3].forEach((value, index) => {
          const at = cx - 228 + index * 152;
          square(value, at);
          if (index < 3) addLabel('→', at + 76);
        });
        break;
    }
  }

  private celebrate(seat: number) {
    const team = this.pieces[seat];
    if (!team) return;
    this.runtime.run(
      async (fx) => {
        const fireworks = this.add.graphics().setDepth(8);
        const rank = this.ctx.state.rankings.indexOf(seat) + 1;
        const player = this.ctx.players[seat];
        const color = COLORS[this.ctx.state.colors[seat] ?? 0];
        const badge = victoryBadge(this, color?.ink ?? 0xe7bd64).setAlpha(0);
        const heading = this.label(rank === 1 ? 'CHIẾN THẮNG!' : 'VỀ ĐÍCH!', {
          size: 22,
          color: '#fff0b5',
        })
          .setPosition(61, -34)
          .setFontSize(22)
          .setStroke('#001a1e', 1);
        const name = this.label(player?.id === this.ctx.me?.id ? 'Bạn' : (player?.name ?? ''), {
          size: 34,
          color: color?.text ?? '#ffffff',
        })
          .setPosition(61, -3)
          .setFontSize(34)
          .setStroke('#001a1e', 2);
        this.fitText(name, name.text, 278, 22);
        const placement = this.label(`HẠNG ${rank}`, { size: 26, color: '#553410' })
          .setPosition(61, 35)
          .setFontSize(26)
          .setStroke('#fff1bf', 0);
        badge.add([heading, name, placement]);
        const keys = team.map((_, horse) => `${seat}:${horse}`);
        for (const key of keys) this.moving.add(key);
        fx.defer(() => {
          fireworks.destroy();
          badge.destroy();
          for (const key of keys) this.moving.delete(key);
          team.forEach((piece, horse) => {
            piece.image.setAngle(0);
            this.placePiece(
              piece,
              seat,
              horse,
              this.ctx.state.horses[seat]?.[horse]?.position ?? -1,
            );
          });
          this.refresh(this.ctx);
        });
        await fx.sound('ludo-win', { duck: true });
        let elapsed = 0;
        await fx.frame((dt) => {
          elapsed += dt;
          const { left, top, side } = this.layout;
          const scale = side / 640;
          const entrance = Math.min(1, elapsed / 350);
          const settle = 1 + Math.sin(entrance * Math.PI) * 0.08;
          badge
            .setPosition(left + side / 2, top + side * 0.15 - (1 - entrance) * 20 * scale)
            .setScale(scale * settle)
            .setAlpha(entrance);
          team.forEach((piece, horse) => {
            const at = this.pointXY(seat, horse);
            const bounce = Math.abs(Math.sin(elapsed / 160 + horse * 0.8)) * side * 0.065;
            const sway = Math.sin(elapsed / 220 + horse) * side * 0.012;
            piece.image
              .setPosition(at.x + sway, at.y - side * 0.081 * 0.12 - bounce)
              .setAngle(Math.sin(elapsed / 180 + horse) * 14);
            piece.number.setPosition(at.x + sway, at.y + side * 0.081 * 0.39 - bounce);
          });
          fireworks.clear();
          for (let burst = 0; burst < 6; burst++) {
            const age = elapsed - burst * 330;
            if (age < 0 || age > 1000) continue;
            const progress = age / 1000;
            const cx = left + side * (0.18 + ((burst * 37) % 65) / 100);
            const cy = top + side * (0.22 + ((burst * 23) % 50) / 100);
            const color = [0xffe2a0, 0xff8eaa, 0x88e3ff, 0xa8ebc7][burst % 4] ?? 0xffe2a0;
            for (let spark = 0; spark < 18; spark++) {
              const angle = (spark * Math.PI * 2) / 18;
              const radius = side * 0.2 * progress;
              const px = cx + Math.cos(angle) * radius;
              const py = cy + Math.sin(angle) * radius + side * 0.05 * progress * progress;
              fireworks
                .lineStyle(3, color, 1 - progress)
                .lineBetween(
                  px,
                  py,
                  px - Math.cos(angle) * side * 0.023,
                  py - Math.sin(angle) * side * 0.023,
                );
              fireworks.fillStyle(color, 1 - progress).fillCircle(px, py, 3);
            }
          }
          return elapsed >= CELEBRATION_MS;
        });
      },
      { lane: 'celebration' },
    );
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
        if (ctx.state.horses[move.seat]?.every((h) => h.finished)) this.celebrate(move.seat);
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
        if (
          !ctx.state.lastMove ||
          !ctx.state.horses[ctx.state.lastMove.seat]?.every((h) => h.finished)
        )
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
    const canRoll = this.canPlay(ctx) && state.phase === 'roll';
    this.rollHint.setText(
      state.phase === 'roll'
        ? canRoll
          ? 'Chạm để tung'
          : 'Chờ tung'
        : state.phase === 'choose'
          ? 'Chọn ngựa'
          : state.notice || 'Đang đi',
    );
    this.fitText(this.rollHint, this.rollHint.text, this.layout.column, 20);
    this.rollHint.setAlpha(canRoll ? 0.8 + 0.2 * Math.sin(this.time.now / 240) : 1);
    if (this.die.input) this.die.input.enabled = canRoll;
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
        state.rankings.includes(seat)
          ? `Hạng ${state.rankings.indexOf(seat) + 1}`
          : player?.left
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
    if (this.canPlay(ctx) && ctx.state.phase === 'roll')
      this.rollHint.setAlpha(0.8 + 0.2 * Math.sin(this.time.now / 240));
  }
}
