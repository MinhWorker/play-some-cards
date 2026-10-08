/**
 * Original hand-drawn vector animation bake for Bom Nguyên Tố.
 * Each SVG is an articulated pose, rendered once and packed as a Phaser JSON atlas.
 * Runtime only selects atlas frames; it does not redraw or deform the characters.
 * Run from the repository root: node games/bom-nguyen-to/sources/bake-cartoon-sprites.mjs
 */
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import fs from 'node:fs/promises';
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import path from 'node:path';
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import { fileURLToPath } from 'node:url';
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets');
const previews = path.join(root, '.blender', 'cartoon-sprites');
const SIZE = 160;
const OUTLINE = '#73535f';
const CREAM = '#fff8e7';
const PALETTES = {
  fire: { body: '#ffb397', dark: '#ee877c', light: '#ffe0bd', accent: '#ffd074' },
  water: { body: '#a1dff0', dark: '#79bedf', light: '#ddf5ff', accent: '#9bbfea' },
  lightning: { body: '#ccb8f4', dark: '#ad91de', light: '#eee4ff', accent: '#fff0a2' },
  ice: { body: '#bfeaf0', dark: '#91c9db', light: '#e8fcff', accent: '#ffda9a' },
  wind: { body: '#b4e7c1', dark: '#85c8a4', light: '#e5f8d7', accent: '#e6efa5' },
};
const STATES = { idle: 4, walk: 8, place: 5, skill: 6, hit: 4, frozen: 2, ko: 6, spawn: 6 };
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const EFFECTS = {
  'bomb-fuse': 12,
  'bomb-frozen': 4,
  ...Object.fromEntries(Object.keys(PALETTES).map((element) => [`bomb-${element}`, 12])),
  ...Object.fromEntries(
    ['heal', 'range', 'capacity', 'speed'].map((kind) => [`pickup-${kind}`, 6]),
  ),
  ...Object.fromEntries(
    Object.keys(PALETTES).flatMap((element) => [
      [`burst-${element}`, 8],
      [`linger-${element}`, 6],
      [`skill-${element}`, 8],
    ]),
  ),
  'crate-break': 8,
  'pickup-gleam': 8,
  dust: 6,
  dash: 8,
  freeze: 8,
  victory: 12,
};

const n = (value) => Math.round(value * 100) / 100;
const ellipse = (x, y, rx, ry, fill, stroke = OUTLINE, width = 4) =>
  `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const circle = (x, y, radius, fill, stroke = OUTLINE, width = 4) =>
  ellipse(x, y, radius, radius, fill, stroke, width);
const line = (x1, y1, x2, y2, stroke = OUTLINE, width = 4) =>
  `<path d="M${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
