import type { AnyGamePlugin, GameMeta } from '@psc/sdk';

// The game contract lives in @psc/sdk (games only depend on the SDK); core code imports it
// from here.
export type { GameMeta, GameResult, GameRules, PlayerId } from '@psc/sdk';
export { defaultOptions } from '@psc/sdk';

/**
 * A registered game as the server and web use it: its rules, its meta and its room options
 * (`room`, when it has any) in one object.
 */
export type AnyGameDefinition = AnyGamePlugin['rules'] & GameMeta & Pick<AnyGamePlugin, 'room'>;
