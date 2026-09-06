// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  OBSERVATION_LIMITS,
  type FieldObservation
} from '../../../common-apis/observation-contract'
import type { PreparedObservationAttachments } from '../../../storage/observation-archive'
import { FieldObservations } from '../field-observations'
import { type ObservationAccess } from '../observation-access'

let host: HTMLDivElement

let root: Root

let notes: FieldObservation[]

const prepare = vi.fn()

const retain = vi.fn()

const discard = vi.fn()

const add = vi.fn()

const update = vi.fn()

const remove = vi.fn()

const receipt: PreparedObservationAttachments = {
  attachments: [
    {
      sourceId: `sha256:${'a'.repeat(64)}`,
      filename: 'field.txt',
      mediaType: 'text/plain',
      byteLength: 1
    }
  ]
}

const access: ObservationAccess = {
  features: {
    observations: { prepare, retain, discard, cancel: vi.fn() },
    edit: {
      addObservation: add,
      updateObservation: update,
      removeObservation: remove
    }
  },
  getObservations: () => notes,
  getObservationAttachment: vi.fn(() => new Uint8Array([97])),
  exportObservations: vi.fn(() => '{}')
}

const render = (runId = 'run-a', retained = true) =>
  root.render(
    createElement(FieldObservations, {
      key: runId,
      runtime: access,
      runId,
      retained,
      isCurrent: () => true
    })
  )

beforeEach(async () => {
  vi.clearAllMocks()

  notes = []

  prepare.mockResolvedValue(receipt)

  retain.mockResolvedValue('note')

  add.mockResolvedValue('note')

  update.mockResolvedValue(undefined)

  remove.mockResolvedValue(undefined)

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  host = document.createElement('div')

  document.body.append(host)

  root = createRoot(host)

  await act(() => render())
})

afterEach(async () => {
  await act(() => root.unmount())

  host.remove()

  vi.unstubAllGlobals()
})

const button = (name: string) => {
  const found = [...host.querySelectorAll('button')].find(
    (node) => node.textContent === name
  )

  if (!found) throw new Error(`Missing button: ${name}`)

  return found
}

