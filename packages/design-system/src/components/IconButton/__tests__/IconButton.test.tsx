import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IconButton } from '../IconButton.js'

describe('IconButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('owns accessible icon-only button semantics and icon presentation', () => {
    const onClick = vi.fn()

    render(
      <IconButton
        icon="ChevronRight"
        iconClassName="h-2 w-2 [&>svg]:h-2 [&>svg]:w-2"
        aria-label="Expand Group"
        data-testid="icon-button"
        onClick={onClick}
      />
    )

    const button = screen.getByTestId('icon-button') as HTMLButtonElement
    const icon = button.querySelector('svg')
    const iconContainer = icon?.parentElement

    expect(button.type).toBe('button')
    expect(button.getAttribute('aria-label')).toBe('Expand Group')
    expect(icon).not.toBeNull()
    expect(iconContainer?.classList.contains('h-2')).toBe(true)
    expect(iconContainer?.classList.contains('w-2')).toBe(true)

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
