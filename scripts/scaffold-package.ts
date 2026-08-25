/**
 * Plugin scaffolder (X12): emits the cookbook package skeleton for a new
 * `@deepseek-ai/dsh-<name>` host package into `packages/<group>/<pkg>/`,
 * then prints the manual registration steps that cannot be generated safely
 * (aggregate references, base-paths entries for uncovered groups).
 *
 * Usage:
 *   pnpm scaffold -- --group tools --name my-tool [--kind plugin|service] [--config]
 *
 * @module scaffold-package
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const ROOT = resolve(import.meta.dirname, '..')

interface ScaffoldOptions {
  group: string
  name: string
  kind: 'plugin' | 'service'
  withConfig: boolean
}

function fail(message: string): never {
  console.error(`scaffold-package: ${message}`)
  process.exit(1)
}

function parseOptions(): ScaffoldOptions {
  const argv = process.argv.slice(2)
  if (argv[0] === '--') argv.shift()
  const { values } = parseArgs({
    args: argv,
    options: {
      group: { type: 'string' },
      name: { type: 'string' },
      kind: { type: 'string', default: 'plugin' },
      config: { type: 'boolean', default: false },
    },
  })
  const group = values.group ?? ''
  const name = values.name ?? ''
  if (!/^[a-z][a-z0-9-]*$/.test(group)) fail('--group must be kebab-case (e.g. tools)')
  if (!/^[a-z][a-z0-9-]*$/.test(name)) fail('--name must be kebab-case (e.g. my-tool)')
  if (values.kind !== 'plugin' && values.kind !== 'service') {
    fail("--kind must be 'plugin' or 'service'")
  }
  return { group, name, kind: values.kind, withConfig: values.config }
}

function rootVersion(): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version?: string }
  return pkg.version ?? '0.0.0'
}

function packageJson(options: ScaffoldOptions, version: string): string {
  const npmName = `@deepseek-ai/dsh-${options.name}`
  const peerDependencies: Record<string, string> = {
    '@deepseek-ai/dsh-invariants': 'workspace:^',
    '@deepseek-ai/cordis': 'workspace:^',
  }
  const dependencies: Record<string, string> = {}
  if (options.withConfig) {
    // Schemastery is a runtime validator, so Config-using packages keep it in
    // dependencies (mirroring agent-loop) and declare the peer edge.
    peerDependencies['@deepseek-ai/schemastery'] = 'workspace:^'
    dependencies['@deepseek-ai/schemastery'] = 'workspace:^'
  }
  const devDependencies: Record<string, string> = {
    '@deepseek-ai/dsh-invariants': 'workspace:^',
    '@deepseek-ai/cordis': 'workspace:^',
  }
  const manifest = {
    name: npmName,
    description: `TODO: one-line responsibility for ${npmName}`,
    version,
    publishConfig: { access: 'public' },
    repository: {
      type: 'git',
      url: 'git+https://github.com/deepseek-ai/deepseek-harness.git',
      directory: `packages/${options.group}/${options.name}`,
    },
    type: 'module',
    main: 'lib/index.js',
    types: 'lib/types/index.d.ts',
    exports: {
      '.': {
        types: './lib/types/index.d.ts',
        default: './lib/index.js',
      },
      './invariant': {
        types: './lib/types/invariant.d.ts',
        default: './lib/invariant.js',
      },
    },
    license: 'MIT',
    ...(Object.keys(dependencies).length > 0 ? { dependencies } : {}),
    peerDependencies,
    devDependencies,
    files: [
      'lib/index.js',
      'lib/invariant.js',
      'lib/types/**/*.d.ts',
    ],
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function tsconfig(options: ScaffoldOptions): string {
  return JSON.stringify({
    extends: '../../../tsconfig.base.json',
    compilerOptions: {
      rootDir: 'src',
      outDir: 'lib/types',
    },
    include: ['src'],
    references: [
      { path: '../../../vendor/cosmokit' },
      { path: '../../../vendor/cordis' },
      ...(options.withConfig ? [{ path: '../../../vendor/schemastery' }] : []),
      { path: '../../runtime-diagnostics/invariants' },
    ],
  }, null, 2) + '\n'
}

