import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '..'

const renderAppProps = vi.hoisted(() => vi.fn())

vi.mock('../../render-app', () => ({
  default: (props: unknown) => {
    renderAppProps(props)
    return <div data-testid="render-app" />
  }
}))
vi.mock('../../toolbar', () => ({ default: () => null }))
vi.mock('../../contents', () => ({ default: () => null }))
vi.mock('../../properties', () => ({ default: () => null }))
vi.mock('../../animation', () => ({ default: () => null }))

describe('App context-menu composition', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('routes accepted Render canvas invocations into the app-local session', () => {
    render(<App />)

    expect(renderAppProps).toHaveBeenCalled()
    expect(renderAppProps.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        onContextMenuRequest: expect.any(Function)
      })
    )
  })
})
