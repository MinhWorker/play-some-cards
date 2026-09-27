// Headless browser tests of the real app, one scenario per file in scripts/e2e/scenarios/.
// Scenarios are independent (own browser, own accounts, own room names), so they run side by
// side here and on separate machines in CI. Screenshots go to .e2e/<scenario>/.
// Needs `npm run dev` running (the owner usually has it open). Never opens a visible window.
//
//   npm run e2e [webUrl]                 every scenario, default http://localhost:5033
//   npm run e2e -- --only tien-len       some scenarios (comma separated)
//   npm run e2e -- --changed origin/main only the scenarios the changes since that ref touch
//   npm run e2e -- --list [...]          print the picked scenario names as JSON, run nothing
//   --jobs N     scenarios at once (default: half the CPUs)
//   --retries N  run a failed scenario again, up to N times (CI: 1); a pass on retry warns
//   --timeout S  a try that takes longer fails (default 600)
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    only: { type: 'string' },
    changed: { type: 'string' },
    list: { type: 'boolean', default: false },
    jobs: { type: 'string' },
    retries: { type: 'string', default: '0' },
    timeout: { type: 'string', default: '600' },
  },
});
const url = positionals[0] ?? 'http://localhost:5033';
const out = '.e2e';
const dir = join(import.meta.dirname, 'e2e', 'scenarios');

const scenarios = await Promise.all(
  readdirSync(dir)
    .filter((f) => f.endsWith('.mjs'))
    .sort()
    .map(async (file) => {
      const mod = await import(join(dir, file));
      return {
        name: file.replace(/\.mjs$/, ''),
        run: mod.default,
        games: mod.games ?? [],
        always: mod.always ?? false,
      };
    }),
);

// Changes that can't affect what a browser sees: docs, game art originals, repo chores.
const INERT = [
  /\.md$/,
  /^docs\//,
  /^LICENSE/,
  /^games\/[^/]+\/sources\//,
  /^\.github\/(?!workflows\/ci\.yml)/,
  /^\.vscode\//,
  /^\.claude\//,
  /^(release-please-config|\.release-please-manifest)\.json$/,
];

/**
 * Scenarios the files changed since `ref` touch: a game's own files run the scenarios that
 * play it (plus the `always` ones); a scenario's own file runs just it; inert files run none;
 * anything else (app, server, SDK, shared, e2e helpers, dependencies…) runs them all.
 */
function affected(ref) {
  const files = execFileSync('git', ['diff', '--name-only', `${ref}...HEAD`], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const picked = new Set();
  for (const file of files) {
    if (INERT.some((re) => re.test(file))) continue;
    const own = file.match(/^scripts\/e2e\/scenarios\/([^/]+)\.mjs$/)?.[1];
    if (own) {
      picked.add(own);
      continue;
    }
    const game = file.match(/^games\/([^/]+)\//)?.[1];
    if (!game) return scenarios;
    for (const s of scenarios) if (s.always || s.games.includes(game)) picked.add(s.name);
  }
  return scenarios.filter((s) => picked.has(s.name));
}

let picked = args.changed ? affected(args.changed) : scenarios;
if (args.only) {
  const only = args.only.split(',');
  const unknown = only.filter((n) => !scenarios.some((s) => s.name === n));
  if (unknown.length) {
    console.error(`No such scenario: ${unknown.join(', ')}`);
    process.exit(1);
  }
  picked = picked.filter((s) => only.includes(s.name));
}
if (args.list) {
  console.log(JSON.stringify(picked.map((s) => s.name)));
  process.exit(0);
}
if (!picked.length) {
  console.log('No e2e scenario is affected by these changes.');
  process.exit(0);
}

// Loaded only to run: `--list` works before `npm ci` (CI's planning job).
const { chromium } = await import('playwright');
let tries = 0;

/** One try of one scenario in its own browser. Throws on failure or any page error. */
async function attempt(scenario) {
  const shots = join(out, scenario.name);
  rmSync(shots, { recursive: true, force: true });
  mkdirSync(shots, { recursive: true });
  // Unique per try so accounts never clash with other scenarios, earlier runs or retries.
  const tag = `${Date.now().toString(36)}${tries++}`;
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${args.timeout} s`)),
      Number(args.timeout) * 1000,
    );
  });
  try {
    const run = scenario.run({
      url,
      /** A fresh browser context (a new "device") with one page, its errors watched. */
      page: async (viewport) => {
        const page = await (await browser.newContext({ viewport })).newPage();
        page.on('pageerror', (e) =>
          errors.push(e.stack?.split('\n').slice(0, 4).join('\n') ?? e.message),
        );
        return page;
      },
      username: (name) => `${name}${tag}`,
      shot: (file) => join(shots, file),
    });
    run.catch(() => {}); // after a timeout it fails once the browser closes
    await Promise.race([run, timeout]);
    if (errors.length) throw new Error('The page threw');
  } catch (err) {
    // A page error is often why a step then failed: report them together.
    if (errors.length) err.message += `\nPage errors:\n${errors.join('\n')}`;
    throw err;
  } finally {
    clearTimeout(timer);
    await browser.close();
  }
}

const describe = (err) =>
  [
    err.message,
    err.stack
      ?.split('\n')
      .filter((l) => l.includes('scripts/e2e'))
      .map((l) => l.trim())
      .join(' ← '),
  ]
    .filter(Boolean)
    .join(' ');

async function runScenario(scenario) {
  const start = Date.now();
  const failures = [];
  const retries = Number(args.retries);
  for (let i = 0; i <= retries; i++) {
    try {
      await attempt(scenario);
      break;
    } catch (err) {
      failures.push(describe(err));
      console.error(`✗ ${scenario.name} (try ${i + 1}): ${failures.at(-1)}`);
    }
  }
  const ok = failures.length <= retries;
  const seconds = Math.round((Date.now() - start) / 1000);
  if (ok && failures.length && process.env.GITHUB_ACTIONS)
    console.log(`::warning title=Flaky e2e: ${scenario.name}::Passed on retry. ${failures[0]}`);
  console.log(`${ok ? '✓' : '✗'} ${scenario.name} ${seconds}s`);
  return { name: scenario.name, ok, seconds, tries: failures.length + (ok ? 1 : 0) };
}

const jobs = Number(args.jobs ?? Math.max(1, Math.floor(availableParallelism() / 2)));
const queue = [...picked];
const results = [];
await Promise.all(
  Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) results.push(await runScenario(s));
  }),
);

const table = [
  '| Scenario | Result | Time | Tries |',
  '| --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.name} | ${r.ok ? '✓' : '✗'} | ${r.seconds}s | ${r.tries} |`),
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
const failed = results.filter((r) => !r.ok).map((r) => r.name);
if (failed.length) {
  console.error(`E2E FAILED: ${failed.join(', ')}. Screenshots in ${out}/`);
  process.exitCode = 1;
} else console.log(`OK: ${results.map((r) => r.name).join(', ')}. Screenshots in ${out}/`);