function indexTs(options: ScaffoldOptions): string {
  if (options.kind === 'service') {
    return `/**\n * TODO: one-line service contract.\n *\n * @module @deepseek-ai/dsh-${options.name}\n */\n\nimport { Service } from '@deepseek-ai/cordis'\n\ndeclare module '@deepseek-ai/cordis' {\n  interface Context {\n    ${camel(options.name)}: ${pascal(options.name)}\n  }\n}\n\n/** TODO: role-named service per docs/cookbook/adding-a-package.md section 3. */\nexport class ${pascal(options.name)} extends Service {\n  constructor(ctx: import('@deepseek-ai/cordis').Context) {\n    super(ctx, '${camel(options.name)}')\n  }\n}\n\nexport default ${pascal(options.name)}\n`
  }
  return `/**\n * TODO: one-line plugin contract.\n *\n * @module @deepseek-ai/dsh-${options.name}\n */\n\nimport type { Context } from '@deepseek-ai/cordis'\n\nexport const name = '${options.name}'\n\nexport const inject: string[] = []\n\nexport function apply(ctx: Context): void {\n  ctx.effect(() => () => {}, '${options.name}: no effects yet')\n}\n`
}

function invariantTs(name: string): string {
  return `/** Package-owned invariant companion. @module @deepseek-ai/dsh-${name}/invariant */\n\n/* jscpd:ignore-start */\nimport type { Context } from '@deepseek-ai/cordis'\nimport type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'\n\nconst PACKAGE_NAME = '@deepseek-ai/dsh-${name}'\n\nexport const name = 'dsh-${name}-invariant'\nexport const inject = ['invariants']\n\n/** No runtime invariant yet: replace this reason with a real relation before shipping behavior. */\nconst install: InvariantInstaller = () => {}\n\nexport const apply = (ctx: Context): Promise<() => void> =>\n  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))\n/* jscpd:ignore-end */\n`
}

function readme(name: string): string {
  return `# @deepseek-ai/dsh-${name}\n\nTODO: one-line responsibility.\n\n## Configuration\n\nNone.\n\n## Extension points\n\nTODO.\n\n## Model Experience\n\n- **Token cost:** TODO.\n- **KV-cache effect:** none.\n\n## Known Limitations and Deferred Work\n\n- TODO.\n`
}

function camel(name: string): string {
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function pascal(name: string): string {
  const camelCase = camel(name)
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1)
}

function main(): void {
  const options = parseOptions()
  const dir = join(ROOT, 'packages', options.group, options.name)
  if (existsSync(dir)) fail(`${dir} already exists`)
  const version = rootVersion()
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), packageJson(options, version))
  writeFileSync(join(dir, 'tsconfig.json'), tsconfig(options))
  writeFileSync(join(dir, 'src', 'index.ts'), indexTs(options))
  writeFileSync(join(dir, 'src', 'invariant.ts'), invariantTs(options.name))
  writeFileSync(join(dir, 'README.md'), readme(options.name))
  console.error(`scaffold-package: created packages/${options.group}/${options.name}`)
  console.error(`
Next steps (see docs/cookbook/adding-a-package.md):
  1. pnpm install
  2. Add { "path": "./packages/${options.group}/${options.name}" } to exactly one aggregate:
     tsconfig.host.json (host) or tsconfig.client.json (client).
     If '${options.group}' is missing from the "@deepseek-ai/dsh-*" paths wildcard,
     also add explicit base-paths entries (see xray-2026-08-25-base-paths-source-mapping note).
  3. Fill the TODOs in src/index.ts, src/invariant.ts, README.md.
  4. Gates: pnpm run constraints && tsc -b packages/${options.group}/${options.name} && pnpm run lint`)
}

main()
