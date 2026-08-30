/**
 * Docker/Rocm helpers — pure config generation for large-model tier.
 * @module @deepseek-ai/dsh-sidecar-lifecycle/docker
 */

/** Default model path inside container. */
export const CONTAINER_MODEL_PATH = '/workspace/models'

/** Default host model path on WSL ext4. */
export const HOST_MODEL_PATH = '/mnt/dsh_storage/models'

/** ROCm device mounts. */
export const ROCM_DEVICES = ['/dev/kfd:/dev/kfd', '/dev/dri:/dev/dri'] as const

/**
 * Build the docker run args for the ROCm compute backend.
 * @param hostModelPath - host path to models.
 * @param containerModelPath - container path.
 * @returns compose service spec fragment.
 */
export function buildRocmService(
  hostModelPath: string = HOST_MODEL_PATH,
  containerModelPath: string = CONTAINER_MODEL_PATH,
): Record<string, unknown> {
  return {
    image: 'custom-dsh-rocm-backend:latest',
    container_name: 'dsh-compute-backend',
    restart: 'unless-stopped',
    devices: [...ROCM_DEVICES],
    security_opt: ['seccomp:unconfined'],
    group_add: ['video', 'render'],
    volumes: [`${hostModelPath}:${containerModelPath}:ro`],
    ports: ['8000:8000'],
    environment: [
      'HSA_OVERRIDE_GFX_VERSION=11.0.0',
      'ROCM_PATH=/opt/rocm',
      `MODEL_WORKSPACE_PATH=${containerModelPath}`,
      'FLASH_ATTENTION_MODE=3',
      'CACHE_PRECISION_TYPE=fp8',
    ],
  }
}

/**
 * Health endpoint for the compute backend.
 * @param port - host port.
 * @returns URL.
 */
export function healthUrl(port: number = 8000): string {
  return `http://127.0.0.1:${port}/health`
}

/**
 * Describe a Docker/ROCm failure with actionable fix.
 * @param reason - why it failed.
 * @param detail - optional detail.
 * @returns fix copy.
 */
export function describeDockerFailure(reason: 'not-running' | 'rocm-missing' | 'port-in-use' | 'image-missing', detail?: string): string {
  const d = detail ? ` (${detail})` : ''
  switch (reason) {
    case 'not-running':
      return `Docker not running${d} — fix: start Docker Desktop and wsl -d Ubuntu -e docker ps`
    case 'rocm-missing':
      return `ROCm not available${d} — fix: check /dev/kfd, /dev/dri, group_add video/render, HSA_OVERRIDE_GFX_VERSION=11.0.0`
    case 'port-in-use':
      return `port in use${d} — fix: free 8000 or change docker-compose.yml ports`
    case 'image-missing':
      return `image missing${d} — fix: docker build -t custom-dsh-rocm-backend:latest with HIPBLAS`
    default:
      return `Docker failure${d}`
  }
}
