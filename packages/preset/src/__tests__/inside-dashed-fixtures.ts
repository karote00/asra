import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import { createDefaultStroke } from '@asyra/utils'

export const REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID = 'tn-12'

export const createReportedRoundInsideDashedStarVectorData = () => ({
  id: 'vector-13',
  x: 1329.2128537242381,
  y: 1837.5517556078082,
  width: 460.98040174968355,
  height: 545.3694144981421,
  points: {
    'tp-48': {
      id: 'tp-48',
      kind: 'anchor',
      x: 288.3579534349085,
      y: 0,
      anchorType: 'sharp'
    },
    'tp-49': {
      id: 'tp-49',
      kind: 'anchor',
      x: 45.11723080954357,
      y: 545.3300071762217,
      anchorType: 'smooth'
    },
    'tp-48:out': {
      id: 'tp-48:out',
      kind: 'control',
      x: 252.3230173491993,
      y: 178.32291234662443,
      controlForId: 'tp-48',
      controlRole: 'out'
    },
    'tp-49:in': {
      id: 'tp-49:in',
      kind: 'control',
      x: -41.19399334784407,
      y: 542.1914172068621,
      controlForId: 'tp-49',
      controlRole: 'in'
    },
    'tp-49:out': {
      id: 'tp-49:out',
      kind: 'control',
      x: 153.006261006278,
      y: 549.2532446379212,
      controlForId: 'tp-49',
      controlRole: 'out'
    },
    'tp-50': {
      id: 'tp-50',
      kind: 'anchor',
      x: 460.98040174968355,
      y: 258.9336724721627,
      anchorType: 'sharp'
    },
    'tp-51': {
      id: 'tp-51',
      kind: 'anchor',
      x: 0,
      y: 121.62036131268246,
      anchorType: 'sharp'
    },
    'tp-52': {
      id: 'tp-52',
      kind: 'anchor',
      x: 388.9024498660667,
      y: 524.4701633765546,
      anchorType: 'smooth'
    },
    'tp-51:out': {
      id: 'tp-51:out',
      kind: 'control',
      x: 0,
      y: 121.62036131268246,
      controlForId: 'tp-51',
      controlRole: 'out'
    },
    'tp-52:in': {
      id: 'tp-52:in',
      kind: 'control',
      x: 347.70845651822265,
      y: 540.1631132233522,
      controlForId: 'tp-52',
      controlRole: 'in'
    },
    'tp-52:out': {
      id: 'tp-52:out',
      kind: 'control',
      x: 430.0964432139108,
      y: 508.7772135297571,
      controlForId: 'tp-52',
      controlRole: 'out'
    }
  } satisfies Record<string, VectorPointNode>,
  segments: {
    'ts-81': {
      id: 'ts-81',
      startId: 'tp-48',
      endId: 'tp-49',
      outControlId: 'tp-48:out',
      inControlId: 'tp-49:in'
    },
    'ts-82': {
      id: 'ts-82',
      startId: 'tp-49',
      endId: 'tp-50',
      outControlId: 'tp-49:out',
      inControlId: null
    },
    'ts-83': {
      id: 'ts-83',
      startId: 'tp-50',
      endId: 'tp-51',
      outControlId: null,
      inControlId: null
    },
    'ts-84': {
      id: 'ts-84',
      startId: 'tp-51',
      endId: 'tp-52',
      outControlId: 'tp-51:out',
      inControlId: 'tp-52:in'
    },
    'ts-85': {
      id: 'ts-85',
      startId: 'tp-52',
      endId: 'tp-48',
      outControlId: 'tp-52:out',
      inControlId: null
    }
  } satisfies Record<string, VectorSegment>,
  networks: {
    [REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID]: {
      id: REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID,
      pointIds: ['tp-48', 'tp-49', 'tp-50', 'tp-51', 'tp-52'],
      segmentIds: ['ts-81', 'ts-82', 'ts-83', 'ts-84', 'ts-85'],
      closed: true
    }
  } satisfies Record<string, VectorNetwork>,
  closed: true,
  fills: [],
  strokes: [
    createDefaultStroke({
      id: 'pp-263',
      style: 'dashed',
      position: 'inside',
      width: 10,
      dash: 20,
      gap: 20,
      color: '#e10c0c',
      opacity: 0.5,
      visible: true,
      joinType: 'round',
      miterAngle: 28.96
    })
  ]
})
