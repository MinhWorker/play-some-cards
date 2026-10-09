/** Console store, socket log subscription, persisted preferences and one command execution path. */
import {
  type ConsoleCompletion,
  type ConsoleIssue,
  completeConsoleLine,
  type DevConsoleSchema,
  parseConsoleLine,
} from '@xomdao/sdk';
import type { DevLogEntry, RoomSnapshot } from '@xomdao/shared';
import { devToolsEnabled, setDevSetting } from '@/lib/devTools';
import { request, socket } from '@/lib/socket';

export const LOG_KINDS = [
  'move',
  'reject',
  'timer',
  'bot',
  'command',
  'game',
  'room',
  'error',
] as const;
type Dock = 'tl' | 'tr' | 'bl' | 'br';
interface Preferences {
  kinds: string[];
  find: string;
  dock: Dock;
  opacity: number;
  pins: Record<string, Record<string, string>>;
}
export interface CommandResult {
  ok: boolean;
  output: string;
  error?: string;
  issue?: ConsoleIssue;
}
interface ConsoleState {
  room: RoomSnapshot | null;
  schema: DevConsoleSchema;
  entries: DevLogEntry[];
  history: string[];
  preferences: Preferences;
  issue: ConsoleIssue | null;
}
const PREF_KEY = 'xomdao:dev-console:v1';
const HISTORY_KEY = 'xomdao:dev-console:history';
const EMPTY_SCHEMA: DevConsoleSchema = { commands: [], catalogs: {} };
function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function preferences(): Preferences {
  const value = read(PREF_KEY) as Partial<Preferences> | null;
  return {
    kinds: Array.isArray(value?.kinds)
      ? value.kinds.filter((k) => LOG_KINDS.includes(k as (typeof LOG_KINDS)[number]))
      : [...LOG_KINDS],
    find: typeof value?.find === 'string' ? value.find : '',
    dock: ['tl', 'tr', 'bl', 'br'].includes(value?.dock ?? '') ? value!.dock! : 'tl',
    opacity:
      typeof value?.opacity === 'number' && value.opacity >= 10 && value.opacity <= 100
        ? value.opacity
        : 85,
    pins: value?.pins && typeof value.pins === 'object' ? value.pins : {},
  };
}
const savedHistory = read(HISTORY_KEY);
let state: ConsoleState = {
  room: null,
  schema: EMPTY_SCHEMA,
  entries: [],
  history: Array.isArray(savedHistory)
    ? savedHistory.filter((v): v is string => typeof v === 'string').slice(-100)
    : [],
  preferences: preferences(),
  issue: null,
};
const listeners = new Set<() => void>();
const seen = new Set<number>();
let localId = 0;
let generation = 0;
let active = false;
let following = false;
let pending = false;
let commandQueue: Promise<unknown> = Promise.resolve();
export const consoleSnapshot = () => state;
export function subscribeConsole(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function update(next: Partial<ConsoleState>) {
  state = { ...state, ...next };
  for (const fn of listeners) fn();
}
function configure(next: Partial<Preferences>) {
  const prefs = { ...state.preferences, ...next };
  persist(PREF_KEY, prefs);
  update({ preferences: prefs });
}

function print(entry: DevLogEntry) {
  console.groupCollapsed(`[${new Date(entry.t).toLocaleTimeString('vi-VN')}] ${entry.text}`);
  if (entry.data !== undefined) console.log(entry.data);
  console.groupEnd();
}
function receive(entry: DevLogEntry) {
  if (seen.has(entry.id)) return;
  seen.add(entry.id);
  if (seen.size > 1000) {
    const keep = [...seen].sort((a, b) => a - b).slice(-500);
    seen.clear();
    for (const id of keep) seen.add(id);
  }
  print(entry);
  update({
    entries: [...state.entries, entry].sort((a, b) => a.t - b.t || a.id - b.id).slice(-500),
  });
}
function output(text: string, level: DevLogEntry['level'] = 'info', data?: unknown) {
  const entry: DevLogEntry = {
    id: --localId,
    t: Date.now(),
    kind: level === 'error' ? 'error' : 'command',
    level,
    text,
    data,
  };
  print(entry);
  update({ entries: [...state.entries, entry].slice(-500) });
}
function commandOutput(line: string, text: string) {
  if (!text) return;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {}
  if (data && typeof data === 'object') output(`${line} → dữ liệu (DevTools)`, 'info', data);
  else for (const part of text.split('\n').slice(0, 50)) output(part);
}
export function filteredConsoleEntries() {
  const { kinds, find } = state.preferences;
  return state.entries.filter(
    (e) =>
      kinds.includes(e.kind) &&
      (!find || e.text.toLocaleLowerCase('vi-VN').includes(find.toLocaleLowerCase('vi-VN'))),
  );
}
export function consolePins(): Record<string, string> {
  const pins = state.preferences.pins[state.room?.gameId ?? ''];
  if (!pins || typeof pins !== 'object') return {};
  return Object.fromEntries(
    Object.entries(pins).filter(([key, value]) => /^[1-9]$/.test(key) && typeof value === 'string'),
  );
}
export function setConsoleRoom(room: RoomSnapshot | null) {
  if (room?.code !== state.room?.code) {
    generation++;
    following = false;
    pending = false;
    seen.clear();
    update({ room, schema: EMPTY_SCHEMA, entries: [], issue: null });
  } else if (room !== state.room) update({ room });
  if (active) void follow();
}
async function refreshSchema() {
  if (!state.room || !socket.connected) return;
  const version = generation;
  const schema = await request('dev:schema', {});
  if (version === generation) update({ schema });
}
async function follow() {
  if (!active || following || pending || !state.room || !socket.connected) return;
  const version = generation;
  pending = true;
  const replies = await Promise.allSettled([request('dev:logs', { on: true }), refreshSchema()]);
  if (version !== generation || !active) return;
  pending = false;
  const logs = replies[0];
  if (logs.status === 'fulfilled') {
    following = true;
    for (const entry of logs.value.entries) receive(entry);
  } else {
    following = true;
    output((logs.reason as Error).message, 'error');
  }
  if (replies[1].status === 'rejected' && logs.status === 'fulfilled')
    output((replies[1].reason as Error).message, 'error');
}

/** Mount once per enabled overlay. Reconnect waits for session:resume's room:state. */
export function startConsole(room: RoomSnapshot | null) {
  active = true;
  const onState = (next: RoomSnapshot) => setConsoleRoom(next);
  const reconnect = () => {
    generation++;
    following = false;
    pending = false;
  };
  const closed = () => setConsoleRoom(null);
  socket.on('dev:log', receive);
  socket.on('room:state', onState);
  socket.on('connect', reconnect);
  socket.on('disconnect', reconnect);
  socket.on('room:closed', closed);
  setConsoleRoom(room);
  return () => {
    active = false;
    generation++;
    following = false;
    pending = false;
    socket.off('dev:log', receive);
    socket.off('room:state', onState);
    socket.off('connect', reconnect);
    socket.off('disconnect', reconnect);
    socket.off('room:closed', closed);
    if (socket.connected && state.room) void request('dev:logs', { on: false }).catch(() => {});
  };
}
const localDescriptions: Record<string, string> = {
  '.filter': 'Lọc loại log',
  '.find': 'Tìm trong log',
  '.clear': 'Xoá log trên màn hình',
  '.copy': 'Chép log ra clipboard',
  '.pin': 'Ghim lệnh vào số 1–9',
  '.unpin': 'Bỏ ghim',
  '.opacity': 'Độ đậm 10–100',
  '.dock': 'Góc tl|tr|bl|br',
  '.console': 'Tắt console',
};
export const LOCAL_COMMANDS = Object.entries(localDescriptions).map(([name, description]) => ({
  name,
  description,
  usage: name,
  kind: 'engine' as const,
}));
function localCommand(line: string): Promise<string> | string {
  const command = parseConsoleLine(line)[0];
  if (!command) return '';
  const args = command.tokens.map((t) => t.value);
  const [a] = args;
  const requireArgs = (min: number, max = min) => {
    if (args.length < min || args.length > max)
      throw new Error(`Cách dùng: ${command.name} · ${localDescriptions[command.name] ?? 'help'}`);
  };
  const pinNumber = () => {
    if (typeof a !== 'number' || !Number.isInteger(a) || a < 1 || a > 9)
      throw new Error('Số ghim phải từ 1 tới 9');
    return String(a);
  };
  switch (command.name) {
    case '.filter':
      requireArgs(1, 8);
      if (a === 'all' && args.length === 1) configure({ kinds: [...LOG_KINDS] });
      else {
        if (args.some((k) => !LOG_KINDS.includes(k as (typeof LOG_KINDS)[number])))
          throw new Error(`Loại log: ${LOG_KINDS.join(', ')}`);
        configure({ kinds: [...new Set(args as string[])] });
      }
      return `Bộ lọc: ${state.preferences.kinds.join(', ')}`;
    case '.find':
      configure({ find: args.map(String).join(' ') });
      return state.preferences.find ? `Tìm: ${state.preferences.find}` : 'Đã bỏ tìm';
    case '.clear':
      requireArgs(0);
      update({ entries: [] });
      return '';
    case '.copy': {
      requireArgs(0, 1);
      const n = a ?? 50;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 500)
        throw new Error('Số dòng phải từ 1 tới 500');
      const text = filteredConsoleEntries()
        .slice(-n)
        .map((e) => `${new Date(e.t).toISOString()} ${e.kind}: ${e.text}`)
        .join('\n');
      return navigator.clipboard.writeText(text).then(() => 'Đã chép log');
    }
    case '.pin': {
      if (!args.length)
        return (
          Object.entries(consolePins())
            .map(([n, value]) => `!${n}: ${value}`)
            .join('\n') || 'Chưa có ghim'
        );
      if (!state.room) throw new Error('Bạn chưa ở trong phòng nào');
      const n = pinNumber();
      const value = line.slice(command.tokens[0]!.end).trim();
      if (!value) throw new Error('Cách dùng: .pin <1–9> <dòng lệnh>');
      configure({
        pins: { ...state.preferences.pins, [state.room.gameId]: { ...consolePins(), [n]: value } },
      });
      return `!${n}: ${value}`;
    }
    case '.unpin': {
      requireArgs(1);
      const n = pinNumber();
      const pins = { ...consolePins() };
      delete pins[n];
      configure({ pins: { ...state.preferences.pins, [state.room?.gameId ?? '']: pins } });
      return `Đã bỏ !${n}`;
    }
    case '.opacity':
      requireArgs(1);
      if (typeof a !== 'number' || a < 10 || a > 100) throw new Error('Độ đậm phải từ 10 tới 100');
      configure({ opacity: a });
      return `Độ đậm: ${a}%`;
    case '.dock':
      requireArgs(1);
      if (!['tl', 'tr', 'bl', 'br'].includes(String(a))) throw new Error('Góc: tl, tr, bl, br');
      configure({ dock: a as Dock });
      return `Góc: ${a}`;
    case '.console':
      requireArgs(1);
      if (a !== 'off') throw new Error('Cách dùng: .console off');
      setDevSetting('console', false);
      return '';
    default:
      throw new Error(`Không có lệnh "${command.name}". Gõ help để xem lệnh server.`);
  }
}
function sendCommand(line: string): Promise<CommandResult> {
  if (!socket.connected)
    return Promise.resolve({ ok: false, output: '', error: 'Chưa kết nối server' });
  return new Promise((resolve) =>
    socket.timeout(7000).emit('dev:command', { line }, (err, reply) => {
      if (err) resolve({ ok: false, output: '', error: 'Server chưa trả lời lệnh dev' });
      else if (reply.ok) resolve({ ok: true, output: reply.output });
      else resolve({ ok: false, output: '', error: reply.error, issue: reply.issue });
    }),
  );
}
async function execute(line: string, depth = 0): Promise<string> {
  if (depth > 9) throw new Error('Ghim gọi lặp quá nhiều lần');
  if (/^\.pin(?:\s|$)/.test(line.trimStart())) {
    const text = await localCommand(line);
    commandOutput(line, text);
    return text;
  }
  const results: string[] = [];
  for (const command of parseConsoleLine(line)) {
    const part = line.slice(
      command.at,
      command.tokens.at(-1)?.end ?? command.at + command.name.length,
    );
    if (/^![1-9]$/.test(command.name)) {
      if (command.tokens.length) throw new Error('Ghim không nhận thêm tham số');
      const pin = consolePins()[command.name.slice(1)];
      if (!pin)
        throw new Error(
          `Chưa ghim ${command.name}. Dùng .pin ${command.name.slice(1)} <dòng lệnh>.`,
        );
      results.push(await execute(pin, depth + 1));
    } else if (command.name.startsWith('.')) {
      const text = await localCommand(part);
      results.push(text);
      commandOutput(part, text);
    } else {
      const result = await sendCommand(part);
      if (!result.ok)
        throw Object.assign(new Error(result.error), {
          issue: result.issue
            ? {
                ...result.issue,
                at: result.issue.at + command.at,
                end: result.issue.end === undefined ? undefined : result.issue.end + command.at,
              }
            : undefined,
        });
      results.push(result.output);
      commandOutput(part, result.output);
    }
  }
  return results.filter(Boolean).join('\n');
}
async function run(line: string): Promise<CommandResult> {
  if (!devToolsEnabled)
    return { ok: false, output: '', error: 'Dev Console không có trên bản production' };
  line = line.trimEnd();
  if (!line.trim()) return { ok: true, output: '' };
  update({ history: [...state.history.filter((v) => v !== line), line].slice(-100), issue: null });
  persist(HISTORY_KEY, state.history);
  try {
    const text = await execute(line);
    void refreshSchema().catch(() => {});
    return { ok: true, output: text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const issue = (err as { issue?: ConsoleIssue }).issue ?? { message, at: 0, end: line.length };
    update({ issue });
    output(message, 'error', err);
    return { ok: false, output: '', error: message, issue };
  }
}
/** UI, pins and e2e all use this serialized path. One rejected command stops its line. */
export function runCommand(line: string): Promise<CommandResult> {
  const next = commandQueue.then(() => run(line));
  commandQueue = next.catch(() => {});
  return next;
}

/** Suggestions use server schemas and local preferences; React only renders the result. */
export function commandCompletion(line: string): ConsoleCompletion {
  const schema = { ...state.schema, commands: [...state.schema.commands, ...LOCAL_COMMANDS] };
  let completion = completeConsoleLine(
    line,
    schema,
    state.room?.seats ?? state.room?.players ?? [],
  );
  const token = /([^\s]*)$/.exec(line)?.[1] ?? '';
  const from = line.length - token.length;
  const suggestions = (values: string[]) =>
    values
      .filter((v) => v.startsWith(token))
      .map((value) => ({ value, label: value, from, to: line.length }));
  if (/^\.filter\s/.test(line))
    completion = {
      usage: '.filter <loại...> | all',
      suggestions: suggestions([...LOG_KINDS, 'all']),
    };
  if (/^\.dock\s/.test(line))
    completion = { usage: '.dock tl|tr|bl|br', suggestions: suggestions(['tl', 'tr', 'bl', 'br']) };
  if (/^\.opacity\s/.test(line))
    completion = {
      usage: '.opacity <10–100>',
      suggestions: suggestions(['25', '50', '75', '100']),
    };
  if (/^\.(?:pin|unpin)\s[^\s]*$/.test(line))
    completion = {
      usage: '.pin <1–9> <dòng lệnh> | .unpin <1–9>',
      suggestions: suggestions(['1', '2', '3', '4', '5', '6', '7', '8', '9']),
    };
  if (line.startsWith('!') && !line.includes(' '))
    completion = {
      usage: 'Ghim của game',
      suggestions: suggestions(Object.keys(consolePins()).map((n) => `!${n}`)),
    };
  return completion;
}
export function clearConsoleIssue() {
  if (state.issue) update({ issue: null });
}
/** Failure artifacts can read the room buffer even when the overlay's master switch is off. */
export async function readRoomLogs() {
  if (!socket.connected) return state.entries;
  const result = await request('dev:logs', { on: true });
  if (!active) await request('dev:logs', { on: false });
  return result.entries;
}
