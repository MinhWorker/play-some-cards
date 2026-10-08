import type Phaser from 'phaser';
import type { Direction, Element } from '../game/model.js';
import { ELEMENTS } from '../game/model.js';

export const ACTOR_ANIMATIONS = {
  idle: { frames: 4, fps: 5, repeat: -1 },
  walk: { frames: 8, fps: 12, repeat: -1 },
  place: { frames: 5, fps: 14, repeat: 0 },
  skill: { frames: 6, fps: 13, repeat: 0 },
  hit: { frames: 4, fps: 16, repeat: 0 },
  frozen: { frames: 2, fps: 3, repeat: -1 },
  ko: { frames: 6, fps: 10, repeat: 0 },
  spawn: { frames: 6, fps: 12, repeat: 0 },
} as const;

export type ActorAnimation = keyof typeof ACTOR_ANIMATIONS;
export type Facing = Exclude<Direction, 'none'>;
const FACINGS: Facing[] = ['down', 'up', 'left', 'right'];

const EFFECT_ANIMATIONS = {
  'bomb-fuse': { frames: 12, fps: 8, repeat: -1 },
  'bomb-frozen': { frames: 4, fps: 3, repeat: -1 },
  'crate-break': { frames: 8, fps: 16, repeat: 0 },
  'pickup-gleam': { frames: 8, fps: 8, repeat: -1 },
  'pickup-heal': { frames: 6, fps: 8, repeat: -1 },
  'pickup-range': { frames: 6, fps: 8, repeat: -1 },
  'pickup-capacity': { frames: 6, fps: 8, repeat: -1 },
  'pickup-speed': { frames: 6, fps: 8, repeat: -1 },
  dust: { frames: 6, fps: 16, repeat: 0 },
  dash: { frames: 8, fps: 16, repeat: 0 },
  freeze: { frames: 8, fps: 8, repeat: -1 },
  victory: { frames: 12, fps: 12, repeat: 0 },
} as const;

export type EffectAnimation =
  | keyof typeof EFFECT_ANIMATIONS
  | `burst-${Element}`
  | `linger-${Element}`
  | `skill-${Element}`
  | `bomb-${Element}`;

export const actorFrame = (state: ActorAnimation, facing: Facing, index = 0) =>
  `${state}-${facing}-${String(index).padStart(2, '0')}`;

export const actorAnimation = (element: Element, state: ActorAnimation, facing: Facing) =>
  `bom-nguyen-to:actor:${element}:${state}:${facing}`;

export const effectFrame = (name: EffectAnimation, index = 0) =>
  `${name}-${String(index).padStart(2, '0')}`;

export const effectAnimation = (name: EffectAnimation) => `bom-nguyen-to:fx:${name}`;

/** Registers named frame sequences once; atlases are loaded by GameScene's asset host. */
export function registerAnimations(scene: Phaser.Scene, texture: (name: string) => string) {
  for (const element of ELEMENTS) {
    for (const facing of FACINGS) {
      for (const [name, config] of Object.entries(ACTOR_ANIMATIONS)) {
        const state = name as ActorAnimation;
        const key = actorAnimation(element, state, facing);
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
          key,
          frames: Array.from({ length: config.frames }, (_, i) => ({
            key: texture(`actor-${element}`),
            frame: actorFrame(state, facing, i),
          })),
          frameRate: config.fps,
          repeat: config.repeat,
        });
      }
    }
  }
  const effects: Record<string, { frames: number; fps: number; repeat: number }> = {
    ...EFFECT_ANIMATIONS,
  };
  for (const element of ELEMENTS) {
    effects[`bomb-${element}`] = { frames: 12, fps: 8, repeat: -1 };
    effects[`burst-${element}`] = { frames: 8, fps: 18, repeat: 0 };
    effects[`linger-${element}`] = { frames: 6, fps: 12, repeat: -1 };
    effects[`skill-${element}`] = { frames: 8, fps: 16, repeat: 0 };
  }
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
