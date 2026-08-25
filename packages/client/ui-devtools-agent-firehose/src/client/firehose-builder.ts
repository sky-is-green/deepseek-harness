/**
 * Snapshot builder for the `agent-firehose` view target: a bounded rolling
 * window of the most recent events, plus per-turn waterfall spans derived by
 * pairing boundary rows (step/start–step/end) and call/result rows inside the
 * window. Deriving spans from the same retained rows keeps the snapshot a
 * pure function of the window, so replay and paging rebuild identical output.
 * @module client/inspector-builder
 */

import type {
  ConversationViewBuilder, ConversationViewDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  AgentFirehoseSnapshot, FirehoseConversationViewNode, FirehoseEventRow,
  FirehoseSpan, FirehoseTurnWaterfall,
} from './contract.ts'
import { FIREHOSE_WINDOW } from './contract.ts'

/** Stable empty target used until a Session has assembled firehose rows. */
export const EMPTY_AGENT_FIREHOSE_SNAPSHOT: AgentFirehoseSnapshot = {
  rows: [],
  turns: [],
}

interface PendingCall {
  readonly name: string
  readonly turn: number | null
  readonly startTime: number
}

/** Rolling-window ledger retaining the latest {@link FIREHOSE_WINDOW} events. */
export class AgentFirehoseBuilder implements ConversationViewBuilder<
  FirehoseConversationViewNode,
  AgentFirehoseSnapshot
> {
  private readonly nodes = new Map<string, FirehoseConversationViewNode>()
  readonly empty = EMPTY_AGENT_FIREHOSE_SNAPSHOT

  replace(input: { readonly nodes: readonly FirehoseConversationViewNode[] }): AgentFirehoseSnapshot {
    this.nodes.clear()
    for (const node of input.nodes) this.nodes.set(node.key, node)
    return this.snapshot()
  }

  apply(input: { readonly upserts: readonly FirehoseConversationViewNode[] }): AgentFirehoseSnapshot {
    for (const node of input.upserts) this.nodes.set(node.key, node)
    return this.snapshot()
  }

  private snapshot(): AgentFirehoseSnapshot {
    const ordered = [...this.nodes.values()].sort((left, right) =>
      left.anchorSeq - right.anchorSeq || left.key.localeCompare(right.key))
    const rows = ordered.slice(-FIREHOSE_WINDOW).map(node => node.data.row)
    return { rows, turns: deriveWaterfalls(rows) }
  }
}

/** Firehose target factory producing the rolling-window snapshot. */
export const agentFirehoseViewDefinition:
ConversationViewDefinition<FirehoseConversationViewNode, AgentFirehoseSnapshot> = {
  target: 'agent-firehose',
  create: () => new AgentFirehoseBuilder(),
}

/**
 * Pair step boundaries and tool call/result rows into per-turn waterfall
 * spans. Spans whose closing row left the window render as open; calls whose
 * result is absent stay pending. Rows outside any turn group under `null`.
 */
export function deriveWaterfalls(rows: readonly FirehoseEventRow[]): FirehoseTurnWaterfall[] {
  const spansByTurn = new Map<number | null, FirehoseSpan[]>()
  const turnBounds = new Map<number | null, { start?: number; end?: number }>()
  const pendingCalls = new Map<string, PendingCall>()
  let currentStep: { turn: number | null; label: string; startTime: number } | undefined

  const pushSpan = (turn: number | null, span: FirehoseSpan): void => {
    const list = spansByTurn.get(turn) ?? []
    list.push(span)
    spansByTurn.set(turn, list)
  }
  const boundsOf = (turn: number | null): { start?: number; end?: number } => {
    const existing = turnBounds.get(turn)
    if (existing !== undefined) return existing
    const fresh: { start?: number; end?: number } = {}
    turnBounds.set(turn, fresh)
    return fresh
  }

  for (const row of rows) {
    const turn = locationTurn(row.location)
    switch (row.type) {
      case 'turn/start':
        boundsOf(turn).start ??= row.time
        break
      case 'turn/end':
        boundsOf(turn).end ??= row.time
        currentStep = undefined
        break
      case 'step/start': {
        currentStep = {
          turn,
          label: row.step === undefined ? row.summary : `T${row.step.turn}.S${row.step.step}`,
          startTime: row.time,
        }
        break
      }
      case 'step/end': {
        if (currentStep !== undefined) {
          pushSpan(turn, {
            kind: 'step',
            label: currentStep.label,
            turn,
            startTime: currentStep.startTime,
            endTime: row.time,
            failed: false,
          })
          currentStep = undefined
        }
        break
      }
      case 'tool/call':
        if (row.callId !== undefined) {
          pendingCalls.set(row.callId, {
            name: callName(row),
            turn,
            startTime: row.time,
          })
        }
        break
      case 'tool/result': {
        const pending = row.callId === undefined ? undefined : pendingCalls.get(row.callId)
        if (row.callId !== undefined) pendingCalls.delete(row.callId)
        if (pending === undefined) break
        pushSpan(pending.turn, {
          kind: 'tool',
          label: pending.name,
          turn: pending.turn,
          startTime: pending.startTime,
          endTime: row.time,
          failed: row.summary.startsWith('error') || row.summary === 'isError',
        })
        break
      }
      default:
        break
    }
  }

  const turns: FirehoseTurnWaterfall[] = [...spansByTurn.keys()].map((turn) => {
    const bounds = turnBounds.get(turn)
    const spans = [...(spansByTurn.get(turn) ?? [])]
      .sort((left, right) => left.startTime - right.startTime)
    return {
      turn,
      startTime: bounds?.start ?? null,
      endTime: bounds?.end ?? null,
      spans,
    }
  })
  turns.sort((left, right) => spanStart(left) - spanStart(right))
  return turns
}

function spanStart(waterfall: FirehoseTurnWaterfall): number {
  const first = waterfall.spans[0]
  return waterfall.startTime ?? first?.startTime ?? Number.MAX_SAFE_INTEGER
}

function locationTurn(location: FirehoseEventRow['location']): number | null {
  return location.kind === 'turn' || location.kind === 'step' ? location.turn.turn : null
}

function callName(row: FirehoseEventRow): string {
  const match = /^([^(]+)\(/.exec(row.summary)
  return match === null ? row.summary : match[1] ?? row.summary
}
