/**
 * Models manager plugin, browser half — one settings section mirroring the
 * `ctx.models` event stream into a local read-model store (the hooks
 * compartment source) and rendering catalog cards with load/unload actions,
 * live download progress, and a Hugging Face download form. The section
 * only appears when a models Service Provider is mounted: the inject on
 * `models` stays pending otherwise, which is the loud-absence design for a
 * seam whose provider (local llama.cpp hosting) has not landed yet.
 */
// Type-only: pulls the 'settings.section' SlotMap declaration (the key's
// owner) and the locale plugin's Context merge into this program.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ModelsRuntime } from '@deepseek-ai/dsh-models'
import { createModelsManagerStore } from '../store.ts'
import { ModelsManager } from './ModelsManager.tsx'
import { en, zh, type ModelsManagerKey } from './locales.ts'

export { createModelsManagerStore } from '../store.ts'
export type { ModelsManagerState, ModelsManagerActions } from '../store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The local-models settings section's copy. */
    'models.manager': ModelsManagerKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'models.manager'

/** Required services: slot + locale registration and the models seam. */
export const inject = ['locale', 'models', 'slots']

/**
 * Client plugin body: mount the read-model store, mirror the `ctx.models`
 * event stream into it, pull the initial catalog + downloads, and register
 * the settings section.
 *
 * Cancellation keeps its own handle map: the service face cancels through
 * the `startDownload` handle, so only downloads this client started are
 * cancellable here; rows discovered via `downloads()` render without one.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-models-manager: dictionaries')

  const store = createModelsManagerStore()
  const handles = new Map<string, { cancel(): void }>()

  ctx.inject(['models'], (scope: ClientContext) => {
    const models = scope.get('models') as ModelsRuntime
    const t = ctx.locale.bind(NS)

    const refreshCatalog = async (): Promise<void> => {
      const entries = await models.listModels()
      const states: Record<string, ReturnType<ModelsRuntime['loadState']>> = {}
      for (const entry of entries) states[entry.id] = models.loadState(entry.id)
      store.replaceCatalog(entries, states)
    }

    const refreshHardware = async (): Promise<void> => {
      try {
        const hardware = await models.hardware()
        store.setHardware(hardware)
      } catch {
        // Hardware probe absence is normal (stub providers, tests); leave `null`.
      }
    }

    const disposers = [
      ctx.on('models/catalog-updated', () => { void refreshCatalog() }),
      ctx.on('models/load-state', ({ modelId, state }) => { store.setLoadState(modelId, state) }),
      ctx.on('models/download-started', ({ download }) => { store.upsertDownload(download) }),
      ctx.on('models/download-progress', ({ downloadId, bytesReceived, bytesTotal }) => {
        store.updateProgress(downloadId, bytesReceived, bytesTotal)
      }),
      ctx.on('models/download-settled', ({ downloadId, outcome }) => {
        store.settleDownload(downloadId)
        handles.delete(downloadId)
        if (outcome.result === 'completed') void refreshCatalog()
      }),
      ctx.on('connection/reset', () => {
        void refreshCatalog()
        void refreshHardware()
      }),
    ]

    scope.effect(() => () => { for (const off of disposers) off() }, 'ui-models-manager: event mirrors')

    void refreshCatalog().then(() => { store.setDownloads(models.downloads()) })
    void refreshHardware()

    ctx.slots.inject('settings.section', () =>
      ctx.slots.register({
        name: 'settings.section',
        id: 'local-models',
        order: 11,
        label: () => t('manager.nav'),
        locale: NS,
        inject: () => ({
          hooks: { models: store },
          // Refresh failures surface through the next event or manual retry.
          load: () => {
            void refreshCatalog().catch(() => {})
            void refreshHardware().catch(() => {})
          },
          // Action failures arrive as mirrored failed-state events, not rejections.
          // Action failures must always reach the user: a rejection is
          // mirrored into the read model as a failed load-state (the same
          // shape the service's own failed event uses), so the card shows
          // badge + message even when no event arrives.
          requestLoad: (modelId) => {
            void models.requestLoad({ modelId }).catch((cause: unknown) => {
              store.setLoadState(modelId, {
                status: 'failed',
                message: cause instanceof Error ? cause.message : String(cause),
              })
            })
          },
          requestUnload: (modelId) => {
            void models.requestUnload(modelId).catch((cause: unknown) => {
              store.setLoadState(modelId, {
                status: 'failed',
                message: cause instanceof Error ? cause.message : String(cause),
              })
            })
          },
          startDownload: (repo, file, name, kind) => {
            void models.startDownload({ source: { kind: 'huggingface', repo, file }, name, kind })
              .then((handle) => {
                handles.set(handle.id, handle)
                // The service owns the authoritative snapshot; pull it back
                // instead of fabricating one from the handle.
                store.setDownloads(models.downloads())
              })
              .catch(() => { /* start failures surface through the section's next refresh */ })
          },
          cancelDownload: (downloadId) => { handles.get(downloadId)?.cancel() },
        }),
      }, ModelsManager))
  })
}