const shape = (d, fill, stroke = OUTLINE, width = 4) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const star = (x, y, radius, fill, width = 2) => {
  const points = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 ? radius * 0.35 : radius;
    return `${n(x + Math.cos(a) * r)},${n(y + Math.sin(a) * r)}`;
  }).join(' ');
  return `<polygon points="${points}" fill="${fill}" stroke="${OUTLINE}" stroke-width="${width}"/>`;
};
const svg = (content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 160 160"><g stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>`;

function eye(x, y, state, frame, side = 1) {
  if (state === 'ko')
    return (
      line(x - 4, y - 4, x + 4, y + 4, OUTLINE, 3) + line(x - 4, y + 4, x + 4, y - 4, OUTLINE, 3)
    );
  if (state === 'hit') return shape(`M${x - 5} ${y - 3} l5 4 -5 4`, 'none', OUTLINE, 3);
  if (state === 'frozen')
    return circle(x, y, 4, '#86b7db', 'none', 0) + circle(x + 1, y - 1, 1.3, CREAM, 'none', 0);
  if (state === 'idle' && frame === 2)
    return shape(`M${x - 5} ${y} Q${x} ${y + 4} ${x + 5} ${y}`, 'none', OUTLINE, 3);
  if (state === 'skill' && (frame === 2 || frame === 3))
    return shape(`M${x - 5} ${y + 2} Q${x} ${y - 6} ${x + 5} ${y + 2}`, 'none', OUTLINE, 3);
  return (
    ellipse(x, y, side === 1 ? 3.4 : 3, 5, OUTLINE, 'none', 0) +
    circle(x + 0.8, y - 2, 1.2, CREAM, 'none', 0)
  );
}

function emblem(element, x, y, size, color = PALETTES[element].dark, stroke = OUTLINE, width = 2) {
  const s = size / 16;
  let content = '';
  if (element === 'fire')
    content = shape(
      'M0 8 C-12 5 -9 -4 -4 -8 C-4 -2 2 -4 0 -14 C12 -5 12 3 5 8 C3 10 -2 10 0 8Z',
      color,
      stroke,
      width,
    );
  if (element === 'water')
    content = shape(
      'M0 -13 C-4 -6 -10 -1 -10 4 C-10 15 10 15 10 4 C10 -1 4 -6 0 -13Z',
      color,
      stroke,
      width,
    );
  if (element === 'lightning')
    content = shape('M1 -14 -10 3 -2 3 -5 15 11 -5 3 -5 7 -14Z', color, stroke, width);
  if (element === 'ice')
    content = ['M0 -13V13', 'M-12 -7 12 7', 'M-12 7 12 -7', 'M-4 -9 0 -5 4 -9', 'M-4 9 0 5 4 9']
      .map((d) => shape(d, 'none', color, 3))
      .join('');
  if (element === 'wind')
    content = shape(
      'M-12 0 Q1 -14 11 -5 Q18 4 5 3 M-11 6 Q0 1 11 8 M-8 -7 Q-2 -13 5 -10',
      'none',
      color,
      3,
    );
  return `<g transform="translate(${x} ${y}) scale(${s})">${content}</g>`;
}

function mascot(element, direction, state, frame) {
  const p = PALETTES[element];
  const side = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const back = direction === 'up';
  const walk = state === 'walk' ? Math.sin((frame / 8) * Math.PI * 2) : 0;
  const stride = state === 'walk' ? Math.cos((frame / 8) * Math.PI * 2) : 0;
  const idle = state === 'idle' ? [0, -1, 0, 1][frame] : 0;
  const spell = state === 'skill' ? Math.sin((frame / 5) * Math.PI) : 0;
  const put = state === 'place' ? [0, 2, 5, 3, 0][frame] : 0;
  const hurt = state === 'hit' ? [0, 3, -2, 0][frame] : 0;
  const fall = state === 'ko' ? frame / 5 : 0;
  const emerge = state === 'spawn' ? [0.35, 0.55, 0.8, 1.07, 0.96, 1][frame] : 1;
  const baseY = idle + put + hurt - Math.abs(walk) * 2 - spell * 3;
  const cx = 80 + side * 2;
  const bodyY = 100 + baseY + fall * 18;
  const headY = 70 + baseY + fall * 38;
  const headRx = fall > 0.6 ? 46 : 39 + put * 0.35;
  const headRy = 32 - put * 0.4 - fall * 10;
  const sway = state === 'walk' ? walk * 5 : idle * 2;
  let s = '';
  // Tail is a separate moving silhouette, visible from the rear and side.
  const tailX = side ? cx - side * 29 : cx + (back ? -25 : 30);
  const tailSign = side ? -side : back ? -1 : 1;
  const tailY = bodyY - 1;
  if (element === 'fire')
    s +=
      shape(
        `M${tailX} ${tailY + 13} Q${tailX + tailSign * 37} ${tailY + 8 - sway} ${tailX + tailSign * 19} ${tailY - 27 - sway} Q${tailX + tailSign * 5} ${tailY - 4} ${tailX} ${tailY + 13}Z`,
        p.body,
      ) +
      shape(
        `M${tailX + tailSign * 17} ${tailY - 20 - sway} Q${tailX + tailSign * 32} ${tailY + 1 - sway} ${tailX + tailSign * 18} ${tailY + 4} Q${tailX + tailSign * 22} ${tailY - 7} ${tailX + tailSign * 17} ${tailY - 20 - sway}Z`,
        CREAM,
        'none',
        0,
      );
  if (element === 'lightning')
    s += circle(tailX + tailSign * 4, tailY + 7, 12 + Math.abs(sway) * 0.15, p.light);
  if (element === 'wind')
    s +=
      shape(
        `M${tailX} ${tailY + 15} Q${tailX + tailSign * 35} ${tailY + 8} ${tailX + tailSign * 23} ${tailY - 9 - sway}`,
        'none',
        p.dark,
        11,
      ) +
      shape(
        `M${tailX + tailSign * 23} ${tailY - 5 - sway} Q${tailX + tailSign * 8} ${tailY - 19 - sway} ${tailX + tailSign * 31} ${tailY - 26 - sway} Q${tailX + tailSign * 42} ${tailY - 9 - sway} ${tailX + tailSign * 23} ${tailY - 5 - sway}Z`,
        p.body,
      );
  // Feet lift alternately; their silhouettes stay on the same ground anchor.
  const leftLift = Math.max(0, walk) * 9;
  const rightLift = Math.max(0, -walk) * 9;
  s += ellipse(
    cx - 17 - walk * 3 + stride * 3,
    132 - leftLift + fall * 2,
    12,
    7 - leftLift * 0.12,
    element === 'ice' ? p.accent : p.dark,
  );
  s += ellipse(
    cx + 17 - walk * 3 - stride * 3,
    132 - rightLift + fall * 2,
    12,
    7 - rightLift * 0.12,
    element === 'ice' ? p.accent : p.dark,
  );
  s += ellipse(cx, bodyY, 31 + put * 0.45 + fall * 8, 34 - put * 0.5 - fall * 14, p.body);
  if (!back) s += ellipse(cx + side * 5, bodyY + 4, 21, 25 - fall * 12, CREAM, 'none', 0);
  if (back) s += ellipse(cx - 2, bodyY - 3, 15, 20, p.light, 'none', 0);
  // Arm poses are drawn individually: swing, carry, cast, flinch, and collapse.
  const armLift = spell * 18 + (state === 'place' ? [0, 11, 19, 8, 0][frame] : 0);
  for (const armSide of [-1, 1]) {
    const ax = cx + armSide * (30 + spell * 5);
    const ay = bodyY + 1 - armLift + armSide * walk * 7 + fall * 2;
    if (element === 'water' || element === 'ice')
      s += shape(
        `M${ax - armSide * 8} ${ay - 14} Q${ax + armSide * 14} ${ay - 2} ${ax + armSide * 8} ${ay + 13} Q${ax - armSide * 1} ${ay + 16} ${ax - armSide * 8} ${ay - 14}Z`,
        p.body,
      );
    else s += ellipse(ax, ay, 10, 15 - spell * 4, p.body);
  }
  // Ears and top ornaments vary by species and facing.
  const earLift = spell * 4 - put * 0.4;
  if (element === 'lightning') {
    for (const earSide of [-1, 1]) {
      const ex = cx + earSide * (21 + walk * 0.4);
      const tilt = earSide * 4 + sway;
      s += shape(
        `M${ex - 10} ${headY - 23} Q${ex - 19 + tilt} ${headY - 56 - earLift} ${ex - 5 + tilt} ${headY - 54 - earLift} Q${ex + 9 + tilt} ${headY - 54 - earLift} ${ex + 10} ${headY - 22}Z`,
        p.body,
      );
      s += shape(
        `M${ex - 3} ${headY - 26} Q${ex - 8 + tilt} ${headY - 45 - earLift} ${ex - 3 + tilt} ${headY - 43 - earLift} Q${ex + 3 + tilt} ${headY - 43 - earLift} ${ex + 3} ${headY - 25}Z`,
        back ? p.dark : '#f4c3d8',
        'none',
        0,
      );
    }
  }
  if (element === 'fire' || element === 'wind') {
    for (const earSide of [-1, 1]) {
      const ex = cx + earSide * 25;
      s += shape(
        `M${ex - 12} ${headY - 18} Q${ex - 10} ${headY - 47 - earLift} ${ex + earSide * 7} ${headY - 41 - earLift} L${ex + 13} ${headY - 16}Z`,
        p.body,
      );
      s += shape(
        `M${ex - 6} ${headY - 22} L${ex + earSide * 5} ${headY - 36 - earLift} ${ex + 7} ${headY - 20}Z`,
        back ? p.dark : '#ffd6d0',
        'none',
        0,
      );
    }
  }
  if (element === 'water')
    s += shape(
      `M${cx - 17} ${headY - 24} Q${cx - 10} ${headY - 49 - spell * 4} ${cx + 1} ${headY - 52 - spell * 4} Q${cx - 4} ${headY - 37} ${cx + 19} ${headY - 25}Z`,
      p.body,
    );
  if (element === 'ice') s += shape(`M${cx - 20} ${headY - 23} l9 -13 10 8 9 -11 10 14Z`, p.body);
  s += ellipse(cx, headY, headRx, headRy, p.body);
  s += ellipse(cx - 15, headY - 16, 11, 6, p.light, 'none', 0);
  if (element === 'wind') {
    s += shape(
      `M${cx - 4} ${headY - 25} Q${cx - 17 - sway} ${headY - 49} ${cx + 7 - sway} ${headY - 45} Q${cx + 24 - sway} ${headY - 33} ${cx - 4} ${headY - 25}Z`,
      p.dark,
    );
    s += line(cx - 3, headY - 26, cx + 7 - sway, headY - 40, '#649d81', 2);
  }
  if (back) {
    s += ellipse(cx, headY + 5, 19, 14, p.light, 'none', 0);
    s += shape(`M${cx - 8} ${headY + 12} l4 4 4 -4 4 4 4 -4`, 'none', p.dark, 3);
  } else {
    const faceX = cx + side * 11;
    if (element === 'fire')
      s += shape(
        `M${faceX - 27} ${headY + 2} Q${faceX - 12} ${headY + 5} ${faceX} ${headY + 22} Q${faceX + 12} ${headY + 5} ${faceX + 27} ${headY + 2} Q${faceX + 24} ${headY + 31} ${faceX} ${headY + 28} Q${faceX - 24} ${headY + 31} ${faceX - 27} ${headY + 2}Z`,
        CREAM,
        'none',
        0,
      );
    else s += ellipse(faceX, headY + 9, side ? 23 : 29, 22 - fall * 4, CREAM, 'none', 0);
    const eyeY = headY + 1;
    if (side) s += eye(faceX + side * 8, eyeY, state, frame, 0);
    else s += eye(faceX - 13, eyeY, state, frame) + eye(faceX + 13, eyeY, state, frame);
    const noseX = faceX + side * 6;
    if (element === 'ice')
      s += shape(
        `M${noseX - 6} ${headY + 9} Q${noseX} ${headY + 5} ${noseX + 6} ${headY + 9} L${noseX} ${headY + 16}Z`,
        p.accent,
        OUTLINE,
        2,
      );
    else {
      s += ellipse(noseX, headY + 9, 3.5, 2.5, OUTLINE, 'none', 0);
      if (state === 'skill') s += ellipse(noseX, headY + 18, 4, 5, '#db879c', OUTLINE, 2);
      else
        s += shape(
          `M${noseX - 6} ${headY + 15} Q${noseX - 3} ${headY + 20} ${noseX} ${headY + 15} Q${noseX + 3} ${headY + 20} ${noseX + 6} ${headY + 15}`,
          'none',
          OUTLINE,
          2,
        );
    }
    s += ellipse(faceX - 22, headY + 10, 5.5, 3, '#f5b9b8', 'none', 0);
    if (!side) s += ellipse(faceX + 22, headY + 10, 5.5, 3, '#f5b9b8', 'none', 0);
    if (element === 'water' && !side)
      s +=
        line(faceX - 21, headY + 17, faceX - 29, headY + 15, OUTLINE, 1.5) +
        line(faceX + 21, headY + 17, faceX + 29, headY + 15, OUTLINE, 1.5);
    if (element === 'wind')
      s +=
        line(faceX - 23, headY + 15, faceX - 31, headY + 13, OUTLINE, 1.5) +
        line(faceX + 23, headY + 15, faceX + 31, headY + 13, OUTLINE, 1.5);
  }
  // Element badge belongs to the toy, and stays legible while walking.
  if (!back && fall < 0.7) s += emblem(element, cx + side * 5, bodyY + 13, 8, p.dark, 'none', 0);
  if (state === 'place' && frame >= 1 && frame <= 3)
    s += bombDrawing(80 + side * 21, 107 + put, 0.28, 2);
  if (state === 'skill') {
    for (let i = 0; i < 3; i++) {
      const a = ((i / 3) * 2 + frame / 9) * Math.PI;
      s += emblem(
        element,
        80 + Math.cos(a) * (47 + spell * 7),
        85 + Math.sin(a) * 33,
        8 + spell * 2,
        p.accent,
        OUTLINE,
        1.7,
      );
    }
  }
  if (state === 'hit')
    s += star(123, 44 - frame * 2, 9, '#fff0aa') + star(34, 61 + frame, 6, p.light);
  if (state === 'frozen') {
    s += shape(
      'M35 56 49 32 113 35 131 58 133 116 114 140 46 140 28 111Z',
      '#b5eaff4d',
      '#8fcbe0',
      3,
    );
    s += shape(
      'M35 56 65 69 49 32 M65 69 62 125 46 140 M131 58 108 77 113 35 M108 77 114 140',
      'none',
      '#f4fdff',
      2,
    );
    s += star(frame ? 118 : 42, frame ? 50 : 100, 8, '#ffffff', 0);
  }
  if (state === 'ko') {
    for (let i = 0; i < 3; i++) {
      const a = ((i / 3) * 2 + frame / 8) * Math.PI;
      s += star(80 + Math.cos(a) * 35, 68 + Math.sin(a) * 7 + fall * 10, 6, '#ffe19a', 1.5);
    }
  }
  if (state === 'spawn') {
    s = `<g transform="translate(${80 - 80 * emerge} ${138 - 138 * emerge}) scale(${emerge})">${s}</g>`;
    if (frame < 4) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        s += circle(
          80 + Math.cos(a) * (22 + frame * 13),
          110 + Math.sin(a) * (14 + frame * 7),
          9 - frame,
          CREAM,
          'none',
          0,
        );
      }
    }
  }
  return svg(s);
}

