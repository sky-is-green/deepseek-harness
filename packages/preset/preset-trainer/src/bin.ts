/**
 * Headless evidence-pass entrypoint: open a SQLite session-query store,
 * mine every session into a per-preset report, and write it as JSON.
 *
 * Run from source in this repository:
 *
 * ```
 * node --import tsx packages/preset/preset-trainer/src/bin.ts \
 *   --db <path-or-:memory:> --out evidence.json
 * ```
 *
 * @module bin
 */

import { parseArgs } from 'node:util'
import { writeFileSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import { SqliteSessionQueryEngine } from '@deepseek-ai/dsh-session-query-sqlite'
import { mineEvidence } from './mine.ts'

// `pnpm run` inserts a bare `--` between the script and its flags; drop it so
// both `pnpm run trainer:evidence -- --db x` and direct node invocations work.
const argv = process.argv.slice(2)
if (argv[0] === '--') argv.shift()

const {
  values,
} = parseArgs({
  args: argv,
  options: {
    db: { type: 'string', default: ':memory:' },
    out: { type: 'string', default: 'evidence.json' },
  },
  allowPositionals: true,
})

const ctx = new Context()
await ctx.plugin(SessionStore)
await ctx.plugin(SqliteSessionQueryEngine, { path: values.db, openAt: 'startup' })
const report = await mineEvidence(ctx)
writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`)
console.error(`preset-trainer: wrote ${values.out} (${String(report.presets.length)} preset(s))`)
