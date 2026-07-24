import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroupDisclosure } from './GroupDisclosure'

describe('Layers Group disclosure', () => {
  afterEach(() => {
    cleanup()
  })

  it('exposes expansion state and toggles UI-local presentation only', () => {
    const onToggle = vi.fn()
    const { rerender } = render(
      <GroupDisclosure groupId="group-1" isExpanded onToggle={onToggle} />
    )
    const button = screen.getByTestId(
      'layers-group-toggle-group-1'
    ) as HTMLButtonElement

    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('aria-label')).toBe('Collapse Group')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledWith('group-1')

    rerender(
      <GroupDisclosure
        groupId="group-1"
        isExpanded={false}
        onToggle={onToggle}
      />
    )
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-label')).toBe('Expand Group')
  })
})
