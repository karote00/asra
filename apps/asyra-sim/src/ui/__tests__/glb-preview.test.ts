// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GLB_LIMITS } from '../../engine/glb/schema'
import { GlbPreview } from '../glb-preview'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { decodeRestrictedGlb } from '../../engine/glb/decode'
import { encodeGlb, triangleFixture } from '../../engine/glb/__tests__/fixtures'
import type { PreparedVisualImport } from '../../storage/visual-archive'
import type { SimRuntime } from '../../init/bootstrap'

let host: HTMLDivElement, root: Root
let prepared: PreparedVisualImport
const workcell = createSyntheticExample().workcell
const prepare = vi.fn(),
  retain = vi.fn(),
  discard = vi.fn(),
  onPreview = vi.fn()
const runtime = {
  features: { visuals: { prepare, retain, discard, cancel: vi.fn() } },
  getVisualAssets: vi.fn(() => new Map())
} as unknown as SimRuntime
function render(model = workcell, active = true) {
  root.render(
    createElement(GlbPreview, {
      runtime,
      candidateId: 'candidate',
      workcell: model,
      onPreview,
      isCurrent: () => true,
      active
    })
  )
}
beforeEach(async () => {
  vi.clearAllMocks()
  const { json, binary } = triangleFixture(),
    bytes = encodeGlb(json, binary),
    asset = await decodeRestrictedGlb(bytes)
  prepared = {
    asset,
    source: {
      version: 1,
      assetId: asset.source.sha256,
      filename: 'reference.glb',
      byteLength: bytes.byteLength,
      base64: ''
    }
  }
  prepare.mockResolvedValue(prepared)
  retain.mockResolvedValue(prepared.source.assetId)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(() =>
    root.render(
      createElement(GlbPreview, {
        runtime,
        candidateId: 'candidate',
        workcell,
        onPreview,
        isCurrent: () => true,
        active: true
      })
    )
  )
})
afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})
function input() {
  const field = host.querySelector<HTMLInputElement>(
    '[aria-label="Choose original part GLB"]'
  )
  if (!field) throw new Error('Missing GLB input')
  return field
}
const button = (name: string) =>
  [...host.querySelectorAll('button')].find((node) => node.textContent === name)
function smallFile() {
  const file = new File([new Uint8Array([1])], 'reference.glb')
  file.arrayBuffer = vi.fn(async () => new ArrayBuffer(1))
  return file
}

it('requires an explicit spatial preview before accepting a binding through the Feature', async () => {
  const before = structuredClone(workcell)
  await choose(smallFile())
  expect(host.textContent).toContain('Dimensions (m)')
  expect(retain).not.toHaveBeenCalled()
  expect(button('Accept original part')).toBeUndefined()
  await act(() => button('Preview placement in 3D')?.click())
  expect(onPreview).toHaveBeenLastCalledWith(
    expect.objectContaining({ prepared })
  )
  expect(workcell).toEqual(before)
  expect(button('Accept original part')).toBeDefined()
  await act(async () => button('Accept original part')?.click())
  expect(retain).toHaveBeenCalledWith(
    prepared,
    'candidate',
    workcell.bodies[0].id,
    expect.objectContaining({ scale: [1, 1, 1] })
  )
  expect(onPreview).toHaveBeenLastCalledWith(null)
  expect(host.textContent).toContain('one Undo action')
})

it('revokes a completed preview when a new invalid selection replaces it', async () => {
  await choose(smallFile())
  await act(() => button('Preview placement in 3D')?.click())
  const file = new File([], 'oversized.glb')
  Object.defineProperty(file, 'size', { value: GLB_LIMITS.bytes + 1 })
  await choose(file)
  expect(discard).toHaveBeenCalledWith(prepared)
  expect(onPreview).toHaveBeenLastCalledWith(null)
  expect(button('Accept original part')).toBeUndefined()
  expect(retain).not.toHaveBeenCalled()
})

it('requires explicit memory-warning acknowledgement for a large visual and resets it for another source', async () => {
  prepared = {
    ...prepared,
    source: { ...prepared.source, byteLength: 8 * 1024 * 1024 + 1 }
  }
  prepare.mockResolvedValue(prepared)
  await choose(smallFile())
  const acknowledge = () =>
    host.querySelector<HTMLInputElement>(
      '[aria-label="Visual memory warning acknowledgement"]'
    )
  expect(acknowledge()).not.toBeNull()
  expect(button('Preview placement in 3D')?.disabled).toBe(true)
  await act(() => acknowledge()?.click())
  expect(button('Preview placement in 3D')?.disabled).toBe(false)
  await act(() => button('Preview placement in 3D')?.click())
  expect(button('Accept original part')).toBeDefined()
  await choose(smallFile())
  expect(acknowledge()?.checked).toBe(false)
  expect(button('Preview placement in 3D')?.disabled).toBe(true)
})

it('cancels Feature preparation and discards a late receipt without publishing it', async () => {
  let finish: (value: PreparedVisualImport) => void = () => undefined
  prepare.mockImplementation(
    () =>
      new Promise<PreparedVisualImport>((resolve) => {
        finish = resolve
      })
  )
  await choose(smallFile())
  const signal = prepare.mock.calls[0][2].signal as AbortSignal
  await act(() => button('Cancel preview')?.click())
  expect(signal.aborted).toBe(true)
  await act(async () => finish(prepared))
  expect(discard).toHaveBeenCalledWith(prepared)
  expect(host.querySelector('.asset-summary')).toBeNull()
  expect(retain).not.toHaveBeenCalled()
})

it('invalidates placement after target or workcell changes and revokes it when the panel is left', async () => {
  await choose(smallFile())
  await act(() => button('Preview placement in 3D')?.click())
  const target = host.querySelector<HTMLSelectElement>(
    '[aria-label="Visual target body"]'
  )
  if (!target) throw new Error('Missing target selector')
  await act(() => {
    target.value = workcell.bodies[1].id
    target.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(button('Accept original part')).toBeUndefined()
  await act(() => button('Preview placement in 3D')?.click())
  const changed = structuredClone(workcell)
  changed.bodies[0].name = 'Changed source'
  await act(() => render(changed))
  expect(button('Accept original part')).toBeUndefined()
  expect(onPreview).toHaveBeenLastCalledWith(null)
  await act(() => button('Preview placement in 3D')?.click())
  await act(() => render(changed, false))
  expect(discard).toHaveBeenCalledWith(prepared)
  expect(host.querySelector('.asset-summary')).toBeNull()
  expect(retain).not.toHaveBeenCalled()
})
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
