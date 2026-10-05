import type { FlowHandle, GameScene } from '@psc/sdk/client';
import type Phaser from 'phaser';

export type TilePoint = { x: number; y: number };

/** Independent surface effects, projected onto one Blender board tile. */
export class BoardTileEffect {
  readonly occupancy: Phaser.GameObjects.Graphics;
  readonly movement: Phaser.GameObjects.Graphics;
  readonly buildings: Phaser.GameObjects.Graphics;
  readonly mortgage: Phaser.GameObjects.Graphics;
  readonly group: Phaser.GameObjects.Graphics;
  readonly surface: Phaser.GameObjects.Graphics;
  readonly action: Phaser.GameObjects.Graphics;
  readonly flash: Phaser.GameObjects.Graphics;
  private corners: TilePoint[] = [];
  private selected = false;
  private actionable = false;
  private groupColor: number | null = null;
  private groupEdge = 0;
  private movingColors: number[] = [];
  private occupants: number[] = [];
  private pulseColor = 0xffd568;
  private pulseTween: FlowHandle | null = null;

  constructor(private readonly scene: GameScene) {
    this.group = scene.add.graphics().setDepth(0.2);
    this.buildings = scene.add.graphics().setDepth(0.5);
    this.mortgage = scene.add.graphics().setDepth(0.6);
    this.occupancy = scene.add.graphics().setDepth(1.1);
    this.movement = scene.add.graphics().setDepth(1.2);
    this.surface = scene.add.graphics().setDepth(1);
    this.action = scene.add.graphics().setDepth(3);
    this.flash = scene.add.graphics().setDepth(2).setAlpha(0);
  }

  layout(corners: TilePoint[]) {
    this.corners = corners;
    this.draw();
    this.drawPulse();
    this.drawAction();
    this.drawMovement();
    this.drawGroup();
  }

  setLayerVisible(
    layer:
      | 'selection'
      | 'occupancy'
      | 'movement'
      | 'buildings'
      | 'mortgage'
      | 'group'
      | 'actions'
      | 'event',
    visible: boolean,
  ) {
    const layers = {
      selection: this.surface,
      occupancy: this.occupancy,
      movement: this.movement,
      buildings: this.buildings,
      mortgage: this.mortgage,
      group: this.group,
      actions: this.action,
      event: this.flash,
    };
    layers[layer].setVisible(visible);
  }

  setGroupAccent(color: number | null, innerEdge: number) {
    if (this.groupColor === color && this.groupEdge === innerEdge) return;
    this.groupColor = color;
    this.groupEdge = innerEdge;
    this.drawGroup();
  }

  private drawGroup() {
    this.group.clear();
    if (this.groupColor === null || this.corners.length !== 4) return;
    const points = this.inset();
    const from = points[this.groupEdge]!;
    const to = points[(this.groupEdge + 1) % 4]!;
    this.group.lineStyle(3, this.groupColor, 0.7).lineBetween(from.x, from.y, to.x, to.y);
  }

  setMovingColors(colors: number[]) {
    this.movingColors = [...colors];
    this.drawMovement();
  }

  private drawMovement() {
    const g = this.movement;
    g.clear();
    if (!this.movingColors.length || this.corners.length !== 4) return;
    g.fillStyle(this.movingColors[0]!, 0.12);
    this.path(g, this.inset());
    g.fillPath();
    g.lineStyle(2, this.movingColors[0]!, 0.8);
    this.path(g, this.inset());
    g.strokePath();
  }

  setActionable(actionable: boolean) {
    if (this.actionable === actionable) return;
    this.actionable = actionable;
    this.drawAction();
  }

  private drawAction() {
    const g = this.action;
    g.clear();
    if (!this.actionable || !this.selected || this.corners.length !== 4) return;
    const points = this.inset();
    // Availability only accents the temporary preview outline; owner badges identify deeds.
    g.lineStyle(5, 0x9c661f, 0.9);
    this.path(g, points);
    g.strokePath();
    g.lineStyle(3, 0xffdf74);
    this.path(g, points);
    g.strokePath();
  }

  setSelected(selected: boolean) {
    if (this.selected === selected) return;
    this.selected = selected;
    this.draw();
    this.drawAction();
  }

  setOccupants(colors: number[]) {
    if (colors.length === this.occupants.length && colors.every((c, i) => c === this.occupants[i]))
      return;
    this.occupants = [...colors];
    this.draw();
  }

  pulse(color: number, duration = 650) {
    this.pulseTween?.cancel();
    this.pulseColor = color;
    this.drawPulse();
    this.flash.setAlpha(1);
    this.pulseTween = (this.scene as GameScene).runtime.tween({
      targets: this.flash,
      alpha: 0,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.pulseTween = null;
      },
    });
  }

  reset() {
    this.pulseTween?.cancel();
    this.pulseTween = null;
    this.flash.setAlpha(0);
    this.selected = false;
    this.actionable = false;
    this.action.clear();
    this.movingColors = [];
    this.movement.clear();
    this.buildings.clear();
    this.mortgage.clear();
    this.group.clear();
    this.groupColor = null;
    this.occupants = [];
    this.draw();
  }

  private inset() {
    const center = this.corners.reduce((sum, p) => ({ x: sum.x + p.x / 4, y: sum.y + p.y / 4 }), {
      x: 0,
      y: 0,
    });
    return this.corners.map((p) => ({
      x: p.x + (center.x - p.x) * 0.1,
      y: p.y + (center.y - p.y) * 0.1,
    }));
  }

  private draw() {
    let g = this.surface;
    g.clear();
    this.occupancy.clear();
    if (this.corners.length !== 4) return;
    const points = this.inset();
    if (this.selected) {
      g.fillStyle(0xffd260, 0.18);
      this.path(g, points);
      g.fillPath();
      g.lineStyle(3, 0xf6bd47, 0.95);
      this.path(g, points);
      g.strokePath();
    }
    g = this.occupancy;
    if (!this.occupants.length) return;
    // Different colors share the perimeter when multiple pawns occupy the same tile.
    g.fillStyle(this.occupants[0] ?? 0xffd568, 0.1);
    this.path(g, points);
    g.fillPath();
    for (let edge = 0; edge < 4; edge++) {
      const from = points[edge];
      const to = points[(edge + 1) % 4];
      if (!from || !to) continue;
      for (let seat = 0; seat < this.occupants.length; seat++) {
        const a = seat / this.occupants.length;
        const b = (seat + 1) / this.occupants.length;
        g.lineStyle(3, this.occupants[seat] ?? 0xffd568, 0.9);
        g.lineBetween(
          from.x + (to.x - from.x) * a,
          from.y + (to.y - from.y) * a,
          from.x + (to.x - from.x) * b,
          from.y + (to.y - from.y) * b,
        );
      }
    }
  }

  private path(graphics: Phaser.GameObjects.Graphics, points: TilePoint[]) {
    const first = points[0];
    if (!first) return;
    graphics.beginPath();
    graphics.moveTo(first.x, first.y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.closePath();
  }

  private drawPulse() {
    this.flash.clear();
    if (this.corners.length !== 4) return;
    const points = this.inset();
    this.flash.fillStyle(this.pulseColor, 0.05);
    this.path(this.flash, points);
    this.flash.fillPath();
    this.flash.lineStyle(3, this.pulseColor, 0.9);
    this.path(this.flash, points);
    this.flash.strokePath();
  }
}