function bombDrawing(x = 80, y = 97, size = 1, frame = 0, frozen = false, element = null) {
  const puff = [0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0, -1][frame % 12];
  const fuseEnd = 35 + (frame / 11) * 16;
  const sparkX = 99 - (frame / 11) * 13;
  const p = element ? PALETTES[element] : { body: '#ac9bd3', dark: '#9281bd', light: '#dcd1f4' };
  let s = ellipse(80, 97, 39 + puff * 0.7, 36 - puff * 0.6, p.body);
  s += shape('M45 86 Q47 64 72 62', 'none', p.light, 8);
  s += ellipse(93, 110, 23, 14, p.dark, 'none', 0);
  s += shape('M65 64 L66 54 Q80 48 94 54 L95 64Z', '#f6d390');
  s += shape(`M80 53 Q82 ${fuseEnd - 6} ${sparkX} ${fuseEnd}`, 'none', '#73535f', 5);
  s += circle(
    sparkX,
    fuseEnd,
    frozen ? 4 : 5 + (frame % 3),
    frozen ? '#d6f5ff' : '#ffeaaa',
    OUTLINE,
    1.5,
  );
  if (!frozen) {
    s += star(sparkX + (frame % 2 ? 2 : -2), fuseEnd - 3, 11 + (frame % 3) * 2, '#ffc080', 1.5);
    s += line(sparkX + 14, fuseEnd - 9, sparkX + 19 + (frame % 3), fuseEnd - 14, '#f0a888', 2);
    s += line(sparkX - 8, fuseEnd - 15, sparkX - 10, fuseEnd - 21, '#f0a888', 2);
  }
  s += eye(68, 94, 'idle', 0) + eye(92, 94, 'idle', 0);
  s += ellipse(57, 104, 5, 3, '#f5b9b8', 'none', 0) + ellipse(104, 104, 5, 3, '#f5b9b8', 'none', 0);
  s += shape('M76 105 Q80 110 84 105', 'none', OUTLINE, 2.5);
  if (frozen)
    s +=
      shape(
        'M42 75 58 61 104 61 122 77 125 120 104 136 57 136 35 118Z',
        '#bdeeff55',
        '#8dc9de',
        3,
      ) + emblem('ice', 107, 84, 10, '#e9fcff', 'none', 0);
  return `<g transform="translate(${x - 80 * size} ${y - 97 * size}) scale(${size})">${s}</g>`;
}

