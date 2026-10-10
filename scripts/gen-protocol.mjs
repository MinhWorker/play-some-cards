// npm run gen:protocol: the protocol's zod schemas (packages/shared/src/protocol.ts) → GDScript
// for the Godot client, in apps/client/addons/xomdao_sdk/generated/:
//   - one class per named schema in `types` (XomDao<Name>, <snake_name>.gd) with typed fields,
//     from_dict() and to_dict(); JSON keys stay camelCase, fields are snake_case;
//   - protocol.gd (XomDaoProtocol): the version, request and event names, enum values, and
//     parse_reply() / parse_event() that turn a reply or a pushed event into its class.
// `--check` writes nothing and fails when the files are stale (CI runs it in npm run check).
// Needs @xomdao/shared built (`npm run gen:protocol` builds it first).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as shared from '@xomdao/shared';

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'apps/client/addons/xomdao_sdk/generated');
const check = process.argv.includes('--check');
const { types, requests, authRequests, events } = shared;

const HEADER =
  '## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.';
const snake = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase();
const upper = (name) => snake(name).toUpperCase();
const className = (name) => `XomDao${name}`;
const def = (schema) => schema._zod.def;

/** Named schemas by identity, so a field pointing at one becomes its class. */
const names = new Map(Object.entries(types).map(([name, schema]) => [schema, name]));

/** Strips optional/nullable/default/pipe wrappers. */
function unwrap(schema) {
  let optional = false;
  let nullable = false;
  for (;;) {
    const d = def(schema);
    if (d.type === 'optional' || d.type === 'default') optional = true;
    else if (d.type === 'nullable') nullable = true;
    else if (d.type === 'pipe') {
      schema = d.in;
      continue;
    } else return { schema, optional, nullable };
    schema = d.innerType;
  }
}

/** How a schema maps to GDScript: its type and how to read it from JSON. */
function kind(raw) {
  const { schema, optional, nullable } = unwrap(raw);
  const name = names.get(schema);
  const d = def(schema);
  if (name && d.type === 'object') return { tag: 'class', gd: className(name), optional, nullable };
  switch (d.type) {
    case 'string':
    case 'enum':
      return { tag: 'prim', gd: 'String', zero: '""', read: 'str', optional, nullable };
    case 'boolean':
      return { tag: 'prim', gd: 'bool', zero: 'false', read: 'bool', optional, nullable };
    case 'number': {
      const int = schema.format === 'safeint' || schema.format === 'int32';
      return int
        ? { tag: 'prim', gd: 'int', zero: '0', read: 'int', optional, nullable }
        : { tag: 'prim', gd: 'float', zero: '0.0', read: 'float', optional, nullable };
    }
    case 'array': {
      const item = kind(d.element);
      const gd = item.tag === 'class' || item.tag === 'prim' ? item.gd : 'Dictionary';
      return { tag: 'array', gd: `Array[${gd}]`, item: { ...item, gd }, optional, nullable };
    }
    case 'object':
    case 'record':
      return { tag: 'dict', gd: 'Dictionary', optional, nullable };
    default:
      return { tag: 'variant', gd: 'Variant', optional, nullable };
  }
}

/** A nullable value without a class (a string or number that may be null) stays a Variant. */
function fieldKind(schema) {
  const k = kind(schema);
  if (k.tag === 'prim' && k.nullable) return { tag: 'variant', gd: 'Variant', optional: true };
  return k;
}

