import type { ConsoleIssue, DevConsoleSchema } from '@xomdao/sdk';
import { z } from 'zod';

export type { DevCommandInfo, DevConsoleSchema } from '@xomdao/sdk';

import { avatarSchema, frameSchema, profileSchema } from './account.js';
import { ITEM_SLOTS } from './items.js';

/**
 * The contract between the clients and the server, written once as zod schemas. The server
 * speaks it over two transports:
 *   - Socket.IO (the Phaser web app): `ClientToServerEvents` / `ServerToClientEvents` below;
 *   - plain WebSocket + JSON on `/ws` (the Godot client), see `WsClientMessage`.
 * `npm run gen:protocol` turns `types`, `requests` and `events` into GDScript
 * (apps/client/addons/xomdao_sdk/generated/); CI fails when it is stale.
 *
 * To add or change a message: edit the schema here, then run `npm run gen:protocol`. TypeScript
 * then points at every place to update.
 */

/**
 * Bump this whenever a change here breaks older clients or servers (renamed/removed events,
 * changed payloads). Clients and server deploy separately, so they compare it on connect: the
 * client sends it (Socket.IO `auth.protocol`, WebSocket `auth:*` requests), and the server refuses
 * a mismatch with `PROTOCOL_MISMATCH` (Socket.IO: the error's `data.protocol` is the server's
 * version). CI fails when this file changes without a bump, unless the PR has the
 * `protocol:compatible` label.
 */
export const PROTOCOL_VERSION = 8;

/** Error when the client's PROTOCOL_VERSION differs from the server's. */
export const PROTOCOL_MISMATCH = 'protocol-mismatch';

/** What the Socket.IO client passes as `auth` when connecting. */
export interface HandshakeAuth {
  token: string;
  protocol: number;
}

/** The main currency. */
export const COIN = 'core:coin';

// ── Data ────────────────────────────────────────────────────────────────────────────────────

/** The logged-in player, as the server sends it to themselves. */
export const User = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  avatar: avatarSchema,
  frame: frameSchema,
  /** The back of their cards in card games (`CardBack`); older servers send none. */
  cardBack: z.string().optional(),
});
export type User = z.infer<typeof User>;

export const PlayerInfo = z.object({
  id: z.string(),
  name: z.string(),
  connected: z.boolean(),
  /** A seat the computer plays (never a host, always connected). */
  bot: z.boolean().optional(),
  /** The account's picture (`Avatar`) and the ring around it (`Frame`); bots have none. */
  avatar: z.string().optional(),
  frame: z.string().optional(),
  /** In `players` and `spectators`: the back of their cards (`CardBack`). */
  cardBack: z.string().optional(),
  /** In `seats` only: left the room during this game. */
  left: z.boolean().optional(),
});
export type PlayerInfo = z.infer<typeof PlayerInfo>;

export const RoomStatus = z.enum(['lobby', 'playing', 'finished']);
export type RoomStatus = z.infer<typeof RoomStatus>;

/** Players take a seat (limited to the game's maxPlayers); spectators only watch (no limit). */
export const RoomRole = z.enum(['player', 'spectator']);
export type RoomRole = z.infer<typeof RoomRole>;

/**
 * Wins per seat (seat = position in `players`, e.g. Caro seat 0 is red X, seat 1 blue O) and
 * draws, counted over every game played in the room. Only reset when the room is disbanded.
 */
export const RoomScore = z.object({ wins: z.array(z.int()), draws: z.int() });
export type RoomScore = z.infer<typeof RoomScore>;

/** One `ctx.reward` of a game (`GameResult.rewards`). */
export const Reward = z.object({ player: z.string(), resource: z.string(), amount: z.int() });

/** How a game ended (`GameResult` in @xomdao/sdk). */
export const GameResultSchema = z.object({
  /** Empty means a draw. */
  winners: z.array(z.string()),
  rewards: z.array(Reward).optional(),
  /** What the game counted with `ctx.stat`. */
  stats: z.array(z.object({ player: z.string(), name: z.string(), amount: z.int() })).optional(),
});

