import { describe, it, expect } from 'vitest'
import { buildVhdxBareCommand, buildWslMountCommand, describeVhdxFailure, DEFAULT_VHDX_PATH, DEFAULT_MOUNT_POINT } from '../src/vhdx.ts'

describe('vhdx', () => {
  it('builds bare command', () => {
    expect(buildVhdxBareCommand('E:\\dsh_storage.vhdx')).toEqual(['wsl', '--mount', '--vhd', 'E:\\dsh_storage.vhdx', '--bare'])
    expect(buildVhdxBareCommand()).toEqual(['wsl', '--mount', '--vhd', DEFAULT_VHDX_PATH, '--bare'])
  })

  it('builds mount command', () => {
    expect(buildWslMountCommand('/dev/sdd1')).toContain('mkdir -p /mnt/dsh_storage')
    expect(buildWslMountCommand('/dev/sdd1', DEFAULT_MOUNT_POINT)).toContain('/dev/sdd1')
  })

  it('describes failures loud', () => {
    expect(describeVhdxFailure('not-found', 'E:\\dsh_storage.vhdx')).toContain('VHDX not found')
    expect(describeVhdxFailure('locked')).toContain('VHDX locked')
    expect(describeVhdxFailure('no-device')).toContain('no block device')
    expect(describeVhdxFailure('mount-failed', '/dev/sdd1')).toContain('mount failed')
  })
})
