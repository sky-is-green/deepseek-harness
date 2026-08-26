/**
 * Snapshot builder for the `prompt-inspector` view target: an append-ordered
 * ledger of header and context contributions, with each header row's diff
 * flags derived from its predecessor at snapshot time so replay stays a pure
 * function of log order.
 * @module client/inspector-builder
 */

import type {
  ConversationPromptSnapshot, ConversationViewBuilder, ConversationViewDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  InspectorConversationViewNode, InspectorHeaderRow, PromptInspectorSnapshot,
} from './contract.ts'

/** Stable empty target used until a Session has assembled inspector rows. */
export const EMPTY_PROMPT_INSPECTOR_SNAPSHOT: PromptInspectorSnapshot = {
  headers: [],
  contexts: [],
}

function toolsEqual(
  left: ConversationPromptSnapshot['tools'],
  right: ConversationPromptSnapshot['tools'],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function withDiffFlags(
  row: InspectorHeaderRow,
  previous: ConversationPromptSnapshot | undefined,
): InspectorHeaderRow {
  if (previous === undefined) return { ...row, initial: true }
  return {
    ...row,
    initial: false,
    systemChanged: previous.system !== row.prompt.system,
    toolsChanged: !toolsEqual(previous.tools, row.prompt.tools),
  }
}

/** Append-ordered ledger retaining the latest inspector snapshot. */
export class PromptInspectorBuilder
implements ConversationViewBuilder<InspectorConversationViewNode, PromptInspectorSnapshot> {
  private readonly nodes = new Map<string, InspectorConversationViewNode>()
  private readonly positions = new Map<string, number>()
  private contributions: InspectorConversationViewNode[] = []
  readonly empty = EMPTY_PROMPT_INSPECTOR_SNAPSHOT

  replace(input: { readonly nodes: readonly InspectorConversationViewNode[] }): PromptInspectorSnapshot {
    this.nodes.clear()
    for (const node of input.nodes) this.nodes.set(node.key, node)
    this.rebuildContributions()
    return this.snapshot()
  }

  apply(input: { readonly upserts: readonly InspectorConversationViewNode[] }): PromptInspectorSnapshot {
    let structural = false
    for (const node of input.upserts) {
      const previous = this.nodes.get(node.key)
      this.nodes.set(node.key, node)
      if (previous === undefined || previous.anchorSeq !== node.anchorSeq) {
        structural = true
        continue
      }
      const position = this.positions.get(node.key)
      if (position === undefined) structural = true
      else this.contributions[position] = node
    }
    if (structural) this.rebuildContributions()
    return this.snapshot()
  }

  private snapshot(): PromptInspectorSnapshot {
    const ordered = [...this.contributions].sort((left, right) =>
      left.anchorSeq - right.anchorSeq || left.key.localeCompare(right.key))
    const headers: InspectorHeaderRow[] = []
    const contexts: PromptInspectorSnapshot['contexts'][number][] = []
    let previousPrompt: ConversationPromptSnapshot | undefined
    for (const contribution of ordered) {
      if (contribution.data.kind === 'header') {
        const row = withDiffFlags(contribution.data.header, previousPrompt)
        headers.push(row)
        previousPrompt = row.prompt
        continue
      }
      contexts.push(contribution.data.context)
    }
    return { headers, contexts }
  }

  private rebuildContributions(): void {
    this.contributions = [...this.nodes.values()]
      .sort((left, right) => left.anchorSeq - right.anchorSeq || left.key.localeCompare(right.key))
    this.positions.clear()
    for (const [index, contribution] of this.contributions.entries()) {
      this.positions.set(contribution.key, index)
    }
  }
}

/** Inspector target factory producing the assembled-request snapshot. */
export const promptInspectorViewDefinition:
ConversationViewDefinition<InspectorConversationViewNode, PromptInspectorSnapshot> = {
  target: 'prompt-inspector',
  create: () => new PromptInspectorBuilder(),
}
