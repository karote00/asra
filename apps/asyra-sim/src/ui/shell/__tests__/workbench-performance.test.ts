// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import type { SimRuntime } from '../../../init/bootstrap'
import { ExperimentPanel } from '../../experiments/experiment-panel'
import { type PlaybackView } from '../../experiments/playback-view'
import { Workbench } from '../workbench'

const rowRenders = vi.hoisted(() => new Map<string, number>())

vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react/jsx-dev-runtime')>()

  const observe = (props: unknown) => {
    const id = (props as { 'data-object-id'?: string })?.['data-object-id']

    if (id) rowRenders.set(id, (rowRenders.get(id) ?? 0) + 1)
  }

  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      observe(args[1])

      return actual.jsxDEV(...args)
    }
  }
})

vi.mock('../../projects/project-controls', () => ({
  ProjectControls: () => null
}))

vi.mock('../../experiments/experiment-panel', () => ({
  ExperimentPanel: vi.fn(
    (props: { onPlayback: (view: PlaybackView | null) => void }) => {
      playback = props.onPlayback

      return null
    }
  )
}))

vi.mock('../../runtime/use-project-runtime', () => ({
  useProjectRuntime: (
    _host: unknown,
    onRuntime: (runtime: SimRuntime) => void
  ) => {
    useEffect(() => onRuntime(runtime), [onRuntime])

    return { resources, lifecycle, revision }
  }
}))

let root: Root

let host: HTMLDivElement

let revision = 0

let playback: (view: PlaybackView | null) => void

let workcell = createSyntheticExample().workcell

const readers = {
  getCandidates: vi.fn(() => [{ id: 'candidate', name: 'A' }]),
  getWorkcell: vi.fn(() => structuredClone(workcell)),
  getRuns: vi.fn(() => []),
  getLoadIssues: vi.fn(() => []),
  getHistoryDepth: vi.fn(() => revision)
}

const runtime = {
  ...readers,
  getVisualAssets: vi.fn(() => new Map()),
  setFrame: vi.fn(),
  setCamera: vi.fn(),
  pick: () => null
} as unknown as SimRuntime

const lifecycle = { runtime, status: 'ready', generation: 1, error: '' }

const resources = { controller: { getState: () => lifecycle } }

const readCount = () =>
  Object.values(readers).reduce((sum, spy) => sum + spy.mock.calls.length, 0)

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))

  localStorage.clear()

  revision = 0

  workcell = createSyntheticExample().workcell

  host = document.createElement('div')

  document.body.append(host)

  root = createRoot(host)

  await act(() => root.render(createElement(Workbench)))

  const canvas = host.querySelector<HTMLDivElement>('.canvas-host')

  if (!canvas) throw new Error('Missing viewport')

  canvas.getBoundingClientRect = () => ({ width: 800, height: 600 }) as DOMRect

  vi.clearAllMocks()

  rowRenders.clear()
})

it('a committed name change renders only the changed hierarchy row', async () => {
  workcell = {
    ...workcell,
    bodies: workcell.bodies.map((body, index) =>
      index === 0 ? { ...body, name: 'Renamed base' } : body
    )
  }

  revision++

  await act(() => root.render(createElement(Workbench)))

  expect(
    host.querySelector('[data-object-id="example:base"]')?.textContent
  ).toContain('Renamed base')

  expect([...rowRenders.keys()]).toEqual(['example:base'])

  expect(rowRenders.get('example:base')).toBe(1)
})

afterEach(async () => {
  await act(() => root.unmount())

  host.remove()

  vi.unstubAllGlobals()
})

it('camera gestures do not reread canonical workbench data', async () => {
  const canvas = host.querySelector('.canvas-host')

  if (!canvas) throw new Error('Missing viewport')

  const start = performance.now()

  for (let i = 0; i < 30; i++)
    await act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: 2, deltaY: 1 }))
    })

  process.stdout.write(
    JSON.stringify({
      route: 'camera',
      samples: 30,
      reads: readCount(),
      ms: performance.now() - start
    }) + '\n'
  )

  expect(readCount()).toBe(0)

  expect(vi.mocked(runtime.getVisualAssets).mock.calls.length).toBe(0)

  expect(vi.mocked(runtime.setFrame).mock.calls.length).toBe(0)

  expect(runtime.setCamera).toHaveBeenCalledTimes(30)
})

it('playback and panel state reuse a revision-bound projection, but committed changes invalidate it', async () => {
  const start = performance.now()

  for (let i = 0; i < 30; i++)
    await act(() =>
      playback({
        workcell,
        joints: {},
        time: i / 60,
        historical: false,
        bodyIds: []
      })
    )

  const button = [...host.querySelectorAll('button')].find(
    (value) => value.getAttribute('aria-label') === 'Experiments'
  )

  if (!button) throw new Error('Missing experiment control')

  await act(() => button.click())

  process.stdout.write(
    JSON.stringify({
      route: 'playback',
      samples: 30,
      reads: readCount(),
      ms: performance.now() - start
    }) + '\n'
  )

  expect(readCount()).toBe(0)

  expect(vi.mocked(ExperimentPanel).mock.calls.length).toBeLessThanOrEqual(1)

  workcell = {
    ...workcell,
    bodies: workcell.bodies.map((body, index) =>
      index === 0 ? { ...body, name: 'Updated base' } : body
    )
  }

  revision++

  await act(() => root.render(createElement(Workbench)))

  expect(readers.getWorkcell).toHaveBeenCalledTimes(1)

  expect(
    host.querySelector('[data-object-id="example:base"]')?.textContent
  ).toContain('Updated base')
})
