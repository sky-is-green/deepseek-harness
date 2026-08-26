/**
 * Configuration vocabulary for the local model provider. Types only.
 * @module
 */

/** Provider configuration; every field is deployment-specific by design. */
export interface ModelsLocalConfig {
  /** Absolute path of the llama.cpp server binary (e.g. llama-server.exe). */
  readonly serverBinary: string
  /** Directory scanned recursively(1 level) for `.gguf` weights. */
  readonly modelsDir: string
  /** First TCP port tried for spawned servers; occupied ports increment up to +9. */
  readonly basePort: number
  /** Extra argv spliced directly after the binary (wrapper scripts, extra llama-server flags). */
  extraArgs?: string[]
  /** Health-poll ceiling per load attempt in milliseconds (default 20s). */
  readonly loadTimeoutMs?: number
  /** Interval between /health polls in milliseconds (default 250ms). */
  readonly healthPollMs?: number
}
