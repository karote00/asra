import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  useAppContextMenuSession,
  type AppContextMenuSessionController
} from '../context-menu-session'

interface HarnessProps {
  id: string
  onController?: (controller: AppContextMenuSessionController) => void
}

const viewport = {
  left: 10,
  top: 20,
  width: 900,
  height: 700
}

const Harness = ({ id, onController }: HarnessProps) => {
  const controller = useAppContextMenuSession(() => viewport)
  const invoker = `${id}-canvas`

  onController?.(controller)

  return (
    <section aria-label={id}>
      <div data-testid={invoker} tabIndex={-1} />
      <button
        type="button"
        onClick={() => {
          const canvas = screen.getByTestId(invoker) as HTMLDivElement
          controller.open({
            clientX: 120,
            clientY: 80,
            invoker: canvas
          })
        }}
      >
        Open first {id}
      </button>
      <button
        type="button"
        onClick={() => {
          const canvas = screen.getByTestId(invoker) as HTMLDivElement
          controller.open({
            clientX: 640,
            clientY: 410,
            invoker: canvas
          })
        }}
      >
        Open replacement {id}
      </button>
      <button type="button" onClick={() => controller.dismiss('escape')}>
        Dismiss {id}
      </button>
      <output data-testid={`${id}-session`}>
        {controller.session
          ? `${controller.session.clientX},${controller.session.clientY},${controller.session.viewport.width}x${controller.session.viewport.height}`
          : 'closed'}
      </output>
    </section>
  )
}

describe('app context-menu session', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens one local session and replaces it with the latest accepted invocation', () => {
    render(<Harness id="one" />)

    expect(screen.getByTestId('one-session').textContent).toBe('closed')
    fireEvent.click(screen.getByRole('button', { name: 'Open first one' }))
    expect(screen.getByTestId('one-session').textContent).toBe('120,80,900x700')

    fireEvent.click(
      screen.getByRole('button', { name: 'Open replacement one' })
    )
    expect(screen.getByTestId('one-session').textContent).toBe(
      '640,410,900x700'
    )
  })

  it('dismisses with focus return except when Tab must continue traversal', async () => {
    let controller: AppContextMenuSessionController | undefined
    render(
      <>
        <Harness
          id="one"
          onController={(value) => {
            controller = value
          }}
        />
        <button type="button">Next focus target</button>
      </>
    )

    const canvas = screen.getByTestId('one-canvas')
    const nextTarget = screen.getByRole('button', {
      name: 'Next focus target'
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open first one' }))
    nextTarget.focus()
    controller?.dismiss('escape')
    await act(async () => Promise.resolve())
    expect(screen.getByTestId('one-session').textContent).toBe('closed')
    expect(document.activeElement).toBe(canvas)

    fireEvent.click(screen.getByRole('button', { name: 'Open first one' }))
    nextTarget.focus()
    controller?.dismiss('tab')
    await act(async () => Promise.resolve())
    expect(document.activeElement).toBe(nextTarget)
  })

  it('treats dismissal without a session as a no-op', async () => {
    let controller: AppContextMenuSessionController | undefined
    render(
      <Harness
        id="one"
        onController={(value) => {
          controller = value
        }}
      />
    )
    const canvas = screen.getByTestId('one-canvas')
    canvas.focus()

    controller?.dismiss('escape')
    await act(async () => Promise.resolve())

    expect(screen.getByTestId('one-session').textContent).toBe('closed')
    expect(document.activeElement).toBe(canvas)
  })

  it('keeps simultaneously mounted app-root sessions isolated', () => {
    render(
      <>
        <Harness id="one" />
        <Harness id="two" />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open first one' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open first two' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss one' }))

    expect(screen.getByTestId('one-session').textContent).toBe('closed')
    expect(screen.getByTestId('two-session').textContent).toBe('120,80,900x700')
  })
})
