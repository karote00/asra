import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resetData: vi.fn(),
  switchPrimaryTool: vi.fn()
}))

vi.mock('@asyra/design-system', () => ({
  Icon: ({ name }: { readonly name: string }) => <span>{name}</span>
}))

vi.mock('../../providers', () => ({
  usePrimaryTool: () => 'select'
}))

vi.mock('../../controllers/app', () => ({
  resetData: mocks.resetData,
  switchPrimaryTool: mocks.switchPrimaryTool
}))

import ToolButton from '../tool-button'

describe('Toolbar Reset control', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps Reset and its separator before every primary tool control', () => {
    render(<ToolButton />)

    const resetButton = screen.getByTestId('reset-button')
    const separator = screen.getByTestId('reset-separator')
    const selectButton = screen.getByTestId('tool-select')
    const toolbarGroup = resetButton.parentElement

    expect(toolbarGroup?.children[0]).toBe(resetButton)
    expect(toolbarGroup?.children[1]).toBe(separator)
    expect(toolbarGroup?.children[2]).toBe(selectButton)

    fireEvent.click(resetButton)
    expect(mocks.resetData).toHaveBeenCalledOnce()
  })
})
