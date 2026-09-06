// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  validateAcceptanceExpression,
  type AcceptanceExpression
} from '../../../analysis/contracts-rules'
import { AcceptanceFields } from '../acceptance-fields'

let host: HTMLDivElement

let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  host = document.createElement('div')

  document.body.append(host)

  root = createRoot(host)
})

afterEach(async () => {
  await act(() => root.unmount())

  host.remove()

  vi.unstubAllGlobals()
})

async function setup(initial?: AcceptanceExpression) {
  let value = initial

  const render = () =>
    root.render(
      createElement(AcceptanceFields, {
        value,
        baseline: 0.02,
        onChange: (next) => {
          value = next

          render()
        }
      })
    )

  await act(render)

  return () => value
}

async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find(
    (item) => item.textContent === text
  )

  if (!button) throw new Error('Missing button')

  await act(() => button.click())
}

async function select(label: string, value: string) {
  const field = host.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)

  if (!field) throw new Error('Missing select')

  await act(() => {
    field.value = value

    field.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

it('builds typed nested groups in the draft and removes only by explicit intent', async () => {
  const value = await setup()

  expect(value()).toBeUndefined()

  await click('Add acceptance conditions')

  await select('Condition 1 type', 'all')

  await select('Condition 1.1 type', 'penetration')

  await select('Condition 1.1 expected penetration', 'present')

  await select('Condition 1.2 type', 'any')

  await select('Condition 1.2.1 comparison', 'below')

  expect(value()).toEqual({
    kind: 'all',
    conditions: [
      { kind: 'penetration', expected: 'present' },
      {
        kind: 'any',
        conditions: [
          { kind: 'clearance', operator: 'below', value: 0.02 },
          { kind: 'clearance', operator: 'above', value: 0.02 }
        ]
      }
    ]
  })

  expect(() => validateAcceptanceExpression(value())).not.toThrow()

  expect(host.textContent).toContain('5/31 nodes')

  await click('Use baseline verdict only')

  expect(value()).toBeUndefined()
})

it('retains an empty numeric input as invalid instead of inventing a zero threshold', async () => {
  const source: AcceptanceExpression = {
    kind: 'clearance',
    operator: 'above',
    value: 0.01
  }

  const value = await setup(source)

  const field = host.querySelector<HTMLInputElement>(
    '[aria-label="Condition 1 threshold (mm)"]'
  )

  if (!field) throw new Error('Missing threshold')

  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set?.call(field, '')

    field.dispatchEvent(new Event('input', { bubbles: true }))
  })

  expect(field.value).toBe('')

  expect(host.textContent).toContain('Save and preflight will reject')

  expect(() => validateAcceptanceExpression(value())).toThrow()

  expect(source.value).toBe(0.01)
})

it('does not offer over-depth groups or expansion beyond the node allowance', async () => {
  const leaf: AcceptanceExpression = { kind: 'penetration', expected: 'absent' }

  const layer3 = (): AcceptanceExpression => ({
    kind: 'all',
    conditions: Array.from({ length: 4 }, () => ({ ...leaf }))
  })

  const layer2 = (): AcceptanceExpression => ({
    kind: 'any',
    conditions: [layer3(), layer3(), layer3()]
  })

  const tree = { kind: 'all' as const, conditions: [layer2(), layer2()] }

  const first = tree.conditions[0]

  if (first.kind !== 'any' || first.conditions[0].kind !== 'all')
    throw new Error('Invalid test tree')

  first.conditions[0].conditions = first.conditions[0].conditions.slice(0, 2)

  await setup(tree)

  expect(host.textContent).toContain('31/31 nodes')

  expect(
    host.querySelector<HTMLButtonElement>('[aria-label="Add condition to 1"]')
      ?.disabled
  ).toBe(true)

  expect(
    host.querySelector<HTMLOptionElement>(
      '[aria-label="Condition 1.1.1.1 type"] option[value="all"]'
    )?.disabled
  ).toBe(true)
})
