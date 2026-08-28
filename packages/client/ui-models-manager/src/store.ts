/**
 * Read-model store for the models manager: the catalog, per-model load
 * states, and running downloads, mirrored from the `ctx.models` event stream
 * into one bare snapshot store (the registrant's hooks-compartment source).
 * The load-state grammar is enforced upstream by dsh-models; this store only
 * mirrors what events declare.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  HardwareSummary,
  ModelCatalogEntry, ModelDownloadSnapshot, ModelLoadState, LocalModelId, DownloadId,
} from '@deepseek-ai/dsh-models'

/** The manager's whole read model. */
export interface ModelsManagerState {
  /** False until the first catalog pull lands (renders the pending row). */
  loaded: boolean
  entries: readonly ModelCatalogEntry[]
  states: Record<string, ModelLoadState>
  downloads: ModelDownloadSnapshot[]
  /** Probed host hardware; `null` before the first `hardware()` call resolves. */
  hardware: HardwareSummary | null
}

/** The store's complete mutation API (actions the apply closure calls). */
export interface ModelsManagerActions {
  replaceCatalog(entries: readonly ModelCatalogEntry[], states: Readonly<Record<string, ModelLoadState>>): void
  setLoadState(modelId: LocalModelId, state: ModelLoadState): void
  setDownloads(downloads: readonly ModelDownloadSnapshot[]): void
  upsertDownload(download: ModelDownloadSnapshot): void
  updateProgress(downloadId: DownloadId, bytesReceived: number, bytesTotal: number | null): void
  settleDownload(downloadId: DownloadId): void
  setHardware(hardware: HardwareSummary | null): void
}

/** Observable snapshot handle backing the models-manager section. */
export type ModelsManagerStore = ObservableSnapshot<ModelsManagerState>

/**
 * Create the bare observable store instance.
 * @returns the store face: getSnapshot/subscribe plus the mutation actions.
 */
export function createModelsManagerStore(): ModelsManagerStore & ModelsManagerActions {
  const store = createSnapshotStore<ModelsManagerState>({
    loaded: false,
    entries: [],
    states: {},
    downloads: [],
    hardware: null,
  })
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: fn => store.subscribe(fn),
    replaceCatalog(entries, states) {
      store.update((draft) => { draft.loaded = true; draft.entries = entries; draft.states = states })
    },
    setLoadState(modelId, state) {
      store.update((draft) => { draft.states[modelId] = state })
    },
    setDownloads(downloads) {
      store.update((draft) => { draft.downloads = [...downloads] })
    },
    upsertDownload(download) {
      store.update((draft) => {
        draft.downloads = draft.downloads.some(row => row.id === download.id)
          ? draft.downloads.map(row => (row.id === download.id ? download : row))
          : [...draft.downloads, download]
      })
    },
    updateProgress(downloadId: DownloadId, bytesReceived: number, bytesTotal: number | null) {
      store.update((draft) => {
        if (!draft.downloads.some(row => row.id === downloadId)) return
        draft.downloads = draft.downloads.map(row =>
          (row.id === downloadId ? { ...row, bytesReceived, bytesTotal } : row))
      })
    },
    settleDownload(downloadId) {
      store.update((draft) => {
        draft.downloads = draft.downloads.filter(row => row.id !== downloadId)
      })
    },
    setHardware(hardware) {
      store.update((draft) => { draft.hardware = hardware })
    },
  }
}