export const LastMove = z.object({ seq: z.int(), player: z.string(), move: z.unknown() });
export const RoomTimer = z.object({ event: z.string(), ms: z.number(), left: z.number() });
export const Played = z.object({ ms: z.number(), running: z.boolean() });

/** What one specific member sees of a room. `view` is already filtered by `getView`. */
export const RoomSnapshot = z.object({
  /** The room's short code: share it to let friends in (`room:join`). */
  code: z.string(),
  gameId: z.string(),
  /** `null` when every seat is empty (only spectators left); the next to sit becomes host. */
  hostId: z.string().nullable(),
  players: z.array(PlayerInfo),
  spectators: z.array(PlayerInfo),
  /**
   * Everyone seated when the current (or last) game began, in seat order, `left` marking who
   * has gone since: what the board shows. `null` before the first game.
   */
  seats: z.array(PlayerInfo).nullable(),
  status: RoomStatus,
  view: z.unknown(),
  result: GameResultSchema.nullable(),
  score: RoomScore,
  /** Chosen on the game's setup screen when the room was created (see `RoomSetup`). */
  options: z.unknown(),
  /** Counts games started in this room: a new number means a new game began. */
  round: z.int(),
  /**
   * The last move of this game, for boards to animate "who just did what" (`move` as the game's
   * `moveView` lets this member see it). `null` before the first move. `seq` goes up by one each.
   */
  last: LastMove.nullable(),
  /** The game's timer: which one, its full length and how much was left when this was sent. */
  timer: RoomTimer.nullable(),
  /**
   * How long the current (or last) game has lasted when this was sent; `running` until it
   * ends. `null` when no game is on the board.
   */
  played: Played.nullable(),
});
export type RoomSnapshot = z.infer<typeof RoomSnapshot>;

/** One row in a game's room list. */
export const RoomSummary = z.object({
  code: z.string(),
  hostName: z.string(),
  players: z.int(),
  maxPlayers: z.int(),
  /** Connected spectators. */
  spectators: z.int(),
  status: RoomStatus,
  /** True when a new player can take a seat right now. */
  canJoin: z.boolean(),
});
export type RoomSummary = z.infer<typeof RoomSummary>;

export const JoinedRoom = z.object({
  roomCode: z.string(),
  /** Your member id in the room: your account's user id. */
  playerId: z.string(),
});
export type JoinedRoom = z.infer<typeof JoinedRoom>;

/** An account's amount of each resource it has (`core:coin`); resources never held are missing. */
export const Balances = z.record(z.string(), z.int());
export type Balances = z.infer<typeof Balances>;

/** What a player received when a game ended (`reward`). */
export const RewardNotice = z.object({
  userId: z.string(),
  gameId: z.string(),
  rewards: z.array(z.object({ resource: z.string(), amount: z.int() })),
  /** Balances after the reward. */
  balances: Balances,
});
export type RewardNotice = z.infer<typeof RewardNotice>;

/** Someone who sat at the table, as they were when the game began. */
export const MatchPlayer = z.object({
  name: z.string(),
  avatar: z.string().optional(),
  frame: z.string().optional(),
  bot: z.boolean(),
  won: z.boolean(),
  /** Left during the game (games that go on without them). */
  left: z.boolean(),
  /** The player asking for their history. */
  me: z.boolean(),
});
export type MatchPlayer = z.infer<typeof MatchPlayer>;

/** One finished game, seen by one of its players. */
export const MatchRecord = z.object({
  id: z.string(),
  gameId: z.string(),
  /** How it ended for the player asking. */
  outcome: z.enum(['win', 'loss', 'draw']),
  /** Epoch milliseconds. */
  startedAt: z.number(),
  endedAt: z.number(),
  /** In seat order. */
  players: z.array(MatchPlayer),
});
export type MatchRecord = z.infer<typeof MatchRecord>;

/**
 * A genre island in the hub. The two `main` genres (Cờ, Bài) have fixed big islands beside
 * Xóm; the others fill the small island slots behind it in `order` (docs/experience.md).
 */
