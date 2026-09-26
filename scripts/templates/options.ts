/**
 * The room's options, picked on the setup screen. The server checks them with this schema and
 * keeps them for the room's life: `ctx.options` in the game and its screens. Give every field a
 * default: `optionsSchema.parse({})` is what a room gets without the screen.
 */
import { z } from 'zod';

export const optionsSchema = z.object({
  // level: z.enum(['easy', 'hard']).default('easy'),
});

export type Options = z.infer<typeof optionsSchema>;
