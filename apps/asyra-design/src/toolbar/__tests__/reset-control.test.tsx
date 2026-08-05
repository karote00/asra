import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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

import ToolButton from '../tool-button'

describe('Toolbar Reset control', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('does not expose the obsolete local-only Reset on the 7076 sample', () => {
    render(<ToolButton />)

    const selectButton = screen.getByTestId('tool-select')

    expect(screen.queryByTestId('reset-button')).toBeNull()
    expect(screen.queryByTestId('reset-separator')).toBeNull()
    expect(selectButton.parentElement?.children[0]).toBe(selectButton)
  })
})