async function fill(label: string, value: string) {
  const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[aria-label="${label}"]`
  )

  if (!field) throw new Error(`Missing field: ${label}`)

  const owner =
    field.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype

  await act(() => {
    Object.getOwnPropertyDescriptor(owner, 'value')?.set?.call(field, value)

    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function begin() {
  await act(() => button('Add field observation').click())

  await fill('Observation title', 'Site check')

  await fill('Observation text', 'Reported gap: 25 mm')
}

function file(name = 'field.txt', size = 1) {
  const input = new File([new Uint8Array([97])], name)

  Object.defineProperty(input, 'size', { value: size })

  input.arrayBuffer = vi.fn(async () => new Uint8Array([97]).buffer)

  return input
}

async function choose(files: File[]) {
  const field = host.querySelector<HTMLInputElement>(
    '[aria-label="Observation attachments"]'
  )

  if (!field) throw new Error('Missing file input')

  Object.defineProperty(field, 'files', { configurable: true, value: files })

  await act(async () => {
    field.dispatchEvent(new Event('change', { bubbles: true }))

    await Promise.resolve()
  })
}

it('accepts text only through the canonical Feature and makes no promise of durable saving', async () => {
  await begin()

  expect(add).not.toHaveBeenCalled()

  await act(async () => button('Save observation').click())

  expect(add).toHaveBeenCalledWith('run-a', {
    title: 'Site check',
    text: 'Reported gap: 25 mm',
    attachments: []
  })

  expect(host.textContent).toContain('save the project')

  expect(retain).not.toHaveBeenCalled()

  await act(() => render('temporary', false))

  expect(host.textContent).toContain('Retain this result first')

  expect(host.querySelector('[aria-label="Observation title"]')).toBeNull()
})

it('shows inert attachment identity for review and retains only after explicit acceptance', async () => {
  await begin()

  await choose([file()])

  expect(prepare).toHaveBeenCalledOnce()

  expect(host.textContent).toContain(receipt.attachments[0].sourceId)

  expect(host.textContent).toContain('text/plain')

  expect(retain).not.toHaveBeenCalled()

  await act(async () => button('Save observation').click())

  expect(retain).toHaveBeenCalledWith(receipt, {
    runId: 'run-a',
    draft: {
      title: 'Site check',
      text: 'Reported gap: 25 mm',
      attachments: receipt.attachments
    }
  })

  expect(add).not.toHaveBeenCalled()
})

it('keeps failed acceptance retryable and removes an existing attachment only through an explicit metadata edit', async () => {
  await begin()

  await choose([file()])

  retain.mockRejectedValueOnce(new Error('Acceptance rejected'))

  await act(async () => button('Save observation').click())

  expect(host.textContent).toContain('Acceptance rejected')

  expect(host.textContent).toContain(receipt.attachments[0].sourceId)

  await act(async () => button('Save observation').click())

  expect(retain).toHaveBeenCalledTimes(2)

  notes = [
    {
      version: 1,
      id: 'attached',
      revision: 1,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
      title: 'Site check',
      text: 'Reported gap: 25 mm',
      attachments: receipt.attachments
    }
  ]

  await act(() => render())

  await act(() => button('Edit observation').click())

  await act(() => button('Remove attachment field.txt').click())

  await act(async () => button('Save observation').click())

  expect(update).toHaveBeenCalledWith(
    'run-a',
    'attached',
    1,
    expect.objectContaining({ attachments: [] })
  )

  expect(retain).toHaveBeenCalledTimes(2)
})

it('rejects zero, oversized, unsupported or excessive files before reading and revokes previous previews', async () => {
  await begin()

  await choose([file()])

  for (const inputs of [
    [file('zero.txt', 0)],
    [file('big.pdf', OBSERVATION_LIMITS.fileBytes + 1)],
    [file('script.html')],
    Array.from({ length: 5 }, () => file())
  ]) {
    await choose(inputs)

    for (const input of inputs) expect(input.arrayBuffer).not.toHaveBeenCalled()

    expect(host.querySelector('[role="alert"]')).not.toBeNull()
  }

  expect(discard).toHaveBeenCalledWith(receipt)

  expect(prepare).toHaveBeenCalledOnce()

  expect(retain).not.toHaveBeenCalled()
})

it('discards late preparation when changing runs and ignores a file read after closing its draft', async () => {
  let finish: (value: PreparedObservationAttachments) => void = () => undefined

  prepare.mockImplementationOnce(
    () =>
      new Promise<PreparedObservationAttachments>((resolve) => {
        finish = resolve
      })
  )

  await begin()

  await choose([file()])

  const signal = prepare.mock.calls[0][1].signal as AbortSignal

  await act(() => render('run-b'))

  expect(signal.aborted).toBe(true)

  await act(async () => finish(receipt))

  expect(discard).toHaveBeenCalledWith(receipt)

  expect(host.querySelector('[aria-label="Observation title"]')).toBeNull()

  await begin()

  const input = file()

  let finishRead: (bytes: ArrayBuffer) => void = () => undefined

  input.arrayBuffer = vi.fn(
    () =>
      new Promise<ArrayBuffer>((resolve) => {
        finishRead = resolve
      })
  )

  await choose([input])

  await act(() => button('Discard draft').click())

  await act(async () => finishRead(new Uint8Array([97]).buffer))

  expect(prepare).toHaveBeenCalledOnce()

  expect(add).not.toHaveBeenCalled()

  expect(retain).not.toHaveBeenCalled()
})

it('preserves expected revisions, rejects stale drafts, renders hostile text inertly and confirms removals', async () => {
  const note: FieldObservation = {
    version: 1,
    id: 'note',
    revision: 1,
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
    title: '<script>title</script>',
    text: '<img src=x onerror=alert(1)>',
    attachments: []
  }

  notes = [note]

  await act(() => render())

  expect(host.querySelector('script,img')).toBeNull()

  await act(() => button('Edit observation').click())

  await fill('Observation text', 'Changed')

  await act(async () => button('Save observation').click())

  expect(update).toHaveBeenCalledWith(
    'run-a',
    'note',
    1,
    expect.objectContaining({ text: 'Changed' })
  )

  await act(() => button('Edit observation').click())

  notes = [{ ...note, revision: 2, text: 'Changed elsewhere' }]

  await act(() => render())

  expect(button('Save observation').disabled).toBe(true)

  expect(host.textContent).toContain('changed since this draft')

  await act(() => button('Discard draft').click())

  const confirm = vi.fn(() => false)

  vi.stubGlobal('confirm', confirm)

  await act(async () => button('Remove observation').click())

  expect(remove).not.toHaveBeenCalled()

  confirm.mockReturnValue(true)

  await act(async () => button('Remove observation').click())

  expect(remove).toHaveBeenCalledWith('run-a', 'note', 2)
})