function burst(element, frame, lingering = false, skill = false) {
  const p = PALETTES[element];
  const t = frame / (lingering ? 5 : 7);
  let s = '';
  if (lingering) {
    s += ellipse(80, 111, 46 + Math.sin(t * Math.PI * 2) * 3, 22, `${p.body}55`, 'none', 0);
    for (let i = 0; i < 4; i++) {
      const x = 43 + i * 25;
      const y = 101 - ((frame + i * 2) % 6) * 7;
      s += emblem(element, x, y, 10 - ((frame + i) % 3), p.body, p.dark, 1.3);
    }
    return svg(s);
  }
  const r = 12 + t * (skill ? 50 : 56);
  const strength = Math.sin(Math.PI * Math.min(0.98, t + 0.1));
  if (frame < 6) {
    s += ellipse(80, 87, r * 0.92, r * 0.64, p.light, p.dark, 3);
    for (let i = 0; i < 6; i++) {
      const a = ((i / 6) * 2 + t * 0.3) * Math.PI;
      const x = 80 + Math.cos(a) * r * 0.74;
      const y = 87 + Math.sin(a) * r * 0.57;
      s += circle(x, y, (10 + (i % 2) * 5) * strength, p.body, p.dark, 2);
    }
    s += ellipse(80 - r * 0.17, 84 - r * 0.12, r * 0.34, r * 0.24, CREAM, 'none', 0);
    s += emblem(element, 80, 85, 11 + strength * 9, p.dark, 'none', 0);
  }
  for (let i = 0; i < 6; i++) {
    const a = ((i / 6) * 2 + t * 0.3) * Math.PI;
    const x = 80 + Math.cos(a) * (r + t * 5);
    const y = 87 + Math.sin(a) * (r * 0.67 + t * 6);
    if (element === 'water')
      s += ellipse(x, y, 4 + strength * 2, 6 + strength * 2, p.body, p.dark, 1.5);
    else if (element === 'ice') s += emblem(element, x, y, 4 + strength * 6, p.dark, 'none', 0);
    else if (element === 'wind')
      s += shape(
        `M${x - 5} ${y + 5} Q${x - 8} ${y - 9} ${x + 8} ${y - 6} Q${x + 9} ${y + 7} ${x - 5} ${y + 5}Z`,
        p.body,
        p.dark,
        1.5,
      );
    else s += star(x, y, 4 + strength * 6, p.accent, 1.5);
  }
  return svg(s);
}

