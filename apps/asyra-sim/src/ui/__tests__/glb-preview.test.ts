// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GLB_LIMITS } from '../../engine/glb/schema'
import { GlbPreview } from '../glb-preview'

let host: HTMLDivElement, root: Root
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(() => root.render(createElement(GlbPreview)))
})
afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})
function input() {
  const field = host.querySelector<HTMLInputElement>(
    '[aria-label="Choose visual GLB"]'
  )
  if (!field) throw new Error('Missing GLB input')
  return field
}
async function choose(file: File) {
  Object.defineProperty(input(), 'files', {
    configurable: true,
    value: [file]
  })
  await act(async () => {
    input().dispatchEvent(new Event('change', { bubbles: true }))
  })
}

it('rejects an oversized file before allocating its byte buffer', async () => {
  const file = new File([], 'oversized.glb'),
    read = vi.fn(async () => new ArrayBuffer(1))
  Object.defineProperty(file, 'size', { value: GLB_LIMITS.bytes + 1 })
  file.arrayBuffer = read
  await choose(file)
  expect(read).not.toHaveBeenCalled()
  expect(host.textContent).toContain('16 MiB')
  expect(input().disabled).toBe(false)
})

it('releases the file picker immediately on cancellation and ignores late file bytes', async () => {
  let finishRead: (value: ArrayBuffer) => void = () => undefined
  const file = new File([new Uint8Array([1])], 'pending.glb')
  file.arrayBuffer = vi.fn(
    () =>
      new Promise<ArrayBuffer>((resolve) => {
        finishRead = resolve
      })
  )
  const createWorker = vi.fn()
  vi.stubGlobal('Worker', createWorker)
  await choose(file)
  expect(input().disabled).toBe(true)
  const cancel = [...host.querySelectorAll('button')].find(
    (button) => button.textContent === 'Cancel preview'
  )
  if (!cancel) throw new Error('Missing cancellation control')
  await act(() => cancel.click())
  expect(input().disabled).toBe(false)
  expect(host.textContent).toContain('Preview cancelled')
  await act(async () => finishRead(new ArrayBuffer(1)))
  expect(createWorker).not.toHaveBeenCalled()
  expect(host.querySelector('.asset-summary')).toBeNull()
})
