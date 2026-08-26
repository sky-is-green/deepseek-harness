/**
 * Conversation Definitions feeding the `prompt-inspector` view target: one
 * Definition per logged `request/header`, one per producer-supplied
 * `user/message`. Both are pure projections of durable events; replaying the
 * log rebuilds identical rows.
 * @module client/definitions
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'
import type {
  ConversationMatch, ConversationNodeContext, ConversationNodeDefinition,
  ConversationPromptSnapshot, ContextRole,
} from '@deepseek-ai/dsh-client-runtime/client'
import { contextForm, contextProvenance } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  InspectorConversationViewNode, InspectorContextRow, InspectorHeaderRow,
} from './contract.ts'
import { contentPreview } from './content-preview.ts'

function inspectorNode(
  context: ConversationNodeContext,
  anchorSeq: number,
  data: InspectorConversationViewNode['data'],
): InspectorConversationViewNode {
  return {
    key: context.key,
    kind: context.kind,
    id: context.id,
    target: 'prompt-inspector',
    anchorSeq,
    location: context.start?.location ?? { kind: 'unresolved' },
    data,
  }
}

function requestPrompt(match: ConversationMatch): ConversationPromptSnapshot {
  if (match.event.type !== 'request/header') {
    throw new Error('prompt-inspector request-header start requires request/header')
  }
  const header = match.event.data.header
  const tools: unknown = header.tools
  return {
    config: header.config,
    system: header.system ?? '',
    tools: Array.isArray(tools) ? tools as ConversationPromptSnapshot['tools'] : [],
  }
}

const promptInspectorRequestHeaderDefinition: ConversationNodeDefinition<InspectorHeaderRow> = {
  kind: 'prompt-inspector-request-header',
  target: 'prompt-inspector',
  match: event => event.type === 'request/header'
    ? { id: String(event.seq), role: 'start' }
    : null,
  start: (_context, match) => ({
    seq: match.event.seq,
    time: match.event.time,
    prompt: requestPrompt(match),
    initial: false,
    systemChanged: false,
    toolsChanged: false,
    location: match.location,
  }),
  update: context => context.state,
  buildViewNode: context => context.state === undefined
    ? null
    : inspectorNode(context, context.state.seq, { kind: 'header', header: context.state }),
}

/** Source kinds with their own transcript presentation; never context rows. */
const NON_CONTEXT_SOURCES = new Set(['user', 'model', 'tool'])

function contextRow(
  seq: number,
  time: number,
  source: unknown,
  content: readonly ContentBlock[],
): InspectorContextRow {
  const provenance: { role: ContextRole; label: string | null } = contextProvenance(source)
  return {
    seq,
    time,
    role: provenance.role,
    label: provenance.label,
    form: contextForm(source),
    preview: contentPreview(content),
  }
}

const promptInspectorContextSourceDefinition: ConversationNodeDefinition<InspectorContextRow> = {
  kind: 'prompt-inspector-context-source',
  target: 'prompt-inspector',
  match: (event) => {
    if (event.type !== 'user/message') return null
    const source: unknown = event.data.source
    if (typeof source !== 'object' || source === null) return null
    const kind = (source as Record<string, unknown>).kind
    if (typeof kind !== 'string' || NON_CONTEXT_SOURCES.has(kind)) return null
    return { id: String(event.seq), role: 'start' }
  },
  start: (_context, match) => {
    if (match.event.type !== 'user/message') {
      throw new Error('prompt-inspector context-source start requires user/message')
    }
    return contextRow(
      match.event.seq,
      match.event.time,
      match.event.data.source,
      match.event.data.content,
    )
  },
  update: context => context.state,
  buildViewNode: context => context.state === undefined
    ? null
    : inspectorNode(context, context.state.seq, { kind: 'context', context: context.state }),
}

/**
 * Register both inspector Definitions on the conversation event registry.
 * @param ctx - Plugin context receiving the Definitions.
 */
export function registerInspectorDefinitions(ctx: Context): void {
  ctx.conversationEvents.register(promptInspectorRequestHeaderDefinition)
  ctx.conversationEvents.register(promptInspectorContextSourceDefinition)
}