export const Genre = z.object({
  /** Kebab-case; games name it in `meta.genre`. */
  id: z.string(),
  /** Vietnamese name shown to players. */
  name: z.string(),
  /** Sort key: tabs and islands go in increasing `order`. */
  order: z.int(),
  /** Its island art in the client: `apps/client/hub/genres/<island>.webp`. */
  island: z.string(),
  main: z.boolean(),
});
export type Genre = z.infer<typeof Genre>;

const Amounts = z.record(z.string(), z.int());

/** A time-limited event (`EventMeta` in @xomdao/sdk). */
export const EventInfo = z.object({
  opensAt: z.string(),
  closesAt: z.string(),
  tiers: z.array(z.object({ points: z.int(), reward: Amounts })),
  /** The detail board's colour (`#RRGGBB`). */
  color: z.string().optional(),
});

/** One game card in the hub's catalog (`catalog:get`). */
export const GameCard = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['table', 'event']),
  genre: z.string(),
  tagline: z.string(),
  minPlayers: z.int(),
  maxPlayers: z.int(),
  /** Minutes one game takes. */
  duration: z.object({ min: z.int(), max: z.int() }),
  /** Card art: a file name in the game's assets (no extension). */
  card: z.string(),
  /** `wip` cards only reach servers that show works in progress (dev, previews). */
  status: z.enum(['ready', 'wip']),
  /** Most one player wins from one game, per resource (`core:coin`). */
  rewardCap: Amounts,
  event: EventInfo.optional(),
  /** Events: milliseconds until it closes, by the server's event clock. */
  closesIn: z.int().optional(),
  /** People seated in its rooms right now. */
  playing: z.int(),
  /** Its rooms with a free seat. */
  openRooms: z.int(),
});
export type GameCard = z.infer<typeof GameCard>;

export const Catalog = z.object({
  /** In `order`. */
  genres: z.array(Genre),
  /** Ready cards first, then by name. */
  games: z.array(GameCard),
});
export type Catalog = z.infer<typeof Catalog>;

/** An item at Chợ (`ITEMS` in items.ts), with whether you have it. */
export const ShopItem = z.object({
  id: z.string(),
  slot: z.enum(ITEM_SLOTS),
  look: z.string(),
  name: z.string(),
  /** In `core:coin`; 0 = everyone has it. */
  price: z.int(),
  owned: z.boolean(),
});
export type ShopItem = z.infer<typeof ShopItem>;

/** Reply of `shop:list`: every item, cheapest first in each slot. */
export const ShopList = z.object({ items: z.array(ShopItem) });

/** Reply of `shop:buy`: what you bought, and your balances after paying. */
export const Purchase = z.object({ item: ShopItem, balances: Balances });

/** A player's Nhà: who they are, what they wear and what they own (free items included). */
export const Profile = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  frame: z.string(),
  cardBack: z.string(),
  /** Item ids, in `ITEMS` order. */
  owned: z.array(z.string()),
});
export type Profile = z.infer<typeof Profile>;

/** Your progress in an event: its points so far and the tiers (indexes) already claimed. */
export const EventProgress = z.object({
  eventId: z.string(),
  points: z.int(),
  claimed: z.array(z.int()),
});
export type EventProgress = z.infer<typeof EventProgress>;

/** Reply of `event:claim`: the progress with that tier claimed, and your new balances. */
export const EventClaim = z.object({ progress: EventProgress, balances: Balances });

/** One achievement (`ACHIEVEMENTS`) and how far a player is in it. */
export const AchievementInfo = z.object({
  /** `core:won-10`, `tien-len:chop`. */
  id: z.string(),
  name: z.string(),
  /** The game it counts in; `""` for the hub's own, which count over every game. */
  gameId: z.string(),
  /** The stat it counts: `played`, `won` or a game's own. */
  stat: z.string(),
  at: z.int(),
  /** The player's count so far (may pass `at`). */
  progress: z.int(),
  unlocked: z.boolean(),
  reward: Amounts,
  xp: z.int(),
});
export type AchievementInfo = z.infer<typeof AchievementInfo>;

