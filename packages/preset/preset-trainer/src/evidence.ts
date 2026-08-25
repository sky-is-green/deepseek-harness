/**
 * The evidence-pass fold: mine durable session logs into per-preset reports.
 *
 * A pure function over `SessionLogSnapshot`s — exactly what
 * `ctx.sessionQuery.readSession()` returns — so the pass is read-only over
 * logs and replaying any log rebuilds identical numbers. Preset attribution,
 * call→result pairing discipline, and failure classification reuse the
 * repo's established rules (`resolveSessionPreset`, own-key callId maps,
 * `TOOL_TIMEOUT`/`isError` outcome flags).
 *
 * @module evidence
 */

import { resolveSessionPreset } from '@deepseek-ai/dsh-agent-presets'
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
// Type-only: pulls the `llm/retry` SessionEventMap merges into this program.
import type {} from '@deepseek-ai/dsh-llm-retry'
import type {
  EvidenceReport, FailureModes, PresetEvidence, ToolEvidence,
} from './types.ts'

/** The preset id reported for sessions that never declared one. */
export const NO_PRESET = '(none)'

interface PendingCall {
  readonly name: string
}

interface MutableToolEvidence extends ToolEvidence {
  byCode: Record<string, number>
}

interface MutablePresetEvidence extends Omit<PresetEvidence, 'tools' | 'unusedTools' | 'failures'> {
  tools: Record<string, MutableToolEvidence>
  catalog: Set<string>
  called: Set<string>
  failures: FailureModes & { byCode: Record<string, number> }
}

/**
 * Fold complete session snapshots into one report.
 * @param sessions - full log snapshots (header + events), any order.
 * @param generatedAt - timestamp stamped on the artifact.
 * @returns the per-preset evidence report, presets sorted by id.
 */
export function collectEvidence(
  sessions: readonly SessionLogSnapshot[],
  generatedAt: number = Date.now(),
): EvidenceReport {
  const byPreset = new Map<string, MutablePresetEvidence>()
  for (const snapshot of sessions) {
    foldSession(byPreset, snapshot)
  }
  return {
    generatedAt,
    presets: [...byPreset.values()]
      .map(finishPreset)
      .sort((left, right) => left.preset.localeCompare(right.preset)),
  }
}

function foldSession(byPreset: Map<string, MutablePresetEvidence>, snapshot: SessionLogSnapshot): void {
  // SessionLogSnapshot carries the header as `session`; the resolver reads
  // the same shape under the name `header`.
  const presetId = resolveSessionPreset({ header: snapshot.session, events: snapshot.events }) ?? NO_PRESET
  let preset = byPreset.get(presetId)
  if (preset === undefined) {
    preset = {
      preset: presetId,
      sessions: 0,
      turns: 0,
      successfulTraces: 0,
      tools: {},
      catalog: new Set<string>(),
      called: new Set<string>(),
      failures: { modelErrors: 0, retries: 0, toolTimeouts: 0, byCode: {} },
    }
    byPreset.set(presetId, preset)
  }
  preset.sessions += 1

  // Own-key pending map (session-stats discipline): settled by callId, with a
  // prototype-collision guard; leftovers are dropped at turn/end.
  const pendingCalls = new Map<string, PendingCall>()

  for (const event of snapshot.events) {
    switch (event.type) {
      case 'turn/start':
        preset.turns += 1
        break
      case 'request/header': {
        const header = event.data.header as { tools?: readonly { name: string }[] } | undefined
        for (const tool of header?.tools ?? []) preset.catalog.add(tool.name)
        break
      }
      case 'tool/call':
        if (!Object.hasOwn(pendingCalls, event.data.callId)) {
          pendingCalls.set(event.data.callId, { name: event.data.name })
        }
        break
      case 'tool/result': {
        const block = event.data.message.content[0]
        const pending = pendingCalls.get(String(block.toolCallId))
        pendingCalls.delete(String(block.toolCallId))
        if (pending === undefined) break
        const tool = toolOf(preset, pending.name)
        if (event.data.error !== undefined || block.isError === true) {
          tool.errors += 1
          const code = event.data.error?.code ?? (block.isError === true ? 'isError' : 'unknown')
          bump(tool.byCode, code)
          bump(preset.failures.byCode, code)
          if (code === 'TOOL_TIMEOUT') preset.failures.toolTimeouts += 1
        } else {
          tool.ok += 1
          preset.successfulTraces += 1
        }
        break
      }
      case 'llm/retry':
        preset.failures.retries += 1
        bump(preset.failures.byCode, event.data.failure.code)
        break
      case 'turn/end': {
        if (event.data.reason.kind === 'error') {
          preset.failures.modelErrors += 1
          bump(preset.failures.byCode, event.data.reason.error.code)
        }
        for (const pending of pendingCalls.values()) {
          toolOf(preset, pending.name).unsettled += 1
        }
        pendingCalls.clear()
        break
      }
      default:
        break
    }
  }
}

function toolOf(preset: MutablePresetEvidence, name: string): MutableToolEvidence {
  const existing = preset.tools[name]
  if (existing !== undefined) return existing
  preset.called.add(name)
  const fresh: MutableToolEvidence = { name, ok: 0, errors: 0, unsettled: 0, byCode: {} }
  preset.tools[name] = fresh
  return fresh
}

function finishPreset(preset: MutablePresetEvidence): PresetEvidence {
  const unusedTools = [...preset.catalog]
    .filter(name => !preset.called.has(name))
    .sort((left, right) => left.localeCompare(right))
  const tools: Record<string, ToolEvidence> = {}
  for (const [name, tool] of Object.entries(preset.tools).sort(([a], [b]) => a.localeCompare(b))) {
    tools[name] = { ...tool, byCode: sortRecord(tool.byCode) }
  }
  return {
    preset: preset.preset,
    sessions: preset.sessions,
    turns: preset.turns,
    successfulTraces: preset.successfulTraces,
    tools,
    unusedTools,
    failures: { ...preset.failures, byCode: sortRecord(preset.failures.byCode) },
  }
}

function bump(record: Record<string, number>, code: string): void {
  const previous = record[code] ?? 0
  record[code] = previous + 1
}

function sortRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
}
