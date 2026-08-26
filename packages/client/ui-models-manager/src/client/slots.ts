/**
 * The local-models settings section's injected face: a hooks-compartment
 * observable over the manager read model plus plain callbacks bound to
 * `ctx.models`. Components never see ctx.
 */
import type { LocalModelId, ModelKind } from '@deepseek-ai/dsh-models'

/** Injected business face of the settings section. */
export interface ModelsSectionInjected {
  /** Roster snapshot bound by the renderer as useModels. */
  hooks: { models: unknown }
  /** Refresh catalog + downloads from the service (initial mount and manual retry). */
  load(): void
  /**
   * Request loading one catalog model.
   * @param modelId - the card's model id.
   */
  requestLoad(modelId: LocalModelId): void
  /**
   * Request unloading one loaded model.
   * @param modelId - the card's model id.
   */
  requestUnload(modelId: LocalModelId): void
  /**
   * Start one Hugging Face GGUF download.
   * @param repo - repository id (`org/name`).
   * @param file - file name inside the repository.
   * @param name - display name for the resulting catalog entry.
   * @param kind - whether the model is an LLM or an embedding model.
   */
  startDownload(repo: string, file: string, name: string, kind: ModelKind): void
  /**
   * Cancel one running download.
   * @param downloadId - the row's download id.
   */
  cancelDownload(downloadId: string): void
}
