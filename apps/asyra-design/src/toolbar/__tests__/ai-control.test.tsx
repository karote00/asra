import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../tool-button', () => ({
  default: () => <div data-testid="tool-controls" />
}))

vi.mock('../theme-toggle', () => ({
  default: () => <div data-testid="theme-control" />
}))

vi.mock('../zoom', () => ({
  default: () => <div data-testid="zoom-control" />
}))

import ToolBar from '..'

describe('AI Agent toolbar activation', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders no AI control when an Agent controller is absent', () => {
    render(<ToolBar />)

    expect(screen.queryByTestId('ai-agent-toolbar-button')).toBeNull()
  })

  it('exposes one labelled toggle for a composed Agent controller', () => {
    const onAiToggle = vi.fn()
    const { rerender } = render(
      <ToolBar aiOpen={false} onAiToggle={onAiToggle} />
    )

    const button = screen.getByRole('button', { name: 'Open Agent' })
    expect(screen.getByTestId('ai-agent-toolbar-button')).toBe(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(onAiToggle).toHaveBeenCalledWith(button)

    rerender(<ToolBar aiOpen onAiToggle={onAiToggle} />)
    expect(screen.getByRole('button', { name: 'Close Agent' })).toBeTruthy()
  })
})
