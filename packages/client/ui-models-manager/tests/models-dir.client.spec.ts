import { describe, it, expect } from 'vitest'
import { FALLBACK_MODELS_DIR, lmStudioDefaultDir, pickerHint, resolveModelsDir } from '../src/client/models-dir.ts'

describe('models-dir', () => {
  it('lmStudioDefaultDir win32', () => {
    expect(lmStudioDefaultDir('win32', 'C:\\Users\\you')).toBe('C:\\Users\\you\\.lmstudio\\models')
  })
  it('lmStudioDefaultDir posix', () => {
    expect(lmStudioDefaultDir('linux', '/home/you')).toBe('/home/you/.lmstudio/models')
  })
  it('resolve prefers user pick', () => {
    expect(resolveModelsDir('D:\\models', '/home/you/.lmstudio/models')).toBe('D:\\models')
  })
  it('resolve falls back to lmStudio', () => {
    expect(resolveModelsDir(undefined, '/home/you/.lmstudio/models')).toBe('/home/you/.lmstudio/models')
  })
  it('resolve falls back to gguf', () => {
    expect(resolveModelsDir(undefined, undefined)).toBe(FALLBACK_MODELS_DIR)
  })
  it('resolve trims', () => {
    expect(resolveModelsDir('  ', '/home/you/.lmstudio/models')).toBe('/home/you/.lmstudio/models')
  })
  it('pickerHint with lmStudio', () => {
    expect(pickerHint('/home/you/.lmstudio/models')).toContain('LM Studio')
  })
  it('pickerHint without', () => {
    expect(pickerHint(undefined)).toContain(FALLBACK_MODELS_DIR)
  })
})