function effect(name, frame) {
  if (name === 'bomb-fuse') return svg(bombDrawing(80, 99, 1, frame));
  if (name === 'bomb-frozen') return svg(bombDrawing(80, 99, 1, frame * 3, true));
  if (name.startsWith('bomb-')) return svg(bombDrawing(80, 99, 1, frame, false, name.slice(5)));
  if (name.startsWith('pickup-') && name !== 'pickup-gleam') return pickup(name.slice(7), frame);
  if (name.startsWith('burst-')) return burst(name.slice(6), frame);
  if (name.startsWith('linger-')) return burst(name.slice(7), frame, true);
  if (name.startsWith('skill-')) return burst(name.slice(6), frame, false, true);
  const t = frame / (EFFECTS[name] - 1);
  let s = '';
  if (name === 'crate-break') {
    if (frame < 2)
      s +=
        shape('M41 58 H119 V124 H41Z', '#f6cfa0', OUTLINE, 4) +
        shape('M47 67 112 117 M113 68 48 116', 'none', '#b88773', 6);
    for (let i = 0; i < 7; i++) {
      const a = ((i / 7) * 2 - 0.2) * Math.PI;
      const x = 80 + Math.cos(a) * t * 57;
      const y = 98 + Math.sin(a) * t * 38 + t * t * 26;
      const len = 12 * (1 - t * 0.65);
      s += shape(
        `M${x - len} ${y - 3} l${len * 1.4} -${len * 0.5} ${len * 0.7} 8 -${len * 1.7} 4Z`,
        i % 2 ? '#f7d8b2' : '#e9b88f',
        '#b88773',
        2,
      );
    }
    if (frame < 5) s += circle(75, 99, 11 + frame * 5, CREAM, 'none', 0);
  }
  if (name === 'pickup-gleam') {
    s += healDrawing(0, Math.sin(t * Math.PI * 2) * 2);
    for (let i = 0; i < 3; i++)
      s += star(45 + i * 35, 52 + ((frame + i * 3) % 8) * 4, 3 + ((frame + i) % 3), '#fff1aa', 1.5);
  }
  if (name === 'dust') {
    for (let i = 0; i < 5; i++)
      s += circle(
        80 + (i - 2) * (8 + t * 17),
        121 - t * 21 + Math.sin(i) * 5,
        (8 + (i % 2) * 4) * (1 - t),
        '#fff5d9',
        'none',
        0,
      );
  }
  if (name === 'dash') {
    for (let i = 0; i < 4; i++) {
      const x = 33 + i * 24 + t * 11;
      const y = 80 + (i % 2) * 12;
      s += shape(
        `M${x - 17} ${y + 18} Q${x + 9} ${y + 17} ${x + 13} ${y - 13} M${x - 11} ${y + 25} Q${x + 20} ${y + 21} ${x + 20} ${y - 2}`,
        'none',
        i % 2 ? '#b7e6d5' : '#f8eeae',
        Math.max(1, 5 - t * 4),
      );
    }
  }
  if (name === 'freeze') {
    s += shape(
      'M35 56 49 32 113 35 131 58 133 116 114 140 46 140 28 111Z',
      '#b5eaff32',
      '#8fcbe0',
      3,
    );
    s += shape(
      'M35 56 65 69 49 32 M65 69 62 125 46 140 M131 58 108 77 113 35 M108 77 114 140',
      'none',
      '#f4fdff',
      2,
    );
    s += emblem('ice', 50 + (frame % 4) * 20, 54 + (frame % 3) * 18, 10, '#effcff', 'none', 0);
  }
  if (name === 'victory') {
    const colors = ['#ffd19b', '#b3e7d0', '#cdbbf0', '#ffc1ca', '#9edbef'];
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * Math.PI * 2;
      const x = 80 + Math.cos(a) * (12 + t * 58);
      const y = 84 + Math.sin(a) * (12 + t * 43) + t * t * 18;
      if (i % 3 === 0) s += star(x, y, 7 - t * 2, colors[i % 5], 1.2);
      else
        s += shape(
          `M${x - 3} ${y - 5} l7 ${i % 2 ? -2 : 2} -1 8 -7 -2Z`,
          colors[i % 5],
          OUTLINE,
          1,
        );
    }
  }
  return svg(s);
}

