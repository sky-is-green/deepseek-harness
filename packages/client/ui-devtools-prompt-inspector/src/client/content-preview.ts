/**
 * Bounded plain-text projection of one message's content blocks, so context
 * rows stay one line regardless of producer payload size.
 * @module client/content-preview
 */

import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'

/** Hard bound on a rendered context-row preview, in UTF-16 code units. */
export const PREVIEW_MAX_CHARS = 200

const ELLIPSIS = '…'

/**
 * Project content blocks onto one bounded plain-text line.
 *
 * Text and reasoning blocks contribute their text; tool calls contribute
 * `name(arguments)`; nested tool-result content folds recursively; any other
 * (merge-extensible) block contributes its type as a placeholder. The result
 * is truncated to {@link PREVIEW_MAX_CHARS} with an ellipsis.
 * @param blocks - the message's exact model-facing blocks.
 * @returns the single-line preview; empty when the message has no content.
 */
export function contentPreview(blocks: readonly ContentBlock[]): string {
  return truncate(blocks.map(blockText).join(''))
}

function blockText(block: ContentBlock): string {
  switch (block.type) {
    case 'text':
    case 'reasoning':
      return block.text
    case 'tool-call':
      return `${block.name}(${block.arguments})`
    case 'tool-result':
      return block.content.map(blockText).join('')
    default:
      return `[${block.type}]`
  }
}

function truncate(value: string): string {
  const trimmed = value.trim()
  return trimmed.length <= PREVIEW_MAX_CHARS
    ? trimmed
    : `${trimmed.slice(0, PREVIEW_MAX_CHARS)}${ELLIPSIS}`
}
