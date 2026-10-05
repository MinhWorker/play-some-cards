/** Pure console tokenizer, argument validation and safe state paths, shared by tests and server. */
import { z } from 'zod';

export interface ConsoleIssue {
  message: string;
  at: number;
  end?: number;
  suggestion?: string;
}
export class ConsoleError extends Error {
  constructor(public readonly issue: ConsoleIssue) {
    super(issue.message);
  }
}
export interface ConsoleToken {
  raw: string;
  value: unknown;
  at: number;
  end: number;
}
export interface ConsoleCommand {
  name: string;
  tokens: ConsoleToken[];
  at: number;
}
export interface CatalogEntry {
  id: string;
  value: unknown;
  label: string;
}
export type Catalogs = Record<string, readonly CatalogEntry[]>;
export interface DevCommandInfo {
  name: string;
  description: string;
  usage: string;
  example?: string;
  parameters?: Record<string, unknown>;
  kind?: 'engine' | 'game' | 'event';
}
export const ENGINE_COMMANDS = [
  'help',
  'state',
  'snapshot',
  'undo',
  'seed',
  'rng',
  'timer',
  'bot',
  'finish',
  'restart',
  'events',
  'as',
] as const;
function fail(message: string, at: number, end?: number, suggestion?: string): never {
  throw new ConsoleError({ message, at, end, suggestion });
}

/** Quotes and JSON may contain spaces, equals signs and semicolons. Locations refer to the full line. */
export function parseConsoleLine(line: string): ConsoleCommand[] {
  const commands: ConsoleCommand[] = [];
  let tokens: ConsoleToken[] = [];
  let i = 0;
  const flush = () => {
    const [first, ...rest] = tokens;
    if (first) commands.push({ name: first.raw, tokens: rest, at: first.at });
    tokens = [];
  };
  while (i < line.length) {
    if (/\s/.test(line[i]!)) {
      i++;
      continue;
    }
    if (line[i] === ';') {
      flush();
      i++;
      continue;
    }
    const at = i;
    let quoted = false;
    let escaped = false;
    const stack: string[] = [];
    while (i < line.length) {
      const c = line[i]!;
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
      else if (c === '}' || c === ']') {
        if (stack.pop() !== c) fail('JSON có dấu ngoặc không khớp', at, i + 1);
      } else if (!stack.length && (/\s/.test(c) || c === ';')) break;
      i++;
    }
    if (quoted || stack.length) fail('Chưa đóng chuỗi hoặc JSON', at, i);
    const raw = line.slice(at, i);
    tokens.push({ raw, value: parseValue(raw, at), at, end: i });
  }
  flush();
  return commands;
}

export function parseValue(raw: string, at = 0): unknown {
  if (
    raw.startsWith('"') ||
    raw.startsWith('{') ||
    raw.startsWith('[') ||
    /^(true|false|null)$/.test(raw)
  ) {
    try {
      return JSON.parse(raw);
    } catch {
      return fail('Giá trị JSON không hợp lệ', at, at + raw.length);
    }
  }
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) fail('Số phải hữu hạn', at, at + raw.length);
    return n;
  }
  return raw;
}

export function resolveValue(value: unknown, catalogs: Catalogs = {}, at = 0): unknown {
  if (typeof value === 'string' && value.startsWith('@')) {
    const match = /^@([^:]+):(.+)$/.exec(value);
    const entry = match && catalogs[match[1]!]?.find((item) => item.id === match[2]);
    if (!entry)
      fail(
        `Không có mục "${value}". Gõ ${value.split(':')[0]}: rồi bấm Tab để chọn.`,
        at,
        at + value.length,
      );
    return cloneConsoleValue(entry.value);
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, catalogs, at));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveValue(v, catalogs, at)]),
    );
  return value;
}

/** Positional arguments follow z.object key order; named arguments can be mixed with them. */
export function consoleArgs(
  schema: z.ZodType,
  tokens: ConsoleToken[],
  catalogs: Catalogs = {},
  name = '',
): unknown {
  if (!(schema instanceof z.ZodObject))
    fail(`${name}: tham số phải là một object`, tokens[0]?.at ?? 0);
  const keys = Object.keys(schema.shape);
  const args: Record<string, unknown> = {};
  const positions: Record<string, ConsoleToken> = {};
  for (const token of tokens) {
    const named = /^([a-zA-Z][\w-]*)=(.*)$/s.exec(token.raw);
    const key = named ? named[1]! : keys.find((k) => !Object.hasOwn(args, k));
    if (!key || !keys.includes(key))
      fail(`${name}: tham số không có trong cách dùng`, token.at, token.end);
    if (Object.hasOwn(args, key)) fail(`${name}: tham số ${key} bị lặp`, token.at, token.end);
    args[key] = resolveValue(
      named ? parseValue(named[2]!, token.at + key.length + 1) : token.value,
      catalogs,
      token.at,
    );
    positions[key] = token;
  }
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const key = String(issue.path[0] ?? '');
    const token = positions[key];
    const field = schema.shape[key];
    const info: Record<string, unknown> = field
      ? z.toJSONSchema(field, { unrepresentable: 'any' })
      : {};
    const range =
      typeof info.minimum === 'number' && typeof info.maximum === 'number'
        ? `từ ${info.minimum} tới ${info.maximum}`
        : 'đúng kiểu và giới hạn trong cách dùng';
    fail(
      `${name}: ${key || 'tham số'} phải ${range} (bạn nhập ${JSON.stringify(args[key]) ?? 'thiếu'})`,
      token?.at ?? tokens.at(-1)?.end ?? 0,
      token?.end,
    );
  }
  return parsed.data;
}

const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
export function statePath(path: string): string[] {
  const parts = path.split('.');
  if (parts.some((p) => !p || unsafe.has(p))) fail('Đường dẫn state không hợp lệ', 0, path.length);
  return parts;
}
export function getStatePath(state: unknown, path?: string): unknown {
  if (!path) return state;
  let value = state;
  for (const key of statePath(path)) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key))
      fail(`Không có đường dẫn "${path}"`, 0, path.length);
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
export function setStatePath(state: unknown, path: string, value: unknown): unknown {
  const copy = cloneConsoleValue(state);
  const parts = statePath(path);
  const key = parts.pop()!;
  const parent = parts.length ? getStatePath(copy, parts.join('.')) : copy;
  if (!parent || typeof parent !== 'object')
    fail(`Không thể sửa đường dẫn "${path}"`, 0, path.length);
  if (Array.isArray(parent) && (!/^\d+$/.test(key) || Number(key) >= parent.length))
    fail('Chỉ số mảng ngoài giới hạn', 0, path.length);
  Object.defineProperty(parent, key, {
    value: cloneConsoleValue(value),
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return copy;
}

/** Clone JSON-like game data without depending on Node or DOM globals. */
export function cloneConsoleValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => cloneConsoleValue(v)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, cloneConsoleValue(v)]),
    ) as T;
  return value;
}

/** Dev-only metadata sent by the server; values stay in the game, labels travel to suggestions. */
export interface DevConsoleSchema {
  commands: DevCommandInfo[];
  catalogs: Record<string, string[]>;
  catalogLabels?: Record<string, Record<string, string>>;
  statePaths?: string[];
  snapshots?: string[];
}
