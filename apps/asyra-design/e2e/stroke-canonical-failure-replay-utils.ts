import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import {
  ARTIFACT_DIR,
  SELF_CHECK_VECTOR_RECT,
  createSelfCheckStar,
  resetCanvas,
  waitForAppReady,
  type SelfCheckCapType,
  type SelfCheckJoinType,
  type SelfCheckStrokePosition,
  type SelfCheckStrokeStyle,
  type Vec2
} from './stroke-self-check-star-fixture'

export interface CanonicalStrokeFailureArtifact {
  markerId: string
  errorCode: string
  caseKey: string
  summary: string
  fixtureKind: 'self-check-star' | 'open-line' | 'right-angle'
  sourceSegmentId?: string
  sourcePointId?: string
  nearestAnchorId?: string
  localPoint: Vec2
  t?: number
  side?: string
  expected?: unknown
  actual?: unknown
  diagnostics?: {
    diffPolygons?: {
      kind: 'actual-minus-reference' | 'reference-minus-actual'
      area: number
      point: Vec2
      polygon: Vec2[]
    }[]
  }
  recommendedViewport: {
    zoom: number
    center: Vec2
  }
}

export interface CanonicalStrokeFailureManifest {
  protocolVersion: number
  generatedBy: string
  failureCount: number
  failures: CanonicalStrokeFailureArtifact[]
}

export const FAILURE_REPLAY_DIR = path.join(
  ARTIFACT_DIR,
  'canonical-stroke-matrix/failures'
)

export const FAILURE_MANIFEST_PATH = path.join(
  FAILURE_REPLAY_DIR,
  'failure-manifest.json'
)

export const readCanonicalFailureManifest = () => {
  if (!fs.existsSync(FAILURE_MANIFEST_PATH)) {
    return null
  }
  return JSON.parse(
    fs.readFileSync(FAILURE_MANIFEST_PATH, 'utf8')
  ) as CanonicalStrokeFailureManifest
}

const parseCaseKey = (caseKey: string) => {
  const [style, position, variant] = caseKey.includes(':')
    ? caseKey.split(':')
    : caseKey.split('-')
  return {
    style: style as SelfCheckStrokeStyle,
    position: position as SelfCheckStrokePosition,
    capType: variant as SelfCheckCapType,
    joinType: variant as SelfCheckJoinType
  }
}

const forceClearFailureReplayCanvas = async (page: Page) => {
  await page.goto('/')
  await waitForAppReady(page)
  await resetCanvas(page)
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elementApis = (window as any).__AsyraE2E__?.elementApis
    const elements = core?.deps?.sceneTree?.getAllElements?.()
    if (!core || !elementApis || !(elements instanceof Map)) {
      throw new Error('Missing replay canvas clearing APIs')
    }

    const elementIds = Array.from(elements.entries())
      .filter(([, element]) => element?.get?.('type') !== 'workspace')
      .map(([elementId]) => elementId)
    elementIds.forEach((elementId) => {
      elementApis.deleteElement(elementId, { undoable: false })
    })
    core.selectElements?.([], { undoable: false })
    core.setSystemProperty?.('pathEditingVectorId', null)
    core.setSystemProperty?.('pathEditingMode', false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__selfCheckVectorId = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__selfCheckVectorRect = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__canonicalReplayVectorRect = null
  })
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const elements = core?.deps?.sceneTree?.getAllElements?.()
    if (!(elements instanceof Map)) {
      return false
    }

    return Array.from(elements.values()).every(
      (element) => element?.get?.('type') === 'workspace'
    )
  })
}

const assertFailureReplayFixtureState = async (
  page: Page,
  options: {
    includeFill?: boolean
  }
) => {
  await page.evaluate(({ includeFill }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const elements = core?.deps?.sceneTree?.getAllElements?.()
    if (!core || !(elements instanceof Map)) {
      throw new Error('Missing replay fixture assertion APIs')
    }

    const elementEntries = Array.from(elements.entries()).filter(
      ([, element]) => element?.get?.('type') !== 'workspace'
    )
    if (elementEntries.length !== 1) {
      throw new Error(
        `Expected exactly one replay element, received ${elementEntries.length}`
      )
    }

    const vectorEntries = elementEntries.filter(
      ([, element]) => element?.get?.('type') === 'vector'
    )
    if (vectorEntries.length !== 1) {
      throw new Error(
        `Expected exactly one replay vector, received ${vectorEntries.length}`
      )
    }

    const [vectorId, vectorElement] = vectorEntries[0]
    const fills =
      vectorElement?.getAllComputedData?.()?.fills ??
      vectorElement?.get?.('fills') ??
      []
    if (includeFill === false && Array.isArray(fills) && fills.length > 0) {
      throw new Error(
        `Expected no-fill replay vector, but ${vectorId} has ${fills.length} fill(s)`
      )
    }
  }, options)
}

