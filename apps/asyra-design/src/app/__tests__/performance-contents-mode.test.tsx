import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '..'

vi.mock('../../render-app', () => ({
  default: () => <div data-testid="render-app" />
}))
vi.mock('../../toolbar', () => ({ default: () => null }))
vi.mock('../../contents', () => ({
  default: () => <aside data-testid="contents-panel" />
}))
vi.mock('../../properties', () => ({ default: () => null }))
vi.mock('../../animation', () => ({ default: () => null }))
vi.mock('../group-context-menu', () => ({ GroupContextMenu: () => null }))
vi.mock('../ai-history-message-bar', () => ({
  AiHistoryMessageBar: () => null
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

describe('profiling-only Contents attribution mode', () => {
  afterEach(cleanup)

  it('keeps Contents mounted for the ordinary App and present profile', () => {
    const ordinary = render(<App />)
    expect(screen.getByTestId('contents-panel')).not.toBeNull()
    ordinary.unmount()

    render(<App performanceContentsMode="present" />)
    expect(screen.getByTestId('contents-panel')).not.toBeNull()
  })

  it('omits Contents only when the profiling entry point requests it', () => {
    render(<App performanceContentsMode="omitted" />)

    expect(screen.queryByTestId('contents-panel')).toBeNull()
    expect(screen.getByTestId('render-app')).not.toBeNull()
  })
})