function healDrawing(dx = 0, dy = 0) {
  let s = shape(
    'M63 54 H97 V69 Q116 73 116 98 Q116 126 80 128 Q44 126 44 98 Q44 73 63 69Z',
    '#ffb9c1',
  );
  s += shape('M63 54 H97 V65 H63Z', '#fff4de');
  s += ellipse(69, 88, 7, 12, '#ffe1dc', 'none', 0);
  s += shape('M74 83 H86 V93 H96 V105 H86 V115 H74 V105 H64 V93 H74Z', CREAM, OUTLINE, 2.5);
  s += shape(
    'M72 47 Q54 31 73 34 Q87 33 81 48 M84 47 Q104 30 111 38 Q113 48 84 47Z',
    '#a9dec0',
    OUTLINE,
    2.5,
  );
  return `<g transform="translate(${dx} ${dy})">${s}</g>`;
}

function pickup(kind, frame) {
  const colors = { heal: '#ffb9c1', range: '#ffd29a', capacity: '#cdb9f1', speed: '#b4e8cb' };
  const p = colors[kind];
  let s = ellipse(80, 102, 42, 32, p, OUTLINE, 4);
  s += ellipse(80, 96, 37, 29, '#fff7e6', OUTLINE, 3);
  s += ellipse(66, 82, 10, 5, '#ffffff', 'none', 0);
  if (kind === 'heal')
    s += shape('M73 77 H87 V90 H100 V103 H87 V116 H73 V103 H60 V90 H73Z', p, OUTLINE, 2.5);
  if (kind === 'range') s += emblem('fire', 80, 96, 25, p, OUTLINE, 2);
  if (kind === 'capacity') s += bombDrawing(80, 99, 0.52, frame * 2);
  if (kind === 'speed')
    s +=
      shape(
        'M58 95 Q65 79 85 82 L99 101 Q103 109 95 114 H59 Q52 112 58 105 L65 103Z',
        p,
        OUTLINE,
        3,
      ) +
      line(64, 92, 78, 92, CREAM, 3) +
      line(61, 98, 78, 98, CREAM, 3);
  const angles = [0.1, 0.6, 1.1, 1.6, 2.1, 2.6];
  const a = angles[frame] * Math.PI;
  s += star(80 + Math.cos(a) * 39, 96 + Math.sin(a) * 27, 7 + (frame % 2) * 2, '#fff0a5', 1.5);
  s += star(80 - Math.cos(a) * 39, 96 - Math.sin(a) * 27, 4 + (frame % 3), '#ffffff', 1);
  // The face-shaped token gleams in successive drawn bands, with no runtime bobbing.
  s += shape(`M${44 + frame * 8} 78 l8 -3 18 34 -8 3Z`, '#ffffff42', 'none', 0);
  return svg(s);
}