const createOpenLineFixture = async (
  page: Page,
  options: {
    style: SelfCheckStrokeStyle
    position: SelfCheckStrokePosition
    capType: SelfCheckCapType
    joinType: SelfCheckJoinType
  }
) => {
  await page.setViewportSize({ width: 1400, height: 1100 })
  await page.evaluate(
    ({ options: innerOptions, rect }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }
      const points = {
        'open-line:start': {
          id: 'open-line:start',
          kind: 'anchor',
          x: 0,
          y: 0
        },
        'open-line:end': {
          id: 'open-line:end',
          kind: 'anchor',
          x: 160,
          y: 0
        }
      }
      const segments = {
        'open-line:segment': {
          id: 'open-line:segment',
          startId: 'open-line:start',
          endId: 'open-line:end',
          outControlId: null,
          inControlId: null
        }
      }
      const networks = {
        'open-line:network': {
          id: 'open-line:network',
          pointIds: ['open-line:start', 'open-line:end'],
          segmentIds: ['open-line:segment'],
          closed: false
        }
      }
      const createdId = elementApis.createElement(
        { type: 'vector', points, segments, networks, closed: false },
        { undoable: false }
      )
      elementApis.changeComputedData(
        [createdId],
        {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          points,
          segments,
          networks,
          closed: false,
          fills: [],
          strokes: [
            {
              id: `canonical-replay-${innerOptions.style}-${innerOptions.position}`,
              kind: 'solid',
              style: innerOptions.style,
              position: innerOptions.position,
              width: 12,
              dashPattern: innerOptions.style === 'dashed' ? [40, 40] : [],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#df0606',
              opacity: 0.7,
              visible: true,
              gradient: null,
              joinType: innerOptions.joinType,
              capType: innerOptions.capType,
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
      core.selectElements([createdId], { undoable: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__canonicalReplayVectorRect = { ...rect }
    },
    {
      options,
      rect: {
        x: SELF_CHECK_VECTOR_RECT.x + 220,
        y: SELF_CHECK_VECTOR_RECT.y + 160,
        width: 160,
        height: 1
      }
    }
  )
}

export const prepareFailureReplayFixture = async (
  page: Page,
  failure: CanonicalStrokeFailureArtifact,
  options: {
    includeFill?: boolean
  } = {}
) => {
  await forceClearFailureReplayCanvas(page)
  const parsed = parseCaseKey(failure.caseKey)
  if (failure.fixtureKind === 'open-line') {
    await createOpenLineFixture(page, {
      style: parsed.style,
      position: parsed.position,
      capType: parsed.capType,
      joinType: 'round'
    })
    await assertFailureReplayFixtureState(page, options)
    return
  }

  await createSelfCheckStar(page, {
    style: parsed.style,
    position: parsed.position,
    capType: parsed.style === 'dashed' ? parsed.capType : 'round',
    joinType: parsed.style === 'solid' ? parsed.joinType : 'round',
    includeFill: options.includeFill
  })
  await assertFailureReplayFixtureState(page, options)
}

export const focusFailureReplayViewport = async (
  page: Page,
  failure: CanonicalStrokeFailureArtifact
) => {
  await page.evaluate(
    ({ failure: innerFailure }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const starRect = (window as any).__selfCheckVectorRect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const replayRect = (window as any).__canonicalReplayVectorRect
      const rect =
        innerFailure.fixtureKind === 'open-line' ? replayRect : starRect
      if (!core || !rect) {
        throw new Error('Missing replay viewport context')
      }
      const zoom = innerFailure.recommendedViewport.zoom
      core.setSystemProperty('zoom', zoom)
      core.setSystemProperty('viewportPosition', {
        x: 700 - (rect.x + innerFailure.recommendedViewport.center.x) * zoom,
        y: 520 - (rect.y + innerFailure.recommendedViewport.center.y) * zoom
      })
    },
    { failure }
  )
  await page.waitForTimeout(250)
}

export const addFailureMarkerOverlay = async (
  page: Page,
  failure: CanonicalStrokeFailureArtifact,
  options: {
    showDiffPolygons?: boolean
  } = {}
) => {
  await page.evaluate(
    ({ failure: innerFailure, options: innerOptions }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const starRect = (window as any).__selfCheckVectorRect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const replayRect = (window as any).__canonicalReplayVectorRect
      const rect =
        innerFailure.fixtureKind === 'open-line' ? replayRect : starRect
      if (!core || !rect) {
        throw new Error('Missing replay marker context')
      }
      const zoom = core.getSystemProperty('zoom')
      const viewport = core.getSystemProperty('viewportPosition')
      const screenPoint = {
        x: (rect.x + innerFailure.localPoint.x) * zoom + viewport.x,
        y: (rect.y + innerFailure.localPoint.y) * zoom + viewport.y
      }
      const toScreenPoint = (point: { x: number; y: number }) => ({
        x: (rect.x + point.x) * zoom + viewport.x,
        y: (rect.y + point.y) * zoom + viewport.y
      })
      const diffPolygons = innerFailure.diagnostics?.diffPolygons ?? []
      if (innerOptions.showDiffPolygons === true && diffPolygons.length > 0) {
        const svg = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg'
        )
        svg.setAttribute('data-canonical-failure-diff-overlay', 'true')
        svg.style.position = 'fixed'
        svg.style.left = '0'
        svg.style.top = '0'
        svg.style.width = '100vw'
        svg.style.height = '100vh'
        svg.style.zIndex = '2147483646'
        svg.style.pointerEvents = 'none'
        diffPolygons.forEach((diffPolygon) => {
          const polygon = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'polygon'
          )
          polygon.setAttribute(
            'points',
            diffPolygon.polygon
              .map((point) => {
                const screen = toScreenPoint(point)
                return `${screen.x},${screen.y}`
              })
              .join(' ')
          )
          polygon.setAttribute(
            'fill',
            diffPolygon.kind === 'actual-minus-reference'
              ? 'rgba(255,0,255,0.42)'
              : 'rgba(255,214,0,0.48)'
          )
          polygon.setAttribute(
            'stroke',
            diffPolygon.kind === 'actual-minus-reference'
              ? '#ff00ff'
              : '#ffd600'
          )
          polygon.setAttribute('stroke-width', '2')
          svg.appendChild(polygon)
        })
        document.body.appendChild(svg)
      }
      const overlay = document.createElement('div')
      overlay.setAttribute(
        'data-canonical-failure-marker',
        innerFailure.markerId
      )
      overlay.style.position = 'fixed'
      overlay.style.left = `${screenPoint.x - 18}px`
      overlay.style.top = `${screenPoint.y - 18}px`
      overlay.style.width = '36px'
      overlay.style.height = '36px'
      overlay.style.border = '4px solid #00e5ff'
      overlay.style.borderRadius = '999px'
      overlay.style.boxSizing = 'border-box'
      overlay.style.zIndex = '2147483647'
      overlay.style.pointerEvents = 'none'
      overlay.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.85)'
      const label = document.createElement('div')
      label.textContent = innerFailure.markerId
      label.style.position = 'absolute'
      label.style.left = '38px'
      label.style.top = '-6px'
      label.style.padding = '2px 6px'
      label.style.background = '#00e5ff'
      label.style.color = '#001015'
      label.style.font = '700 14px sans-serif'
      label.style.borderRadius = '4px'
      overlay.appendChild(label)
      const detail = document.createElement('div')
      const actual = innerFailure.actual as
        | {
            symmetricDifferenceArea?: number
            primaryDifferenceKind?: string | null
            actualMinusReferenceArea?: number
            referenceMinusActualArea?: number
          }
        | undefined
      detail.textContent = [
        innerFailure.errorCode,
        innerFailure.sourceSegmentId ?? innerFailure.sourcePointId ?? '',
        actual?.primaryDifferenceKind
          ? `primary: ${actual.primaryDifferenceKind}`
          : '',
        typeof actual?.symmetricDifferenceArea === 'number'
          ? `symDiff: ${actual.symmetricDifferenceArea.toFixed(2)}`
          : ''
      ]
        .filter(Boolean)
        .join(' | ')
      detail.style.position = 'absolute'
      detail.style.left = '38px'
      detail.style.top = '22px'
      detail.style.maxWidth = '420px'
      detail.style.padding = '4px 6px'
      detail.style.background = 'rgba(0,0,0,0.82)'
      detail.style.color = '#fff'
      detail.style.font = '700 12px sans-serif'
      detail.style.border = '1px solid rgba(0,229,255,0.8)'
      detail.style.borderRadius = '4px'
      detail.style.whiteSpace = 'normal'
      overlay.appendChild(detail)
      document.body.appendChild(overlay)
    },
    { failure, options }
  )
}

export const writeFailureReplayReport = (
  manifest: CanonicalStrokeFailureManifest,
  screenshots: { markerId: string; screenshot: string }[]
) => {
  const reportPath = path.join(FAILURE_REPLAY_DIR, 'failure-report.md')
  const screenshotByMarker = new Map(
    screenshots.map((entry) => [entry.markerId, entry.screenshot])
  )
  const lines = [
    '# Canonical Stroke Failure Replay',
    '',
    `Generated failures: ${manifest.failureCount}`,
    '',
    '| Marker | Error | Case | Source | Summary | Fill screenshot | No-fill screenshot |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...manifest.failures.map((failure) => {
      const screenshot = screenshotByMarker.get(failure.markerId)
      const noFillScreenshot = screenshotByMarker.get(
        `${failure.markerId}-no-fill`
      )
      return [
        failure.markerId,
        failure.errorCode,
        failure.caseKey,
        failure.sourceSegmentId ?? failure.sourcePointId ?? 'unknown',
        failure.summary.replaceAll('|', '\\|'),
        screenshot
          ? `[png](${path.relative(FAILURE_REPLAY_DIR, screenshot)})`
          : '',
        noFillScreenshot
          ? `[png](${path.relative(FAILURE_REPLAY_DIR, noFillScreenshot)})`
          : ''
      ].join(' | ')
    })
  ]
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
  return reportPath
}
