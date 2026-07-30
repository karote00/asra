import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import App from '..'

const toolbarProps = vi.hoisted(() => vi.fn())

vi.mock('../../render-app', () => ({
  default: () => <div data-testid="render-app" />
}))
vi.mock('../../toolbar', () => ({
  default: (props: {
    aiOpen: boolean
    onAiToggle: (invoker: HTMLButtonElement) => void
  }) => {
    toolbarProps(props)
    return (
      <button
        data-testid="agent-toggle"
        onClick={(event) => props.onAiToggle(event.currentTarget)}
        type="button"
      />
    )
  }
}))
vi.mock('../../contents', () => ({ default: () => null }))
vi.mock('../../properties', () => ({ default: () => null }))
vi.mock('../../animation', () => ({ default: () => null }))
vi.mock('../group-context-menu', () => ({ GroupContextMenu: () => null }))
vi.mock('../ai-conversation-panel', () => ({
  AiConversationPanel: () => <aside data-testid="agent-panel" />
}))
vi.mock('../ai-history-message-bar', () => ({
  AiHistoryMessageBar: () => <div data-testid="agent-history" />
}))
vi.mock('../../providers', () => ({
  useElementSelection: () => new Set(),
  useFlattenedIdsData: () => [],
  useElementDataMap: () => ({})
}))
vi.mock('../../config/group-command-descriptors', () => ({
  createGroupCommandDescriptors: () => [],
  detectGroupCommandPlatform: () => 'macos'
}))

test('renders the always-on Agent shell and opens its panel', () => {
  const ai = {
    confirmation: {},
    conversation: {
      cancel: vi.fn(),
      getSnapshot: () => ({ activeTurn: null })
    },
    history: {}
  } as never

  const { container } = render(<App ai={ai} />)

  expect(container.querySelector('[data-asyra-ai-root="true"]')).not.toBeNull()
  expect(screen.getByTestId('agent-history')).not.toBeNull()
  expect(toolbarProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      aiOpen: false,
      onAiToggle: expect.any(Function)
    })
  )

  fireEvent.click(screen.getByTestId('agent-toggle'))

  expect(screen.getByTestId('agent-panel')).not.toBeNull()
})
