import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resetStoredDocument: vi.fn(() => Promise.resolve()),
  switchPrimaryTool: vi.fn()
}))

vi.mock('@asyra/design-system', () => ({
  Icon: ({ name }: { readonly name: string }) => <span>{name}</span>
}))

vi.mock('../../providers', () => ({
  usePrimaryTool: () => 'select'
}))

vi.mock('../../controllers/app', () => ({
  switchPrimaryTool: mocks.switchPrimaryTool
}))

vi.mock('../reset-stored-document', () => ({
  resetStoredDocument: mocks.resetStoredDocument
}))

import ToolButton from '../tool-button'

describe('Toolbar Reset control', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it.each(['ordinary-document', 'crdt-7076-sample'])(
    'permanently exposes Reset before the primary tools for %s',
    (fileId) => {
      window.history.replaceState({}, '', `/?fileId=${fileId}`)

      render(<ToolButton />)

      const resetButton = screen.getByTestId('reset-button')
      const separator = screen.getByTestId('reset-separator')
      const selectButton = screen.getByTestId('tool-select')
      const toolbarGroup = resetButton.parentElement

      expect(toolbarGroup?.children[0]).toBe(resetButton)
      expect(toolbarGroup?.children[1]).toBe(separator)
      expect(toolbarGroup?.children[2]).toBe(selectButton)

      fireEvent.click(resetButton)
      expect(mocks.resetStoredDocument).toHaveBeenCalledOnce()
    }
  )

  it('never routes Reset through an App controller operation', () => {
    render(<ToolButton />)

    fireEvent.click(screen.getByTestId('reset-button'))
    expect(mocks.switchPrimaryTool).not.toHaveBeenCalled()
  })
})
