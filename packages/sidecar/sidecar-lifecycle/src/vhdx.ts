/**
 * VHDX bare-mount helpers — Windows host to WSL2 ext4.
 * Pure, no side effects; `bootstrap-sidecar.mjs` executes the commands.
 * @module @deepseek-ai/dsh-sidecar-lifecycle/vhdx
 */

/** Default VHDX location on the dedicated NVMe. */
export const DEFAULT_VHDX_PATH = 'E:\\dsh_storage.vhdx'

/** Default mount point inside WSL2. */
export const DEFAULT_MOUNT_POINT = '/mnt/dsh_storage'

/**
 * Build the Windows command to expose the VHDX as a bare block device.
 * @param vhdxPath - Windows path to .vhdx.
 * @returns command array for wsl --mount.
 */
export function buildVhdxBareCommand(vhdxPath: string = DEFAULT_VHDX_PATH): string[] {
  return ['wsl', '--mount', '--vhd', vhdxPath, '--bare']
}

/**
 * Build the WSL command to mount the exposed block device.
 * @param device - block device inside WSL (e.g. /dev/sdd1 or /dev/sdd).
 * @param mountPoint - where to mount.
 * @returns shell command.
 */
export function buildWslMountCommand(device: string, mountPoint: string = DEFAULT_MOUNT_POINT): string {
  return `mkdir -p ${mountPoint} && mount ${device} ${mountPoint} || (mkfs.ext4 ${device} && mount ${device} ${mountPoint})`
}

/**
 * Describe a VHDX mount failure with actionable fix.
 * @param reason - why mount failed.
 * @param detail - optional path.
 * @returns fix copy.
 */
export function describeVhdxFailure(reason: 'not-found' | 'locked' | 'no-device' | 'mount-failed', detail?: string): string {
  const d = detail ? ` (${detail})` : ''
  switch (reason) {
    case 'not-found':
      return `VHDX not found${d} — fix: create E:\\dsh_storage.vhdx or set VHDX_PATH in Mount_AI_Drive.bat`
    case 'locked':
      return `VHDX locked${d} — fix: close handles to E:\\dsh_storage.vhdx and rerun Mount_AI_Drive.bat as Admin`
    case 'no-device':
      return `no block device after bare mount${d} — fix: run wsl --shutdown then wsl --mount --vhd E:\\dsh_storage.vhdx --bare and check dmesg`
    case 'mount-failed':
      return `mount failed${d} — fix: wsl -d Ubuntu -e lsblk and mount /dev/sdX1 /mnt/dsh_storage manually`
    default:
      return `VHDX failure${d}`
  }
}
