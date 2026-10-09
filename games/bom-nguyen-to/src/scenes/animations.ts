import type Phaser from 'phaser';
import type { Direction, Element } from '../game/model.js';
import { ELEMENTS } from '../game/model.js';

/**
 * Speeds of the characters' clips. Their frames come from each `actor-<element>` atlas
 * (`<state>-<facing>-NN`, packed by sources/pack-sprites.py), so the art decides how many.
 */
export const ACTOR_ANIMATIONS = {
  idle: { fps: 4, repeat: -1 },
  walk: { fps: 8, repeat: -1 },
  place: { fps: 12, repeat: 0 },
  skill: { fps: 12, repeat: 0 },
  hit: { fps: 12, repeat: 0 },
  frozen: { fps: 3, repeat: -1 },
  ko: { fps: 8, repeat: 0 },
  spawn: { fps: 10, repeat: 0 },
} as const;

export type ActorAnimation = keyof typeof ACTOR_ANIMATIONS;
export type Facing = Exclude<Direction, 'none'>;
const FACINGS: Facing[] = ['down', 'up', 'left', 'right'];

/** Clips of the `arena-fx` atlas (bombs, blasts) and the older `cartoon-fx` effects. */
const ARENA_ANIMATIONS = {
  bomb: { fps: 8, repeat: -1 },
  ...Object.fromEntries(ELEMENTS.map((e) => [`blast-${e}`, { fps: 12, repeat: -1 }])),
} as Record<string, { fps: number; repeat: number }>;

const EFFECT_ANIMATIONS = {
  'crate-break': { frames: 8, fps: 16, repeat: 0 },
  stun: { frames: 8, fps: 10, repeat: -1 },
  dust: { frames: 6, fps: 16, repeat: 0 },
  dash: { frames: 8, fps: 16, repeat: 0 },
  freeze: { frames: 8, fps: 8, repeat: -1 },
  victory: { frames: 12, fps: 12, repeat: 0 },
} as const;

export type EffectAnimation = keyof typeof EFFECT_ANIMATIONS | `skill-${Element}`;
export type ArenaAnimation = 'bomb' | `blast-${Element}`;

export const actorFrame = (state: ActorAnimation, facing: Facing, index = 0) =>
  `${state}-${facing}-${String(index).padStart(2, '0')}`;

export const actorAnimation = (element: Element, state: ActorAnimation, facing: Facing) =>
  `bom-nguyen-to:actor:${element}:${state}:${facing}`;

export const effectFrame = (name: EffectAnimation, index = 0) =>
  `${name}-${String(index).padStart(2, '0')}`;

export const effectAnimation = (name: EffectAnimation) => `bom-nguyen-to:fx:${name}`;

export const arenaFrame = (name: ArenaAnimation | `item-${string}`, index = 0) =>
  `${name}-${String(index).padStart(2, '0')}`;

export const arenaAnimation = (name: ArenaAnimation) => `bom-nguyen-to:arena:${name}`;

/** The atlas frames named `<prefix>NN`, in order. */
function framesOf(scene: Phaser.Scene, key: string, prefix: string) {
  return scene.textures
    .get(key)
    .getFrameNames()
    .filter((name) => name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length)))
    .sort()
    .map((frame) => ({ key, frame }));
}

/** Registers named frame sequences once; atlases are loaded by GameScene's asset host. */
export function registerAnimations(scene: Phaser.Scene, texture: (name: string) => string) {
  for (const element of ELEMENTS) {
    const key = texture(`actor-${element}`);
    for (const facing of FACINGS) {
      for (const [name, config] of Object.entries(ACTOR_ANIMATIONS)) {
        const state = name as ActorAnimation;
        const anim = actorAnimation(element, state, facing);
        if (scene.anims.exists(anim)) continue;
        scene.anims.create({
          key: anim,
          frames: framesOf(scene, key, `${state}-${facing}-`),
          frameRate: config.fps,
          repeat: config.repeat,
        });
      }
    }
  }
  const arena = texture('arena-fx');
  for (const [name, config] of Object.entries(ARENA_ANIMATIONS)) {
    const anim = arenaAnimation(name as ArenaAnimation);
    if (scene.anims.exists(anim)) continue;
    scene.anims.create({
      key: anim,
      frames: framesOf(scene, arena, `${name}-`),
      frameRate: config.fps,
      repeat: config.repeat,
    });
  }
  const effects: Record<string, { frames: number; fps: number; repeat: number }> = {
    ...EFFECT_ANIMATIONS,
  };
  for (const element of ELEMENTS) effects[`skill-${element}`] = { frames: 8, fps: 16, repeat: 0 };
  for (const [name, config] of Object.entries(effects)) {
    const effect = name as EffectAnimation;
    const key = effectAnimation(effect);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: Array.from({ length: config.frames }, (_, i) => ({
        key: texture('cartoon-fx'),
        frame: effectFrame(effect, i),
      })),
      frameRate: config.fps,
      repeat: config.repeat,
    });
  }
}
