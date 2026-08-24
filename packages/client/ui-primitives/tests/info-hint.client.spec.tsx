// @vitest-environment jsdom
/** InfoHint reveals its label through the shared tooltip on hover or focus. */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InfoHint } from '../src/InfoHint.tsx'

afterEach(cleanup)

const LABEL = 'How long one command may run.'

describe('InfoHint', () => {
  it('announces the explanation as the glyph accessible name with no permanent text', () => {
    render(<InfoHint label={LABEL} />)

    expect(screen.getByRole('img', { name: LABEL })).toBeTruthy()
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.queryByText(LABEL)).toBeNull()
  })

  it('reveals the bubble on hover after its delay', () => {
    vi.useFakeTimers()
    try {
      render(<InfoHint label={LABEL} />)
      fireEvent.mouseEnter(screen.getByRole('img', { name: LABEL }))
      expect(screen.queryByRole('tooltip')).toBeNull()

      act(() => { vi.advanceTimersByTime(200) })

      expect(screen.getByRole('tooltip').textContent).toBe(LABEL)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reveals the bubble immediately on keyboard focus', () => {
    render(<InfoHint label={LABEL} />)
    fireEvent.focus(screen.getByRole('img', { name: LABEL }))

    expect(screen.getByRole('tooltip').textContent).toBe(LABEL)
  })
})