async function raster(content) {
  return sharp(Buffer.from(content)).png().toBuffer();
}

async function pack(name, frames) {
  const width = 1024;
  const gutter = 2;
  const atlas = {};
  const tiles = [];
  const composites = [];
  for (const frame of frames) {
    const png = await raster(frame.svg);
    const pixels = await sharp(png).ensureAlpha().raw().toBuffer();
    let left = SIZE;
    let top = SIZE;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!pixels[(y * SIZE + x) * 4 + 3]) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    // Transparent edge pixels protect filtering; full source bounds preserve the ground anchor.
    left = right < 0 ? 0 : Math.max(0, left - 2);
    top = bottom < 0 ? 0 : Math.max(0, top - 2);
    right = right < 0 ? 0 : Math.min(SIZE - 1, right + 2);
    bottom = bottom < 0 ? 0 : Math.min(SIZE - 1, bottom + 2);
    const w = right - left + 1;
    const h = bottom - top + 1;
    tiles.push({ name: frame.name, left, top, w, h, png });
  }
  // Height-sorted shelf packing avoids wasting the large transparent corners of each pose.
  const shelves = [];
  let height = 0;
  for (const tile of [...tiles].sort((a, b) => b.h - a.h || b.w - a.w)) {
    const packedW = tile.w + gutter * 2;
    const packedH = tile.h + gutter * 2;
    const fits = shelves.filter((shelf) => shelf.h >= packedH && shelf.x + packedW <= width);
    let shelf = fits.sort((a, b) => width - a.x - packedW - (width - b.x - packedW))[0];
    if (!shelf) {
      shelf = { x: 0, y: height, h: packedH };
      shelves.push(shelf);
      height += packedH;
    }
    tile.x = shelf.x + gutter;
    tile.y = shelf.y + gutter;
    shelf.x += packedW;
  }
  for (const tile of tiles) {
    const cropped = await sharp(tile.png)
      .extract({ left: tile.left, top: tile.top, width: tile.w, height: tile.h })
      .png()
      .toBuffer();
    composites.push({ input: cropped, left: tile.x, top: tile.y });
    atlas[tile.name] = {
      frame: { x: tile.x, y: tile.y, w: tile.w, h: tile.h },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: tile.left, y: tile.top, w: tile.w, h: tile.h },
      sourceSize: { w: SIZE, h: SIZE },
      // Effect clips use different scene origins; a custom pivot would override those per frame.
      ...(name.startsWith('actor-') ? { pivot: { x: 0.5, y: 0.86 } } : {}),
    };
  }
  await sharp({ create: { width, height, channels: 4, background: '#00000000' } })
    .composite(composites)
    .webp({ quality: 94, alphaQuality: 100, effort: 6 })
    .toFile(path.join(assets, `${name}.webp`));
  await fs.writeFile(
    path.join(assets, `${name}.json`),
    `${JSON.stringify(
      {
        frames: atlas,
        meta: {
          app: 'Bom Nguyên Tố original vector bake',
          version: '1',
          image: `${name}.webp`,
          format: 'RGBA8888',
          size: { w: width, h: height },
          scale: '1',
        },
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${name}: ${frames.length} frames · ${width}×${height}`);
}

