/** Optional game commands/catalogs: metadata and registry validation, without Node dependencies. */
import { z } from 'zod';
import { type Catalogs, ENGINE_COMMANDS } from './parser.js';

/** Default catalog values are numbers; pass a schema for a catalog of another type. */
export function catalog(name: string): z.ZodNumber;
export function catalog<T extends z.ZodType>(name: string, schema: T): T;
export function catalog(name: string, schema: z.ZodType = z.number()): z.ZodType {
  return schema.meta({ catalog: name });
}
export const commandHookName = (name: string) =>
  `cmd${name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())}`;

/** Shared by gameRules and registry tests, so invalid optional declarations fail at startup. */
export function validateConsoleDefinitions(
  commands: Record<string, z.ZodObject>,
  catalogs: Catalogs,
  events: Record<string, z.ZodType> = {},
) {
  for (const [name, schema] of Object.entries(commands)) {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name))
      throw new Error(`Command "${name}" must be kebab-case`);
    if ((ENGINE_COMMANDS as readonly string[]).includes(name))
      throw new Error(`Command "${name}" is reserved by the engine`);
    if (!(schema instanceof z.ZodObject)) throw new Error(`Command "${name}" must be z.object`);
  }
  for (const [name, entries] of Object.entries(catalogs)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
      throw new Error(`Catalog "${name}" must be kebab-case`);
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id))
        throw new Error(`Catalog "${name}" id "${entry.id}" must be kebab-case`);
      if (seen.has(entry.id)) throw new Error(`Catalog "${name}" has duplicate id "${entry.id}"`);
      if (typeof entry.label !== 'string' || !entry.label)
        throw new Error(`Catalog "${name}" id "${entry.id}" needs a label`);
      seen.add(entry.id);
    }
  }
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const annotation = (value as { catalog?: unknown }).catalog;
    if (typeof annotation === 'string' && !Object.hasOwn(catalogs, annotation))
      throw new Error(`Unknown catalog "${annotation}"`);
    for (const child of Object.values(value)) visit(child);
  };
  for (const schema of [...Object.values(events), ...Object.values(commands)])
    visit(z.toJSONSchema(schema, { unrepresentable: 'any' }));
}
