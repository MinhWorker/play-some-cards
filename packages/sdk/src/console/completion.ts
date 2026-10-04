/** Pure, schema-driven completion and usage hints for the keyboard console. */
import { type DevCommandInfo, type DevConsoleSchema, parseConsoleLine } from './parser.js';
export interface ConsoleSuggestion {
  value: string;
  label: string;
  from: number;
  to: number;
}
export interface ConsoleCompletion {
  usage: string;
  parameter?: string;
  suggestions: ConsoleSuggestion[];
}
export type ParameterInfo = Record<string, unknown>;
export function parameterHint(info: ParameterInfo): string {
  if (typeof info.catalog === 'string') return `@${info.catalog}:id`;
  if (Array.isArray(info.enum)) return info.enum.join('|');
  if (typeof info.minimum === 'number' && typeof info.maximum === 'number')
    return `${info.minimum}–${info.maximum}`;
  if (info.type === 'boolean') return 'true|false';
  if (info.type === 'integer' || info.type === 'number') return 'số';
  if (info.type === 'object' || info.type === 'array') return 'JSON';
  return 'chữ';
}
export function commandUsage(command: DevCommandInfo): string {
  const properties = command.parameters?.properties as Record<string, ParameterInfo> | undefined;
  if (!properties) return command.usage;
  const required = command.parameters?.required as string[] | undefined;
  const fields = Object.entries(properties).map(([key, info]) =>
    required?.includes(key)
      ? `<${key}: ${parameterHint(info)}>`
      : `[${key}: ${parameterHint(info)}]`,
  );
  const name = command.kind === 'event' ? `as <ghế> ${command.name.slice(3)}` : command.name;
  return `${name} ${fields.join(' ')} · ${command.description}`;
}

/** Only the current semicolon-delimited command contributes suggestions; source spans stay global. */
export function completeConsoleLine(
  line: string,
  schema: DevConsoleSchema,
  seats: { name: string }[] = [],
): ConsoleCompletion {
  let parsed: ReturnType<typeof parseConsoleLine>;
  try {
    parsed = parseConsoleLine(line);
  } catch {
    return { usage: '', suggestions: [] };
  }
  const last = parsed.at(-1);
  const empty = !last || line.trimEnd().endsWith(';');
  const words = empty
    ? []
    : [{ raw: last.name, at: last.at, end: last.at + last.name.length }, ...last.tokens];
  const trailing = /\s$/.test(line) || empty;
  const current = trailing ? { raw: '', at: line.length, end: line.length } : words.at(-1)!;
  const prefix = current.raw;
  const index = trailing ? words.length : words.length - 1;
  const name = words[0]?.raw ?? '';
  const options: { value: string; label?: string }[] = [];
  const add = (values: string[]) => options.push(...values.map((value) => ({ value })));
  const reference = () => {
    for (const [catalog, ids] of Object.entries(schema.catalogs))
      for (const id of ids)
        options.push({ value: `@${catalog}:${id}`, label: schema.catalogLabels?.[catalog]?.[id] });
  };
  const seat = () => options.push(...seats.map((p, i) => ({ value: String(i), label: p.name })));
  let command = schema.commands.find((c) => c.name === name);
  let parameter: string | undefined;
  if (index === 0) add(schema.commands.filter((c) => c.kind !== 'event').map((c) => c.name));
  else if (name === 'as') {
    if (index === 1) seat();
    else if (index === 2)
      add(schema.commands.filter((c) => c.kind === 'event').map((c) => c.name.slice(3)));
    else command = schema.commands.find((c) => c.name === `as ${words[2]?.raw}`);
  } else if (name === 'state') {
    if (index === 1) add(['get', 'set', 'dump']);
    if (index === 2 && ['get', 'set'].includes(words[1]?.raw ?? '')) add(schema.statePaths ?? []);
    if (index === 3 && words[1]?.raw === 'set') reference();
  } else if (name === 'snapshot') {
    if (index === 1) add(['save', 'load', 'list', 'delete']);
    if (index === 2 && ['load', 'delete'].includes(words[1]?.raw ?? ''))
      add(schema.snapshots ?? []);
  } else if (name === 'timer') {
    if (index === 1) add(['info', 'fire', 'pause', 'resume']);
  } else if (name === 'bot') {
    if (index === 1) add(['pause', 'resume', 'step']);
  } else if (name === 'rng') {
    if (index === 1) add(['push', 'clear']);
  } else if (name === 'seed') {
    if (index === 1) add(['off', '42']);
  } else if (name === 'undo') {
    if (index === 1) add(['1', '2', '3']);
  } else if (name === 'finish') seat();
  else if (name === 'help') add(schema.commands.map((c) => c.name).filter((n) => !n.includes(' ')));

  if (command?.parameters && index >= (name === 'as' ? 3 : 1)) {
    const properties = command.parameters.properties as Record<string, ParameterInfo>;
    const keys = Object.keys(properties ?? {});
    const previous = words.slice(name === 'as' ? 3 : 1, index);
    const used = new Set<string>();
    for (const word of previous) {
      const match = /^([\w-]+)=/.exec(word.raw);
      const key = match?.[1] ?? keys.find((k) => !used.has(k));
      if (key) used.add(key);
    }
    const named = /^([\w-]+)=(.*)$/s.exec(prefix);
    parameter = named?.[1] ?? keys.find((key) => !used.has(key));
    const info = parameter ? properties[parameter] : undefined;
    const start = options.length;
    if (info) {
      if (typeof info.catalog === 'string') {
        for (const id of schema.catalogs[info.catalog] ?? [])
          options.push({
            value: `@${info.catalog}:${id}`,
            label: schema.catalogLabels?.[info.catalog]?.[id],
          });
      } else if (parameter === 'seat') seat();
      else if (Array.isArray(info.enum)) add(info.enum.map(String));
      else if (info.type === 'boolean') add(['true', 'false']);
      else if (
        typeof info.minimum === 'number' &&
        typeof info.maximum === 'number' &&
        info.maximum - info.minimum <= 20
      ) {
        add(
          Array.from({ length: info.maximum - info.minimum + 1 }, (_, i) =>
            String(Number(info.minimum) + i),
          ),
        );
      }
    }
    if (named) for (const item of options.slice(start)) item.value = `${named[1]}=${item.value}`;
    else if (prefix && keys.some((k) => k.startsWith(prefix)))
      add(keys.filter((k) => !used.has(k)).map((k) => `${k}=`));
  }
  if (prefix.startsWith('@') && !options.some((o) => o.value.startsWith('@'))) reference();
  return {
    usage: command ? commandUsage(command) : '',
    parameter,
    suggestions: options
      .filter((o) => o.value.startsWith(prefix))
      .map((o) => ({
        value: o.value,
        label: o.label ? `${o.value} · ${o.label}` : o.value,
        from: current.at,
        to: current.end,
      })),
  };
}
