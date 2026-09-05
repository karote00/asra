// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  useHistoryShortcuts,
  type HistoryDirection
} from '../history-shortcuts'

let host: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function View({
  enabled,
  onHistory
}: {
  enabled: boolean
  onHistory: (direction: HistoryDirection) => void
}) {
  useHistoryShortcuts(enabled, onHistory)
  return null
}
const render = (
  onHistory: (direction: HistoryDirection) => void,
  enabled = true
) => act(() => root.render(createElement(View, { enabled, onHistory })))
function key(options: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', {
    code: 'KeyZ',
    key: 'z',
    metaKey: true,
    bubbles: true,
    cancelable: true,
    ...options
  })
}

it.each([
  [{}, 'undo'],
  [{ shiftKey: true }, 'redo'],
  [{ metaKey: false, ctrlKey: true }, 'undo'],
  [{ metaKey: false, ctrlKey: true, shiftKey: true }, 'redo']
] as const)(
  'routes %j to exactly one %s and consumes the shortcut',
  async (options, direction) => {
    const history = vi.fn()
    await render(history)
    const event = key(options)
    host.dispatchEvent(event)
    expect(history).toHaveBeenCalledExactlyOnceWith(direction)
    expect(event.defaultPrevented).toBe(true)
  }
)

it.each([
  { metaKey: false },
  { ctrlKey: true },
  { altKey: true },
  { isComposing: true },
  { code: 'KeyY' }
])('leaves unrelated or composing input %j untouched', async (options) => {
  const history = vi.fn()
  await render(history)
  const event = key(options)
  host.dispatchEvent(event)
  expect(history).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
})

it('does not replay auto-repeat or an event consumed by another UI owner', async () => {
  const history = vi.fn()
  await render(history)
  host.dispatchEvent(key())
  const repeat = key({ repeat: true })
  host.dispatchEvent(repeat)
  const handled = key()
  handled.preventDefault()
  host.dispatchEvent(handled)
  expect(history).toHaveBeenCalledExactlyOnceWith('undo')
  expect(repeat.defaultPrevented).toBe(true)
})

it('handles a document shortcut before the global input adapter prevents browser defaults', async () => {
  const preventBrowserDefault = (event: KeyboardEvent) => event.preventDefault()
  window.addEventListener('keydown', preventBrowserDefault)
  try {
    const history = vi.fn()
    await render(history)
    host.dispatchEvent(key())
    expect(history).toHaveBeenCalledExactlyOnceWith('undo')
  } finally {
    window.removeEventListener('keydown', preventBrowserDefault)
  }
})

it.each(['input', 'textarea', 'select', 'contenteditable', 'shadow-input'])(
  'preserves native editing in %s',
  async (kind) => {
    const history = vi.fn()
    await render(history)
    let target: HTMLElement
    if (kind === 'contenteditable') {
      const editable = document.createElement('div')
      editable.setAttribute('contenteditable', 'plaintext-only')
      target = document.createElement('span')
      editable.append(target)
      host.append(editable)
    } else if (kind === 'shadow-input') {
      const shadowHost = document.createElement('div')
      target = document.createElement('input')
      shadowHost.attachShadow({ mode: 'open' }).append(target)
      host.append(shadowHost)
    } else {
      target = document.createElement(kind)
      host.append(target)
    }
    const event = key({ composed: true })
    target.dispatchEvent(event)
    expect(history).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  }
)

it('retires old callbacks, ignores disabled lifetimes and binds one current handler', async () => {
  const add = vi.spyOn(document, 'addEventListener')
  const first = vi.fn(),
    next = vi.fn()
  await render(first)
  const old = add.mock.calls.find(([name]) => name === 'keydown')?.[1]
  if (typeof old !== 'function') throw new Error('Missing keyboard binding')
  await render(next)
  old.call(document, key())
  host.dispatchEvent(key())
  expect(first).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledExactlyOnceWith('undo')
  await render(next, false)
  host.dispatchEvent(key())
  expect(next).toHaveBeenCalledTimes(1)
  await render(next)
  host.dispatchEvent(key({ shiftKey: true }))
  expect(next.mock.calls).toEqual([['undo'], ['redo']])
  await act(() => root.render(null))
  host.dispatchEvent(key())
  expect(next).toHaveBeenCalledTimes(2)
})
