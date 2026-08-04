import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fileId: 'crdt-7076-sample',
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

vi.mock('../../render-app/collaboration-mode', () => ({
  getRequiredFileId: () => mocks.fileId
}))

import ToolButton from '../tool-button'

describe('Toolbar Reset control', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    mocks.fileId = 'crdt-7076-sample'
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

  it('omits Reset and its separator outside the 7076 demo', () => {
    mocks.fileId = 'ordinary-document'

    render(<ToolButton />)

    expect(screen.queryByTestId('reset-button')).toBeNull()
    expect(screen.queryByTestId('reset-separator')).toBeNull()
    expect(screen.getByTestId('tool-select').parentElement?.children[0]).toBe(
      screen.getByTestId('tool-select')
    )
  })
})
