import Phaser from 'phaser';
import { type Portal, portals } from '@/games';
import { hudScale } from '@/lib/hudScale';
import { playSfx } from '@/lib/sound';
import { titleStyle } from '@/phaser/assets';
import { bridge } from '@/phaser/bridge';

interface PortalView {
  portal: Portal;
  /** Positioned and scaled every frame from the scroll position. */
  container: Phaser.GameObjects.Container;
  /** Bobs up and down inside `container`. */
  float: Phaser.GameObjects.Container;
  /** 1, or a bit more while hovered (tweened). */
  hover: { value: number };
  highlight: { sign: Phaser.GameObjects.Image; glow?: Phaser.Filters.Glow } | null;
}

/** Native size of one portal (island + sign) before scaling. */
const PORTAL_W = 640;
const PORTAL_H = 760;
/** A pointer that moved further than this is dragging the strip, not tapping a portal. */
const DRAG_PX = 10;
const FOCUS_KEY = 'psc.hubFocus';

/**
 * Home screen: a horizontal strip with one portal (island) per game in games/. It scrolls by
 * drag/swipe (with inertia, snapping to a portal), mouse wheel/trackpad, the arrow buttons and
 * the keyboard (arrow keys + Enter, through React's hidden button list in pages/Home). On
 * phones one portal is in focus and its neighbours peek in at the edges; wide screens show
 * several, or all of them when they fit. Emits 'hub:select' / 'hub:locked' / 'hub:focus'.
 */