/**
 * Where a player stands on one board: `core` (everyone, by experience) or a game's id (by wins
 * in it). `rank` is 1 for the first; ties share a rank.
 */
export const RankInfo = z.object({ board: z.string(), value: z.int(), rank: z.int() });
export type RankInfo = z.infer<typeof RankInfo>;

/** Someone's statistics (`stats:get`): level, totals, achievements and ranks. */
export const PlayerStats = z.object({
  userId: z.string(),
  level: z.int(),
  /** Experience so far; the level started at `levelXp` and the next one is at `nextXp`. */
  xp: z.int(),
  levelXp: z.int(),
  nextXp: z.int(),
  /** Games finished and won, over every game. */
  played: z.int(),
  won: z.int(),
  /** Every achievement, the hub's own first. */
  achievements: z.array(AchievementInfo),
  /** The boards they are on (`core` first, then games by wins); none before their first game. */
  ranks: z.array(RankInfo),
});
export type PlayerStats = z.infer<typeof PlayerStats>;

/** One row of a ranking. */
export const RankingEntry = z.object({
  rank: z.int(),
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  frame: z.string(),
  /** Experience on `core`, wins on a game's board. */
  value: z.int(),
});
export type RankingEntry = z.infer<typeof RankingEntry>;

/** A board's top players (`ranking:get`), and your own row when you are on it. */
export const Ranking = z.object({
  board: z.string(),
  entries: z.array(RankingEntry),
  me: RankingEntry.nullable(),
});
export type Ranking = z.infer<typeof Ranking>;

/** Achievements you just reached (`achievement`), paid through the ledger, and your balances. */
export const AchievementNotice = z.object({
  achievements: z.array(AchievementInfo),
  balances: Balances,
});
export type AchievementNotice = z.infer<typeof AchievementNotice>;

// ── Requests and events ─────────────────────────────────────────────────────────────────────

const Empty = z.object({});
const Auth = { protocol: z.int() };

/** Reply of every `auth:*` request: keep `token` to log in again (`auth:token`) later. */
export const AuthReply = z.object({ token: z.string(), user: User });
/** Reply of `session:resume`. */
export const SessionInfo = z.object({
  user: User,
  room: JoinedRoom.nullable(),
  balances: Balances,
});
/** A game's room list (`lobby:watch` reply). */
export const RoomList = z.object({ rooms: z.array(RoomSummary) });
/** A new room list for the game you watch. */
export const LobbyRooms = z.object({ gameId: z.string(), rooms: z.array(RoomSummary) });
/** The room was disbanded, or you left it from another device. */
export const RoomClosed = z.object({ gameId: z.string(), reason: z.string() });

/**
 * Before any other request on the WebSocket transport, one of these logs the connection in
 * (Socket.IO logs in with `auth` when connecting instead). Each carries the client's
 * `protocol` (PROTOCOL_VERSION); a mismatch is refused with `PROTOCOL_MISMATCH`.
 */
export const authRequests = {
  /** A token from an earlier login (kept by the client). */
  'auth:token': { req: z.object({ ...Auth, token: z.string() }), res: AuthReply },
  'auth:login': {
    req: z.object({ ...Auth, username: z.string(), password: z.string() }),
    res: AuthReply,
  },
  /** A new guest account with only a display name (no password; the token is the key). */
  'auth:guest': { req: z.object({ ...Auth, name: z.string() }), res: AuthReply },
};

