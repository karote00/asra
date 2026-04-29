import { describe, expect, it } from 'vitest'
import {
  allocateDashedIntervalsForTopology,
  buildPathTopologyModel,
  classifyCompoundClosedLegalDomains
} from '../components/stroke-render/path-topology-model'

describe('path topology model', () => {
  it('should run: classify a rectangle-equivalent closed path once with legal domain metadata', () => {
    const topology = buildPathTopologyModel({
      pathId: 'rect:test',
      sourceId: 'rect:test',
      networkId: 'rect',
      sourceFamily: 'shape',
      points: [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 40 },
        { x: 0, y: 40 }
      ],
      closed: true
    })

    expect(topology).toMatchObject({
      pathId: 'rect:test',
      sourceId: 'rect:test',
      networkId: 'rect',
      sourceFamily: 'shape',
      topologyFamily: 'rectangle-equivalent',
      closed: true,
      totalLength: 240,
      isSimpleClosed: true,
      isSimpleOpen: false,
      canonicalLengthBasis: 'arc-length-on-topology'
    })
    expect(topology.contours).toHaveLength(1)
    expect(topology.contours[0]).toMatchObject({
      role: 'shell',
      isClosed: true,
      legalDomainId: 'rect:test:legal-domain:0',
      arcLength: 240
    })
    expect(topology.legalDomains).toEqual([
      {
        legalDomainId: 'rect:test:legal-domain:0',
        role: 'shell',
        fillRuleBasis: 'declared-app-policy',
        contourIds: ['rect:test:contour:0']
      }
    ])
  })

  it('should run: allocate dash intervals directly from topology length and closure', () => {
    const topology = buildPathTopologyModel({
      pathId: 'line:test',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      closed: false
    })

    expect(
      allocateDashedIntervalsForTopology(topology, [20, 10], 0).map(
        (interval) => ({
          kind: interval.kind,
          startDistance: interval.startDistance,
          endDistance: interval.endDistance
        })
      )
    ).toEqual([
      { kind: 'visible', startDistance: 0, endDistance: 20 },
      { kind: 'gap', startDistance: 20, endDistance: 30 },
      { kind: 'visible', startDistance: 30, endDistance: 50 },
      { kind: 'gap', startDistance: 50, endDistance: 60 },
      { kind: 'visible', startDistance: 60, endDistance: 80 },
      { kind: 'gap', startDistance: 80, endDistance: 90 },
      { kind: 'visible', startDistance: 90, endDistance: 100 }
    ])
  })

  it('should run: classify open path simplicity once on the topology model', () => {
    const simpleOpen = buildPathTopologyModel({
      pathId: 'open:simple',
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 20 },
        { x: 100, y: 0 }
      ],
      closed: false
    })
    const crossingOpen = buildPathTopologyModel({
      pathId: 'open:crossing',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 }
      ],
      closed: false
    })

    expect(simpleOpen).toMatchObject({
      topologyFamily: 'open',
      isSimpleOpen: true,
      intersectionDescriptors: []
    })
    expect(crossingOpen).toMatchObject({
      topologyFamily: 'open',
      isSimpleOpen: false,
      intersectionDescriptors: [{ kind: 'self-intersection' }]
    })
  })

  it('should run: classify compound closed legal domains without orientation inference', () => {
    const outer = buildPathTopologyModel({
      pathId: 'compound:outer',
      networkId: 'outer',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ],
      closed: true
    })
    const innerSameOrientation = buildPathTopologyModel({
      pathId: 'compound:inner',
      networkId: 'inner',
      points: [
        { x: 25, y: 25 },
        { x: 75, y: 25 },
        { x: 75, y: 75 },
        { x: 25, y: 75 }
      ],
      closed: true
    })

    expect(
      classifyCompoundClosedLegalDomains([outer, innerSameOrientation])
    ).toEqual([
      {
        pathId: 'compound:outer',
        networkId: 'outer',
        contourId: 'compound:outer:contour:0',
        legalDomainId: 'compound:outer:legal-domain:0',
        role: 'shell',
        nestingDepth: 0
      },
      {
        pathId: 'compound:inner',
        networkId: 'inner',
        contourId: 'compound:inner:contour:0',
        legalDomainId: 'compound:inner:legal-domain:0',
        role: 'hole',
        nestingDepth: 1
      }
    ])
  })
})