export class HubScene extends Phaser.Scene {
  private views: PortalView[] = [];
  private arrows: Phaser.GameObjects.Image[] = [];
  private dots: Phaser.GameObjects.Image[] = [];
  /** Strip position in px: portal i is centred when scroll === i * spacing. */
  private scroll = 0;
  private spacing = 1;
  private baseScale = 1;
  private sideScale = 1;
  private centerY = 0;
  /** All portals fit on screen: no scrolling, arrows or dots. */
  private fits = false;
  private focus = 0;
  private drag: {
    startX: number;
    startScroll: number;
    moved: number;
    samples: [number, number][];
  } | null = null;
  private wheelTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    super('hub');
  }

  create() {
    this.views = portals.map((portal, i) => this.makePortal(portal, i));
    this.arrows = [-1, 1].map((dir) => {
      const arrow = this.add
        .image(0, 0, 'arrow')
        .setFlipX(dir < 0)
        .setDepth(10);
      arrow.setInteractive({ useHandCursor: true }).on('pointerup', () => this.step(dir));
      arrow.setData('dir', dir);
      return arrow;
    });
    this.dots = portals.map(() => this.add.image(0, 0, 'orb').setDepth(10));

    this.focus = Phaser.Math.Clamp(this.savedFocus(), 0, Math.max(0, portals.length - 1));
    this.registry.set('showTitle', true);
    this.layout();
    this.scroll = this.targetOf(this.focus);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.on('wheel', this.onWheel, this);
    const onStep = (dir: number) => this.step(dir);
    const onOpen = () => this.open(this.focus);
    const onFocusTo = (gameId: string) => {
      const i = this.views.findIndex((v) => v.portal.gameId === gameId);
      if (i >= 0) this.setFocus(i, true);
    };
    bridge.on('hub:step', onStep);
    bridge.on('hub:open', onOpen);
    bridge.on('hub:focus-to', onFocusTo);
    this.scale.on('resize', this.layout, this);
    this.registry.events.on('changedata-titleBottom', this.layout, this);
    this.events.once('shutdown', () => {
      this.registry.set('showTitle', false);
      this.registry.set('hubScroll', 0);
      bridge.off('hub:step', onStep);
      bridge.off('hub:open', onOpen);
      bridge.off('hub:focus-to', onFocusTo);
      clearTimeout(this.wheelTimer);
      this.scale.off('resize', this.layout, this);
      this.registry.events.off('changedata-titleBottom', this.layout, this);
    });
    bridge.emit('hub:focus', this.views[this.focus]?.portal.gameId);
  }

  private makePortal(portal: Portal, i: number): PortalView {
    const open = !portal.locked;
    const img = this.add.image(0, 0, portal.texture);
    const sign = this.add.image(0, img.height * 0.42, 'sign').setScale(0.9);
    const label = this.add
      .text(sign.x, sign.y + sign.displayHeight * 0.12, portal.name, titleStyle(46))
      .setOrigin(0.5);
    // Long names shrink to fit the sign.
    label.setScale(Math.min(1, (sign.displayWidth * 0.8) / label.width));
    // Magic light orbs hide where the sign's ropes end (they don't meet the island art).
    const ropeTop = sign.y - sign.displayHeight / 2;
    const orbs = [-0.35, 0.35].map((f) =>
      this.add.image(sign.x + sign.displayWidth * f, ropeTop, 'orb').setDisplaySize(72, 72),
    );
    const parts: Phaser.GameObjects.GameObject[] = [img, sign, ...orbs, label];
    let glow: Phaser.Filters.Glow | undefined;
    if (open) {
      // Hover highlight: a warm glow around the island.
      glow = img.enableFilters().filters?.internal.addGlow(0xfff1a8, 5, 0, 1.4, false, 12, 14);
      if (glow) glow.active = false;
    } else {
      // Locked ("coming soon"): island and sign in black and white; the gold lock stays.
      for (const part of [img, sign, ...orbs]) {
        part.enableFilters().filters?.internal.addColorMatrix().colorMatrix.grayscale();
      }
      parts.push(this.add.image(0, -img.height * 0.05, 'lock').setScale(0.8));
    }
    const float = this.add.container(0, 0, parts);
    const container = this.add.container(0, 0, [float]);
    container.setSize(PORTAL_W, PORTAL_H).setInteractive({ useHandCursor: true });
    const view: PortalView = {
      portal,
      container,
      float,
      hover: { value: 1 },
      highlight: open ? { sign, glow } : null,
    };
    container.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch || this.drag) return;
      // Mouse only: on touch screens "over" fires on every tap.
      playSfx('island-hover');
      this.setHover(view, true);
    });
    container.on('pointerout', () => this.setHover(view, false));

    // Gentle floating motion, each island slightly out of sync; orbs pulse softly.
    this.tweens.add({
      targets: float,
      y: 10 + (i % 4) * 2,
      duration: 1800 + (i % 4) * 250,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    orbs.forEach((orb, j) => {
      this.tweens.add({
        targets: orb,
        scale: orb.scale * 1.15,
        alpha: 0.8,
        duration: 900 + j * 200,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    });
    return view;
  }

  /** Sizes and spacing for this screen; positions are applied every frame in update(). */
  private layout() {
    const { width, height } = this.scale;
    const hud = hudScale();
    const portrait = height > width;
    const n = this.views.length;
    // Leave room for the title (drawn by SkyScene, which reports its bottom edge) and the dots.
    const titleBottom = (this.registry.get('titleBottom') as number | undefined) ?? height * 0.2;
    const top = Math.max(titleBottom, height * 0.12);
    const bottom = height - 44 * hud;
    const availH = Math.max(120, bottom - top);

    // Phones: one portal in focus, neighbours peeking. Wide screens: all of them when a few fit
    // side by side, otherwise as many as fit and the rest scroll.
    const tallest = (availH * PORTAL_W) / PORTAL_H;
    const fitW = (width * 0.96) / Math.max(1, n) / 1.08;
    this.fits = !portrait && fitW >= width / 5.5;
    const cardW = portrait ? width * 0.8 : Math.min(this.fits ? fitW : width / 3.4, tallest);
    this.baseScale = Math.min(cardW / PORTAL_W, availH / PORTAL_H) * 0.95;
    this.spacing = portrait ? width * 0.74 : PORTAL_W * this.baseScale * 1.08;
    this.sideScale = portrait ? 0.7 : 0.92;
    this.centerY = top + availH / 2;

    const arrowH = Math.max(44, 64 * hud);
    this.arrows.forEach((arrow) => {
      const dir = arrow.getData('dir') as number;
      arrow.setDisplaySize((arrowH * 256) / 180, arrowH);
      arrow.setPosition(
        dir < 0 ? arrow.displayWidth / 2 + 8 : width - arrow.displayWidth / 2 - 8,
        this.centerY,
      );
    });
    const dot = 16 * hud;
    this.dots.forEach((d, i) => {
      d.setPosition(width / 2 + (i - (n - 1) / 2) * dot * 1.6, height - 24 * hud);
      d.setData('size', dot);
    });
    this.scroll = this.clampScroll(this.fits ? this.targetOf(0) : this.targetOf(this.focus));
  }

  /** Scroll position that centres portal `i` (or the whole row, when everything fits). */
  private targetOf(i: number) {
    if (this.fits) return ((this.views.length - 1) * this.spacing) / 2;
    return i * this.spacing;
  }

  private clampScroll(x: number) {
    const max = (this.views.length - 1) * this.spacing;
    return Phaser.Math.Clamp(x, 0, max);
  }

  override update() {
    const { width } = this.scale;
    this.views.forEach((view, i) => {
      const offset = i * this.spacing - this.scroll;
      const distance = Math.min(1, Math.abs(offset) / this.spacing);
      const scale = this.fits ? 1 : Phaser.Math.Linear(1, this.sideScale, distance);
      const x = width / 2 + offset;
      const visible = x > -this.spacing && x < width + this.spacing;
      view.container.setVisible(visible);
      if (!visible) return;
      view.container
        .setPosition(x, this.centerY)
        .setScale(this.baseScale * scale * view.hover.value);
      // The focused portal is drawn on top of its neighbours.
      view.container.setDepth(1 - distance);
    });

    const scrolls = !this.fits && this.views.length > 1;
    const nearest = Math.round(this.scroll / this.spacing);
    this.arrows.forEach((arrow) => {
      const dir = arrow.getData('dir') as number;
      const show = scrolls && (dir < 0 ? nearest > 0 : nearest < this.views.length - 1);
      arrow.setVisible(show);
      if (arrow.input) arrow.input.enabled = show;
    });
    this.dots.forEach((dot, i) => {
      const size = dot.getData('size') as number;
      const on = i === nearest;
      dot.setVisible(scrolls).setDisplaySize(size * (on ? 1.3 : 0.9), size * (on ? 1.3 : 0.9));
      dot.setAlpha(on ? 1 : 0.45);
    });
    // The sky drifts a little with the strip (SkyScene reads it).
    this.registry.set('hubScroll', this.scroll);
  }

  private onDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (this.fits || over.some((o) => this.arrows.includes(o as Phaser.GameObjects.Image))) return;
    this.tweens.killTweensOf(this);
    this.drag = {
      startX: pointer.x,
      startScroll: this.scroll,
      moved: 0,
      samples: [[pointer.x, pointer.time]],
    };
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (!this.drag || !pointer.isDown) return;
    const dx = pointer.x - this.drag.startX;
    this.drag.moved = Math.max(this.drag.moved, Math.abs(dx));
    if (this.drag.moved < DRAG_PX) return;
    // Past the first/last portal the strip only gives a little (rubber band).
    const raw = this.drag.startScroll - dx;
    const clamped = this.clampScroll(raw);
    this.scroll = clamped + (raw - clamped) * 0.3;
    this.drag.samples.push([pointer.x, pointer.time]);
    if (this.drag.samples.length > 6) this.drag.samples.shift();
    for (const view of this.views) this.setHover(view, false);
  }

  private onUp(_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[] = []) {
    const drag = this.drag;
    this.drag = null;
    if (drag && drag.moved >= DRAG_PX) {
      // Flick: keep going in the direction of the last movement, then snap to a portal.
      const [first, last] = [drag.samples[0], drag.samples[drag.samples.length - 1]];
      const velocity =
        first && last && last[1] > first[1] ? (last[0] - first[0]) / (last[1] - first[1]) : 0;
      const projected = this.scroll - velocity * 220;
      this.setFocus(this.nearestIndex(projected), true);
      return;
    }
    // A tap (not a drag): open the portal under the pointer, or bring a side one into focus.
    const i = this.views.findIndex((v) => over.includes(v.container));
    if (i < 0) return;
    if (i === this.focus || this.fits || !this.isPortrait()) this.open(i);
    else this.setFocus(i, true);
  }

  private onWheel(_pointer: Phaser.Input.Pointer, _over: unknown, dx: number, dy: number) {
    if (this.fits) return;
    this.tweens.killTweensOf(this);
    this.scroll = this.clampScroll(this.scroll + (Math.abs(dx) > Math.abs(dy) ? dx : dy));
    // Snap once the wheel/trackpad stops (real time: Phaser's clock slows down with the frame rate).
    clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => this.setFocus(this.nearestIndex(this.scroll), true), 160);
  }

  private nearestIndex(scroll: number) {
    return Phaser.Math.Clamp(Math.round(scroll / this.spacing), 0, this.views.length - 1);
  }

  private isPortrait() {
    return this.scale.height > this.scale.width;
  }

  /** Moves the focus by `dir` portals (arrow buttons, arrow keys). */
  private step(dir: number) {
    // While the strip is still gliding, count from where it is heading (quick repeated presses).
    const from = this.tweens.isTweening(this) ? this.focus : this.nearestIndex(this.scroll);
    const next = Phaser.Math.Clamp(from + dir, 0, this.views.length - 1);
    this.setFocus(next, true);
  }

  private setFocus(i: number, animate: boolean) {
    const changed = i !== this.focus;
    this.focus = i;
    const target = this.clampScroll(this.targetOf(i));
    this.tweens.killTweensOf(this);
    if (animate) {
      this.tweens.add({ targets: this, scroll: target, duration: 380, ease: 'Cubic.easeOut' });
    } else this.scroll = target;
    const id = this.views[i]?.portal.gameId;
    if (!changed || !id) return;
    try {
      sessionStorage.setItem(FOCUS_KEY, id);
    } catch {}
    bridge.emit('hub:focus', id);
  }

  /** The last focused game, so coming back from a room returns to the same place. */
  private savedFocus() {
    try {
      const id = sessionStorage.getItem(FOCUS_KEY);
      return Math.max(
        0,
        this.views.findIndex((v) => v.portal.gameId === id),
      );
    } catch {
      return 0;
    }
  }

  private open(i: number) {
    const view = this.views[i];
    if (!view) return;
    this.setFocus(i, true);
    if (view.portal.locked) {
      playSfx('island-click');
      this.wobble(view.container);
      bridge.emit('hub:locked');
      return;
    }
    playSfx('island-click');
    bridge.emit('hub:select', view.portal.gameId);
  }

  /** Grows the island; playable ones also swap to the bright sign and glow. */
  private setHover(view: PortalView, on: boolean) {
    const factor = on ? (view.highlight ? 1.08 : 1.03) : 1;
    if (view.hover.value === factor) return;
    this.tweens.add({ targets: view.hover, value: factor, duration: 150 });
    if (!view.highlight) return;
    view.highlight.sign.setTexture(on ? 'sign-hover' : 'sign');
    if (view.highlight.glow) view.highlight.glow.active = on;
  }

  private wobble(container: Phaser.GameObjects.Container) {
    this.tweens.add({
      targets: container,
      angle: { from: -4, to: 4 },
      duration: 70,
      yoyo: true,
      repeat: 2,
      onComplete: () => container.setAngle(0),
    });
  }
}