/** What a logged-in client may ask, with each reply's data (`{ ok: true, ...data }`). */
export const requests = {
  /**
   * Sent after every (re)connect: who you are, the room your account is in (if any) and your
   * balances. Being in a room follows the account, not the browser: closing the tab and logging
   * in anywhere puts you back in your seat. An account is in at most one room.
   */
  'session:resume': { req: Empty, res: SessionInfo },
  /** Change display name, avatar and frame (also updates your name in your current room). */
  'profile:update': { req: profileSchema, res: z.object({ user: User }) },
  /**
   * Chợ: every item for sale, with whether you have it. `shop:buy` pays its price through the
   * ledger (once per item and account, so a double tap never pays twice) and puts it in your
   * Túi đồ; it fails with "Không đủ xu" when you can't pay.
   */
  'shop:list': { req: Empty, res: ShopList },
  'shop:buy': { req: z.object({ itemId: z.string() }), res: Purchase },
  /** Someone's Nhà (yours without `userId`); read-only for others. */
  'inventory:get': { req: z.object({ userId: z.string().optional() }), res: Profile },
  /** Wear an item you own (also shows on you in your current room). */
  'inventory:equip': { req: z.object({ itemId: z.string() }), res: z.object({ user: User }) },
  /**
   * Your progress in an event (a game with `kind: 'event'`). `event:claim` pays a tier you have
   * the points for through the ledger, once ("Chưa đủ điểm", "Bạn đã nhận mốc này").
   */
  'event:get': { req: z.object({ eventId: z.string() }), res: EventProgress },
  'event:claim': { req: z.object({ eventId: z.string(), tier: z.int() }), res: EventClaim },
  /** Someone's level, achievements and ranks (yours without `userId`). */
  'stats:get': { req: z.object({ userId: z.string().optional() }), res: PlayerStats },
  /** The top `RANKING_LIMIT` of a board: `core` (by experience) or a game's id (by wins). */
  'ranking:get': { req: z.object({ board: z.string() }), res: Ranking },
  /** Your most recent finished games (`HISTORY_LIMIT`), newest first. */
  'history:recent': { req: Empty, res: z.object({ matches: z.array(MatchRecord) }) },
  /**
   * The hub's catalog: genres and game cards with how many people play each and its open rooms.
   * Works in progress are left out on servers that hide them (production).
   */
  'catalog:get': { req: Empty, res: Catalog },
  /** Subscribe to a game's room list; the server then pushes 'lobby:rooms' on every change. */
  'lobby:watch': { req: z.object({ gameId: z.string() }), res: RoomList },
  'lobby:unwatch': { req: Empty, res: Empty },
  /**
   * Creating or joining a room first leaves the room you were in (if it is another one).
   * `options` come from the game's own setup screen, if it has one (checked by `room.options`).
   */
  'room:create': {
    req: z.object({ gameId: z.string(), options: z.unknown().optional() }),
    res: JoinedRoom,
  },
  /**
   * Quick match (CHƠI): a seat in a waiting quick-match room of this game, else a new one. It
   * starts once full; if nobody else comes for a while, the computer takes the empty seats
   * (games with `room.withBots`) and it starts.
   */
  'room:quick': { req: z.object({ gameId: z.string() }), res: JoinedRoom },
  /** Joins by the room's short code (any case), as a player or to watch. */
  'room:join': { req: z.object({ roomCode: z.string(), role: RoomRole }), res: JoinedRoom },
  /**
   * A player leaving mid-game cancels that game; during or after a game the room goes back
   * to the lobby. When the host leaves, the next
   * player becomes host; when no player is left, the room is disbanded ('room:closed').
   */
  'room:leave': { req: Empty, res: Empty },
  /** A spectator takes a free seat (only before the game starts or after it ends). */
  'room:sit': { req: Empty, res: Empty },
  /**
   * Host only, not during a game: replace the room's options (a board's `changeOptions`). The
   * next game starts with them. Can't change how many seats the computer has.
   */
  'room:options': { req: z.object({ options: z.unknown() }), res: Empty },
  'game:start': { req: Empty, res: Empty },
  /** `move` is `{ event, payload }`: one of the game's events. */
  'game:move': { req: z.object({ move: z.unknown() }), res: Empty },
  'game:restart': { req: Empty, res: Empty },
};

/** What the server pushes. */
export const events = {
  'room:state': RoomSnapshot,
  'lobby:rooms': LobbyRooms,
  /** The room was disbanded (no players left); everyone still inside is sent out. */
  'room:closed': RoomClosed,
  /** A game you played ended and paid you (once per game, within its `meta.rewardCap`). */
  reward: RewardNotice,
  /** A game you played got you achievements; their rewards are paid. */
  achievement: AchievementNotice,
};

