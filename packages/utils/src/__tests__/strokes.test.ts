import { describe, expect, it } from 'vitest'
import {
  FillKinds,
  createDefaultFill,
  createDefaultStroke
} from '../propsManager/index.js'

describe('stroke props manager', () => {
  it('should run: create canonical stroke fill from legacy flat paint input', () => {
    const stroke = createDefaultStroke({
      id: 'stroke-a',
      color: '#3366ff',
      opacity: 0.5,
      visible: false
    })

    expect(stroke).toEqual({
      id: 'stroke-a',
      type: 'stroke',
      style: 'solid',
      position: 'center',
      width: 1,
      dash: 20,
      gap: 20,
      fill: {
        ...createDefaultFill({
          id: 'stroke-a',
          type: 'fill',
          color: '#3366ff',
          opacity: 0.5,
          visible: false
        })
      },
      joinType: 'miter',
      capType: 'butt',
      miterAngle: 28.96
    })
    expect('color' in stroke).toBe(false)
    expect('opacity' in stroke).toBe(false)
    expect('visible' in stroke).toBe(false)
  })

  it('should run: prefer canonical fill payload over legacy flat paint input', () => {
    const stroke = createDefaultStroke({
      id: 'stroke-b',
      color: '#000000',
      opacity: 1,
      fill: createDefaultFill({
        id: 'untrusted-fill-id',
        kind: FillKinds.GRADIENT,
        color: '#ff3300',
        opacity: 0.25,
        visible: true
      })
    })

    expect(stroke.fill.id).toBe('stroke-b')
    expect(stroke.fill.type).toBe('fill')
    expect(stroke.fill.kind).toBe(FillKinds.GRADIENT)
    expect(stroke.fill.color).toBe('#ff3300')
    expect(stroke.fill.opacity).toBe(0.25)
  })
})
