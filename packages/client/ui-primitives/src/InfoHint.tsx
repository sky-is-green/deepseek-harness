/**
 * An information glyph that explains the control it sits beside on hover or
 * keyboard focus. The label doubles as the accessible name, so assistive
 * technology announces the explanation without a hover.
 */

import { IconQuestionOutline14 } from './icons/index.tsx'
import { Tooltip } from './Tooltip.tsx'
import type { TooltipSide } from './Tooltip.tsx'
import css from './InfoHint.module.css'

/**
 * Attach one concise explanation to the control it annotates.
 * @param props.label - the explanation shown in the bubble and announced to assistive technology.
 * @param props.side - bubble placement relative to the glyph.
 * @returns the anchored glyph plus its hover/focus bubble.
 */
export function InfoHint({ label, side = 'bottom' }: { label: string; side?: TooltipSide }) {
  return (
    <Tooltip label={label} side={side} delayMs={200}>
      <span className={css.anchor} role="img" aria-label={label} tabIndex={0}>
        <IconQuestionOutline14 />
      </span>
    </Tooltip>
  )
}