/**
 * The named data shapes, for `npm run gen:protocol`: each becomes a GDScript class (an object
 * schema) or a constant list (an enum). Add a schema here when a request or event uses it.
 */
export const types = {
  User,
  PlayerInfo,
  RoomStatus,
  RoomRole,
  RoomScore,
  Reward,
  GameResult: GameResultSchema,
  LastMove,
  RoomTimer,
  Played,
  RoomSnapshot,
  RoomSummary,
  JoinedRoom,
  RewardNotice,
  MatchPlayer,
  MatchRecord,
  Genre,
  EventInfo,
  GameCard,
  Catalog,
  ShopItem,
  ShopList,
  Purchase,
  Profile,
  EventProgress,
  EventClaim,
  AchievementInfo,
  RankInfo,
  PlayerStats,
  RankingEntry,
  Ranking,
  AchievementNotice,
  ProfileUpdate: profileSchema,
  AuthReply,
  SessionInfo,
  RoomList,
  LobbyRooms,
  RoomClosed,
};

/** Every request gets either `{ ok: true, ...data }` or `{ ok: false, error }`. */
export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

type Requests = typeof requests;
type Events = typeof events;

/** Dev logs contain full game details and are only sent to opted-in members in dev mode. */
export interface DevLogEntry {
  id: number;
  t: number;
  level: 'info' | 'warn' | 'error';
  kind: 'move' | 'reject' | 'timer' | 'bot' | 'command' | 'game' | 'room' | 'error';
  seat?: number;
  text: string;
  data?: unknown;
}

/** Dev only (Socket.IO): older clients need none of these. */
interface DevClientEvents {
  /** Start or stop following the current room's log. */
  'dev:logs': (req: { on: boolean }, ack: Ack<{ entries: DevLogEntry[] }>) => void;
  /** Execute in the sender's room. */
  'dev:command': (
    req: { line: string },
    ack: (
      res: { ok: true; output: string } | { ok: false; error: string; issue?: ConsoleIssue },
    ) => void,
  ) => void;
  'dev:schema': (req: Record<string, never>, ack: Ack<DevConsoleSchema>) => void;
  /** Adds coins to your own balance through the ledger (e2e: something to spend at Chợ). */
  'dev:coins': (req: { amount: number }, ack: Ack<{ balances: Balances }>) => void;
  /**
   * Moves the server's event clock to `at` (an ISO date), or back to the real time with `null`
   * (e2e: open or close an event).
   */
  'dev:clock': (req: { at: string | null }, ack: Ack<{ now: string }>) => void;
}

/** The Socket.IO events a client sends, from `requests`. */
export type ClientToServerEvents = {
  [E in keyof Requests]: (
    req: z.input<Requests[E]['req']>,
    ack: Ack<z.output<Requests[E]['res']>>,
  ) => void;
} & DevClientEvents;

/** The Socket.IO events the server pushes, from `events`. */
export type ServerToClientEvents = {
  [E in keyof Events]: (payload: z.output<Events[E]>) => void;
} & {
  /** Dev only: the next room log entry, while following dev:logs. */
  'dev:log': (entry: DevLogEntry) => void;
};

/**
 * WebSocket transport (`/ws`), one JSON object per text frame:
 *   client → server  `{ id, event, data }`: a request (`authRequests`, then `requests`);
 *   server → client  `{ id, ack }`: its reply (`{ ok: true, ...data }` or `{ ok: false, error }`);
 *   server → client  `{ event, data }`: a pushed event (`events`).
 * Ids are the client's own, echoed back. Requests other than `auth:*` before logging in get
 * `{ ok: false, error: 'unauthorized' }`.
 */
export interface WsClientMessage {
  id: number;
  event: string;
  data?: unknown;
}
export type WsServerMessage =
  | { id: number; ack: { ok: boolean; [key: string]: unknown } }
  | { event: string; data: unknown };
