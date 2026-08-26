import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/invariant.ts'],
  platform: 'node',
  format: 'esm',
  dts: true,
  outDir: 'lib',
  external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-commands', '@deepseek-ai/dsh-jobs', '@deepseek-ai/dsh-terminal', '@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-models'],
})