async function still(name, content) {
  // Render menu portraits at 2× for high-density screens.
  await sharp(Buffer.from(content), { density: Object.hasOwn(PALETTES, name) ? 144 : 72 })
    .webp({ quality: 95, alphaQuality: 100 })
    .toFile(path.join(assets, `${name}.webp`));
}

async function main() {
  await fs.mkdir(previews, { recursive: true });
  const args = new Set(process.argv.slice(2));
  const selected = args.has('--actors') || args.has('--effects');
  const drawActors = !selected || args.has('--actors');
  const drawEffects = !selected || args.has('--effects');
  const drawStills = !args.has('--atlas-only');
  const elementFilter = [...args].find((arg) => arg.startsWith('--element='))?.slice(10);
  if (elementFilter && !Object.hasOwn(PALETTES, elementFilter))
    throw new Error(`Unknown element: ${elementFilter}`);
  for (const element of drawActors
    ? Object.keys(PALETTES).filter((e) => !elementFilter || e === elementFilter)
    : []) {
    const frames = [];
    for (const direction of DIRECTIONS) {
      for (const [state, count] of Object.entries(STATES)) {
        for (let i = 0; i < count; i++)
          frames.push({
            name: `${state}-${direction}-${String(i).padStart(2, '0')}`,
            svg: mascot(element, direction, state, i),
          });
      }
    }
    await pack(`actor-${element}`, frames);
    if (drawStills) await still(element, mascot(element, 'down', 'idle', 0));
    await fs.writeFile(path.join(previews, `${element}.svg`), mascot(element, 'down', 'idle', 0));
  }
  if (drawEffects) {
    const effects = [];
    for (const [name, count] of Object.entries(EFFECTS)) {
      for (let i = 0; i < count; i++)
        effects.push({ name: `${name}-${String(i).padStart(2, '0')}`, svg: effect(name, i) });
    }
    await pack('cartoon-fx', effects);
    if (drawStills) {
      await still('bomb', effect('bomb-fuse', 0));
      await still('heal', svg(healDrawing()));
      for (const element of Object.keys(PALETTES))
        await still(`blast-${element}`, burst(element, 3));
    }
  }
  // Compact contact sheet used for a visual check; it is not a game asset.
  const poses = [];
  const elements = Object.keys(PALETTES);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      const [state, index] = [
        ['idle', 0],
        ['walk', 1],
        ['place', 2],
        ['skill', 2],
        ['frozen', 0],
        ['ko', 5],
      ][c];
      poses.push({
        input: await raster(mascot(elements[r], 'down', state, index)),
        left: c * SIZE,
        top: r * SIZE,
      });
    }
  }
  await sharp({ create: { width: SIZE * 6, height: SIZE * 5, channels: 4, background: '#fff5df' } })
    .composite(poses)
    .png()
    .toFile(path.join(previews, 'mascots.png'));
  const effectPoses = [];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 8; c++)
      effectPoses.push({
        input: await raster(burst(elements[r], c)),
        left: c * SIZE,
        top: r * SIZE,
      });
  await sharp({ create: { width: SIZE * 8, height: SIZE * 5, channels: 4, background: '#fff5df' } })
    .composite(effectPoses)
    .png()
    .toFile(path.join(previews, 'bursts.png'));
}

await main();