function classFile(name, schema) {
  const cls = className(name);
  const fields = Object.entries(def(schema).shape).map(([key, field]) => ({
    key,
    v: snake(key),
    k: fieldKind(field),
  }));
  const decl = fields.map(({ v, k }) => {
    if (k.tag === 'prim') return `var ${v}: ${k.gd} = ${k.zero}`;
    if (k.tag === 'class') return `var ${v}: ${k.gd}`;
    if (k.tag === 'array') return `var ${v}: ${k.gd} = []`;
    if (k.tag === 'dict') return `var ${v}: Dictionary = {}`;
    return `var ${v}: Variant = null`;
  });
  const from = [];
  for (const { key, v, k } of fields) {
    const at = `d.get("${key}"`;
    if (k.tag === 'prim') from.push(`o.${v} = ${k.read}(${at}, ${k.zero}))`);
    else if (k.tag === 'variant') from.push(`o.${v} = ${at})`);
    else if (k.tag === 'dict') from.push(`o.${v} = _dict(d, "${key}")`);
    else if (k.tag === 'class' && !k.optional && !k.nullable)
      from.push(`o.${v} = ${k.gd}.from_dict(_dict(d, "${key}"))`);
    else if (k.tag === 'class')
      from.push(`if ${at}) is Dictionary:`, `\to.${v} = ${k.gd}.from_dict(d["${key}"])`);
    else {
      const item = k.item;
      const add =
        item.tag === 'class'
          ? `${item.gd}.from_dict(item)`
          : item.tag === 'prim'
            ? `${item.read}(item)`
            : 'item';
      from.push(`for item: Variant in _list(d, "${key}"):`);
      if (item.tag === 'class' || item.tag === 'dict')
        from.push('\tif item is Dictionary:', `\t\to.${v}.append(${add})`);
      else from.push(`\to.${v}.append(${add})`);
    }
  }
  const to = [];
  for (const { key, v, k } of fields) {
    if (k.tag === 'class' && (k.optional || k.nullable)) {
      if (k.optional) to.push(`if ${v} != null:`, `\td["${key}"] = ${v}.to_dict()`);
      else to.push(`d["${key}"] = ${v}.to_dict() if ${v} != null else null`);
    } else if (k.tag === 'class') to.push(`d["${key}"] = ${v}.to_dict()`);
    else if (k.tag === 'array' && k.item.tag === 'class') to.push(`d["${key}"] = _dicts(${v})`);
    else if (k.optional && k.tag === 'prim')
      to.push(`if ${v} != ${k.zero}:`, `\td["${key}"] = ${v}`);
    else if (k.optional && k.tag === 'variant') to.push(`if ${v} != null:`, `\td["${key}"] = ${v}`);
    else to.push(`d["${key}"] = ${v}`);
  }
  const body = (lines) => lines.map((line) => `\t${line}`).join('\n');
  return `class_name ${cls}
extends RefCounted
${HEADER}

${decl.join('\n')}


static func from_dict(d: Dictionary) -> ${cls}:
\tvar o := ${cls}.new()
${body(from)}
\treturn o


func to_dict() -> Dictionary:
\tvar d: Dictionary = {}
${body(to)}
\treturn d


static func _dict(d: Dictionary, key: String) -> Dictionary:
\tvar value: Variant = d.get(key)
\treturn value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
\tvar value: Variant = d.get(key)
\treturn value if value is Array else []


static func _dicts(items: Array) -> Array:
\treturn items.map(func(item: Variant) -> Variant: return item.to_dict())
`;
}

function protocolFile() {
  const named = (schema) => names.get(unwrap(schema).schema);
  const consts = (map) => Object.keys(map).map((event) => `const ${upper(event)} := "${event}"`);
  const table = (title, entries) => {
    const rows = entries
      .filter(([, name]) => name)
      .map(([event, name]) => `\t"${event}": ${className(name)},`);
    return `static var ${title}: Dictionary = {\n${rows.join('\n')}\n}`;
  };
  const enums = Object.entries(types)
    .filter(([, schema]) => def(schema).type === 'enum')
    .map(([name, schema]) => {
      const values = Object.values(def(schema).entries).map((v) => `"${v}"`);
      return `const ${upper(name)}: Array[String] = [${values.join(', ')}]`;
    });
  const replies = [...Object.entries(authRequests), ...Object.entries(requests)].map(
    ([event, { res }]) => [event, named(res)],
  );
  return `class_name XomDaoProtocol
extends RefCounted
${HEADER}
## Requests (\`{ id, event, data }\` on /ws) and the events the server pushes (\`{ event, data }\`).

const VERSION := ${shared.PROTOCOL_VERSION}
const MISMATCH := "${shared.PROTOCOL_MISMATCH}"
const COIN := "${shared.COIN}"

## Requests that log a connection in.
${consts(authRequests).join('\n')}

## Requests once logged in.
${consts(requests).join('\n')}

## Events the server pushes.
${consts(events).join('\n')}

${enums.join('\n')}

${table('_replies', replies)}
${table(
  '_events',
  Object.entries(events).map(([event, schema]) => [event, named(schema)]),
)}


## A successful reply's data as its class (\`XomDaoSessionInfo\` for session:resume…), or the
## reply itself when it has none.
static func parse_reply(event: String, ack: Dictionary) -> Variant:
\tvar script: GDScript = _replies.get(event)
\treturn script.from_dict(ack) if script != null else ack


## A pushed event's data as its class (\`XomDaoRoomSnapshot\` for room:state…).
static func parse_event(event: String, data: Variant) -> Variant:
\tvar script: GDScript = _events.get(event)
\treturn script.from_dict(data) if script != null and data is Dictionary else data
`;
}

const wanted = new Map();
const files = new Map();
for (const [name, schema] of Object.entries(types)) {
  if (def(schema).type !== 'object') continue;
  const file = `${snake(name)}.gd`;
  files.set(name, file);
  wanted.set(file, classFile(name, schema));
}
wanted.set('protocol.gd', protocolFile());

const stale = [];
const existing = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.gd')) : [];
for (const [file, text] of wanted) {
  const path = join(outDir, file);
  if (existsSync(path) && readFileSync(path, 'utf8') === text) continue;
  stale.push(file);
  if (!check) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path, text);
  }
}
for (const file of existing.filter((f) => !wanted.has(f))) {
  stale.push(file);
  if (!check) {
    rmSync(join(outDir, file));
    rmSync(join(outDir, `${file}.uid`), { force: true });
  }
}
if (check && stale.length) {
  console.error(`The GDScript protocol is stale (${stale.join(', ')}). Run: npm run gen:protocol`);
  process.exit(1);
}
console.log(
  check
    ? 'GDScript protocol is up to date'
    : `GDScript protocol: ${stale.length ? `wrote ${stale.join(', ')}` : 'up to date'}`,
);
