// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import { TrajectoryImportPanel } from '../trajectory-import-panel'

let host: HTMLDivElement

let root: Root

const accepted = vi.fn()

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  accepted.mockReset()

  host = document.createElement('div')

  document.body.append(host)

  root = createRoot(host)

  const example = createSyntheticExample()

  await act(() =>
    root.render(
      createElement(TrajectoryImportPanel, {
        workcell: example.workcell,
        trajectory: example.trajectory,
        onAccept: accepted
      })
    )
  )
})

afterEach(async () => {
  await act(() => root.unmount())

  host.remove()

  vi.unstubAllGlobals()
})

const button = (name: string) =>
  [...host.querySelectorAll('button')].find((node) => node.textContent === name)

async function choose(file: File, kind = 'CSV') {
  const input = host.querySelector<HTMLInputElement>(
    `[aria-label="Load trajectory ${kind}"]`
  )

  if (!input) throw new Error('Missing trajectory input')

  Object.defineProperty(input, 'files', { configurable: true, value: [file] })

  await act(async () =>
    input.dispatchEvent(new Event('change', { bubbles: true }))
  )
}

async function preview() {
  await act(() => button('Preview trajectory')?.click())

  expect(button('Accept into draft')).toBeDefined()
}

it.each([
  ['CSV', 8 * 1024 * 1024],
  ['JSON', 1024 * 1024]
] as const)(
  'rejects oversized %s before reading and invalidates prior acceptance',
  async (kind, limit) => {
    await preview()

    const file = new File([], 'oversized')

    const read = vi.fn(async () => '')

    Object.defineProperty(file, 'size', { value: limit + 1 })

    file.text = read

    await choose(file, kind)

    expect(read).not.toHaveBeenCalled()

    expect(button('Accept into draft')).toBeUndefined()

    expect(host.textContent).toContain(`${limit / 1024 / 1024} MiB`)

    expect(accepted).not.toHaveBeenCalled()
  }
)

it('admits CSV files up to 8 MiB without auto-accepting', async () => {
  const file = new File([], 'valid.csv')

  const read = vi.fn(async () => 'time\n0')

  Object.defineProperty(file, 'size', { value: 8 * 1024 * 1024 })

  file.text = read

  await choose(file)

  expect(read).toHaveBeenCalledOnce()

  expect(host.querySelector('textarea')?.value).toBe('time\n0')

  expect(accepted).not.toHaveBeenCalled()
})

it('cannot preview stale text while reading and preserves the next selection against late bytes', async () => {
  await preview()

  let resolve: (value: string) => void = () => undefined

  const pending = new File([], 'pending.csv')

  pending.text = vi.fn(
    () =>
      new Promise<string>((done) => {
        resolve = done
      })
  )

  await choose(pending)

  expect(button('Accept into draft')).toBeUndefined()

  expect(button('Preview trajectory')?.disabled).toBe(true)

  const newer = new File([], 'newer.csv')

  newer.text = vi.fn(async () => 'time\n1')

  await choose(newer)

  await act(async () => resolve('time\n99'))

  expect(host.querySelector('textarea')?.value).toBe('time\n1')

  expect(button('Preview trajectory')?.disabled).toBe(false)
})

it('invalidates prior acceptance on read failure and exposes the failure', async () => {
  await preview()

  const file = new File([], 'unreadable.csv')

  file.text = vi.fn(async () => {
    throw new Error('File read failed')
  })

  await choose(file)

  expect(button('Accept into draft')).toBeUndefined()

  expect(host.textContent).toContain('File read failed')

  expect(button('Preview trajectory')?.disabled).toBe(false)

  expect(accepted).not.toHaveBeenCalled()
})
