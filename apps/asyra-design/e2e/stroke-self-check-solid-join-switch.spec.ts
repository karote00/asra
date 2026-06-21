import { expect, test, type Page } from '@playwright/test'
import { resetCanvas, waitForAppReady } from './test-utils'

type SelfCheckCapType = 'butt' | 'square' | 'round'
type SelfCheckJoinType = 'miter' | 'bevel' | 'round'
type SelfCheckStrokePosition = 'inside' | 'outside'
type SelfCheckStrokeStyle = 'solid' | 'dashed'

interface Vec2 {
  x: number
  y: number
}

const SELF_CHECK_SOURCE_POINTS = {
  'tp-12': { x: 188.1928217922337, y: 0 },
  'tp-13': { x: 11.358174406717296, y: 365.76797704068724 },
  'tp-12:out': { x: 164.3673966581619, y: 140.91988215887423 },
  'tp-13:in': { x: -42.09205809548172, y: 344.92238636482955 },
  'tp-13:out': { x: 78.17096503446606, y: 391.8249653855095 },
  'tp-14': { x: 360.12094148356584, y: 145.95389587539378 },
  'tp-15': { x: 0, y: 15.668954151283657 },
  'tp-16': { x: 270.59180204238254, y: 347.0603956649177 },
  'tp-15:out': { x: 0, y: 15.668954151283657 },
  'tp-16:in': { x: 263.9105229796075, y: 364.43172122813246 },
  'tp-16:out': { x: 277.27308110515736, y: 329.6890701017029 }
} satisfies Record<string, Vec2>

const SELF_CHECK_VECTOR_RECT = {
  x: 177.70582329255865,
  y: 121.88648201811688,
  width: 360.12094148356584,
  height: 367.70186652155667
} as const

const SELF_CHECK_POINTS = {
  'tp-12': {
    id: 'tp-12',
    kind: 'anchor',
    x: 188.1928217922337,
    y: 0,
    anchorType: 'smooth'
  },
  'tp-13': {
    id: 'tp-13',
    kind: 'anchor',
    x: 11.358174406717296,
    y: 365.76797704068724,
    anchorType: 'smooth'
  },
  'tp-12:out': {
    id: 'tp-12:out',
    kind: 'control',
    x: 164.3673966581619,
    y: 140.91988215887423,
    controlForId: 'tp-12',
    controlRole: 'out'
  },
  'tp-13:in': {
    id: 'tp-13:in',
    kind: 'control',
    x: -42.09205809548172,
    y: 344.92238636482955,
    controlForId: 'tp-13',
    controlRole: 'in'
  },
  'tp-13:out': {
    id: 'tp-13:out',
    kind: 'control',
    x: 78.17096503446606,
    y: 391.8249653855095,
    controlForId: 'tp-13',
    controlRole: 'out'
  },
  'tp-14': {
    id: 'tp-14',
    kind: 'anchor',
    x: 360.12094148356584,
    y: 145.95389587539378,
    anchorType: 'sharp'
  },
  'tp-15': {
    id: 'tp-15',
    kind: 'anchor',
    x: 0,
    y: 15.668954151283657,
    anchorType: 'sharp'
  },
  'tp-16': {
    id: 'tp-16',
    kind: 'anchor',
    x: 270.59180204238254,
    y: 347.0603956649177,
    anchorType: 'smooth'
  },
  'tp-15:out': {
    id: 'tp-15:out',
    kind: 'control',
    x: 0,
    y: 15.668954151283657,
    controlForId: 'tp-15',
    controlRole: 'out'
  },
  'tp-16:in': {
    id: 'tp-16:in',
    kind: 'control',
    x: 263.9105229796075,
    y: 364.43172122813246,
    controlForId: 'tp-16',
    controlRole: 'in'
  },
  'tp-16:out': {
    id: 'tp-16:out',
    kind: 'control',
    x: 277.27308110515736,
    y: 329.6890701017029,
    controlForId: 'tp-16',
    controlRole: 'out'
  }
} as const

const SELF_CHECK_SEGMENTS = {
  'ts-23': {
    id: 'ts-23',
    startId: 'tp-12',
    endId: 'tp-13',
    outControlId: 'tp-12:out',
    inControlId: 'tp-13:in'
  },
  'ts-24': {
    id: 'ts-24',
    startId: 'tp-13',
    endId: 'tp-14',
    outControlId: 'tp-13:out',
    inControlId: null
  },
  'ts-25': {
    id: 'ts-25',
    startId: 'tp-14',
    endId: 'tp-15',
    outControlId: null,
    inControlId: null
  },
  'ts-26': {
    id: 'ts-26',
    startId: 'tp-15',
    endId: 'tp-16',
    outControlId: 'tp-15:out',
    inControlId: 'tp-16:in'
  },
  'ts-27': {
    id: 'ts-27',
    startId: 'tp-16',
    endId: 'tp-12',
    outControlId: 'tp-16:out',
    inControlId: null
  }
} as const

const SELF_CHECK_NETWORKS = {
  'tn-4': {
    id: 'tn-4',
    pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
    segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
    closed: true
  }
} as const

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForAppReady(page)
  await resetCanvas(page)
  await page.evaluate(() => {
    ;(
      window as typeof window & {
        __ASYRA_STROKE_DIAGNOSTICS_MODE__?: 'full'
      }
    ).__ASYRA_STROKE_DIAGNOSTICS_MODE__ = 'full'
  })
  await page.setViewportSize({ width: 1400, height: 1100 })
})

const createSelfCheckStar = async (
  page: Page,
  options: {
    capType?: SelfCheckCapType
    joinType?: SelfCheckJoinType
    position?: SelfCheckStrokePosition
    style?: SelfCheckStrokeStyle
  } = {}
) => {
  await page.evaluate(
    ({
      capType,
      joinType,
      position,
      rect,
      style,
      points,
      segments,
      networks
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis

      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const createdId = elementApis.createElement(
        { type: 'vector', points, segments, networks, closed: true },
        { undoable: false }
      )

      if (!createdId) {
        throw new Error('Failed to create stroke self-check star')
      }

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
          closed: true,
          fills: [
            {
              id: 'self-check-fill',
              kind: 'solid',
              fillType: 'color',
              color: '#d5d5d5',
              opacity: 1,
              visible: true
            }
          ],
          strokes: [
            {
              id: `self-check-${position}-${style}-${capType}-${joinType}`,
              kind: 'solid',
              style,
              position,
              width: 10,
              dashPattern: style === 'dashed' ? [27, 20] : [],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: '#df0606',
              opacity: 0.5,
              visible: true,
              gradient: null,
              joinType,
              capType,
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )

      core.selectElements([createdId], { undoable: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__selfCheckVectorId = createdId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__selfCheckVectorRect = { ...rect }
      core.setSystemProperty('zoom', 1.55)
      core.setSystemProperty('viewportPosition', { x: 145, y: 75 })
      core.setSystemProperty('pathEditingVectorId', createdId)
      core.setSystemProperty('pathEditingMode', true)
      core.setSystemProperty('strokeDebugDisableVisualOverlapCollapse', false)
    },
    {
      capType: options.capType ?? 'round',
      joinType: options.joinType ?? 'round',
      position: options.position ?? 'outside',
      rect: SELF_CHECK_VECTOR_RECT,
      style: options.style ?? 'solid',
      points: SELF_CHECK_POINTS,
      segments: SELF_CHECK_SEGMENTS,
      networks: SELF_CHECK_NETWORKS
    }
  )
}

const changeSelfCheckStrokeJoinType = async (
  page: Page,
  joinType: SelfCheckJoinType
) => {
  await page.evaluate(
    ({ joinType }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__selfCheckVectorId ??
        null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.()

      if (!selectedId || !elementApis || !computed?.strokes?.length) {
        throw new Error('Missing self-check stroke for join update')
      }

      elementApis.changeComputedData(
        [selectedId],
        {
          strokes: computed.strokes.map((stroke: unknown, index: number) =>
            index === 0 &&
            stroke &&
            typeof stroke === 'object' &&
            !Array.isArray(stroke)
              ? { ...stroke, joinType }
              : stroke
          )
        },
        { undoable: false }
      )
    },
    { joinType }
  )

  await page.waitForFunction((expectedJoinType) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__selfCheckVectorId ??
      null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return computed?.strokes?.[0]?.joinType === expectedJoinType
  }, joinType)
}

const getSelfCheckMetadata = async (page: Page) =>
  page.evaluate((selfCheckRect) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__selfCheckVectorId ??
      null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const renderElement = selectedId
      ? core?.deps?.render?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.() ?? null
    const exportPackets =
      renderElement?.__asyraSolidCenterStrokeExportPackets ?? []
    const meshCache = renderElement?.__asyraStrokeMeshCache ?? null
    const renderStrokeCacheEntries =
      meshCache && typeof meshCache.entries === 'function'
        ? Array.from(meshCache.entries()).map(([cacheKey, cacheEntry]) => {
            const entry = cacheEntry as Record<string, unknown>
            const revisionSet =
              entry.revisionSet && typeof entry.revisionSet === 'object'
                ? (entry.revisionSet as Record<string, unknown>)
                : {}
            return {
              cacheKey: typeof cacheKey === 'string' ? cacheKey : null,
              kind: typeof entry.kind === 'string' ? entry.kind : null,
              signature:
                typeof entry.signature === 'string' ? entry.signature : null,
              paintKey:
                typeof entry.paintKey === 'string' ? entry.paintKey : null,
              lastDirtyKeys: Array.isArray(entry.lastDirtyKeys)
                ? entry.lastDirtyKeys
                : [],
              strokeSpecRevision:
                typeof revisionSet.strokeSpecRevision === 'string' ||
                typeof revisionSet.strokeSpecRevision === 'number'
                  ? revisionSet.strokeSpecRevision
                  : null
            }
          })
        : []
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
      x: 0,
      y: 0
    }
    const getStringArray = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : []
    const boundaryDomainPackets = exportPackets.map(
      (packet: {
        debugMeta?: {
          productMode?: unknown
          productSignature?: unknown
          domainMode?: unknown
          topologyFamily?: unknown
          strokePosition?: unknown
          strokeJoin?: unknown
          solidMaskModelVisibleRender?: unknown
          solidMaskModelCoverageOracle?: unknown
          solidMaskModelMaskSide?: unknown
          domainPlanTerminalRole?: unknown
          domainPlanSplitRangeTerminals?: unknown
        }
        geometryId?: unknown
      }) => ({
        geometryId:
          typeof packet.geometryId === 'string' ? packet.geometryId : null,
        productMode:
          typeof packet.debugMeta?.productMode === 'string'
            ? packet.debugMeta.productMode
            : null,
        productSignature:
          typeof packet.debugMeta?.productSignature === 'string'
            ? packet.debugMeta.productSignature
            : null,
        domainMode:
          typeof packet.debugMeta?.domainMode === 'string'
            ? packet.debugMeta.domainMode
            : null,
        topologyFamily:
          typeof packet.debugMeta?.topologyFamily === 'string'
            ? packet.debugMeta.topologyFamily
            : null,
        strokePosition:
          packet.debugMeta?.strokePosition === 'outside' ||
          packet.debugMeta?.strokePosition === 'inside' ||
          packet.debugMeta?.strokePosition === 'center'
            ? packet.debugMeta.strokePosition
            : null,
        strokeJoin:
          packet.debugMeta?.strokeJoin === 'miter' ||
          packet.debugMeta?.strokeJoin === 'bevel' ||
          packet.debugMeta?.strokeJoin === 'round'
            ? packet.debugMeta.strokeJoin
            : null,
        solidMaskModelVisibleRender:
          packet.debugMeta?.solidMaskModelVisibleRender ===
          'masked-source-stroke'
            ? packet.debugMeta.solidMaskModelVisibleRender
            : null,
        solidMaskModelCoverageOracle:
          packet.debugMeta?.solidMaskModelCoverageOracle === 'exact-boolean' ||
          packet.debugMeta?.solidMaskModelCoverageOracle === 'render-mask'
            ? packet.debugMeta.solidMaskModelCoverageOracle
            : null,
        solidMaskModelMaskSide:
          packet.debugMeta?.solidMaskModelMaskSide === 'outside-exterior' ||
          packet.debugMeta?.solidMaskModelMaskSide === 'inside-fill'
            ? packet.debugMeta.solidMaskModelMaskSide
            : null,
        domainPlanTerminalRole:
          typeof packet.debugMeta?.domainPlanTerminalRole === 'string'
            ? packet.debugMeta.domainPlanTerminalRole
            : null,
        domainPlanSplitRangeTerminals: getStringArray(
          packet.debugMeta?.domainPlanSplitRangeTerminals
        )
      })
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const secondaryRect = (window as any).__selfCheckVectorRect
    const selectedRect = computed
      ? {
          x: computed.x,
          y: computed.y,
          width: computed.width,
          height: computed.height
        }
      : secondaryRect &&
          typeof secondaryRect.x === 'number' &&
          typeof secondaryRect.y === 'number' &&
          typeof secondaryRect.width === 'number' &&
          typeof secondaryRect.height === 'number'
        ? { ...secondaryRect }
        : { ...selfCheckRect }
    return {
      selectedRect,
      zoom,
      viewport,
      computedStrokes: computed?.strokes ?? [],
      renderStrokeCacheEntries,
      boundaryDomainPackets
    }
  }, SELF_CHECK_VECTOR_RECT)

const compareLocalAnchorPixels = async (
  page: Page,
  first: Buffer,
  second: Buffer,
  metadata: Awaited<ReturnType<typeof getSelfCheckMetadata>>,
  sourceAnchor: Vec2
) =>
  page.evaluate(
    async ({ firstDataUrl, secondDataUrl, metadata, sourceAnchor }) => {
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error(`Failed to decode ${src}`))
          image.src = src
        })
      const [firstImage, secondImage] = await Promise.all([
        loadImage(firstDataUrl),
        loadImage(secondDataUrl)
      ])
      const width = firstImage.width
      const height = firstImage.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Missing canvas 2D context for join pixel oracle')
      }

      context.drawImage(firstImage, 0, 0)
      const firstPixels = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(secondImage, 0, 0)
      const secondPixels = context.getImageData(0, 0, width, height).data

      const screenAnchor = {
        x:
          (metadata.selectedRect.x + sourceAnchor.x) * metadata.zoom +
          metadata.viewport.x,
        y:
          (metadata.selectedRect.y + sourceAnchor.y) * metadata.zoom +
          metadata.viewport.y
      }
      const radius = 96
      let comparedPixelCount = 0
      let changedRgbaPixelCount = 0
      let totalRgbaDifference = 0
      let fullImageRgbaChangedPixelCount = 0
      const rgbaChangedBounds = {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }

      for (let index = 0; index < firstPixels.length; index += 4) {
        const rgbaDifference =
          Math.abs(firstPixels[index] - secondPixels[index]) +
          Math.abs(firstPixels[index + 1] - secondPixels[index + 1]) +
          Math.abs(firstPixels[index + 2] - secondPixels[index + 2]) +
          Math.abs(firstPixels[index + 3] - secondPixels[index + 3])
        if (rgbaDifference > 8) {
          const pixelIndex = index / 4
          const x = pixelIndex % width
          const y = Math.floor(pixelIndex / width)
          fullImageRgbaChangedPixelCount += 1
          rgbaChangedBounds.minX = Math.min(rgbaChangedBounds.minX, x)
          rgbaChangedBounds.minY = Math.min(rgbaChangedBounds.minY, y)
          rgbaChangedBounds.maxX = Math.max(rgbaChangedBounds.maxX, x)
          rgbaChangedBounds.maxY = Math.max(rgbaChangedBounds.maxY, y)
        }
      }

      for (
        let y = Math.max(0, Math.floor(screenAnchor.y - radius));
        y <= Math.min(height - 1, Math.ceil(screenAnchor.y + radius));
        y += 1
      ) {
        for (
          let x = Math.max(0, Math.floor(screenAnchor.x - radius));
          x <= Math.min(width - 1, Math.ceil(screenAnchor.x + radius));
          x += 1
        ) {
          if (
            (x - screenAnchor.x) ** 2 + (y - screenAnchor.y) ** 2 >
            radius ** 2
          ) {
            continue
          }
          const index = (y * width + x) * 4
          const rgbaDifference =
            Math.abs(firstPixels[index] - secondPixels[index]) +
            Math.abs(firstPixels[index + 1] - secondPixels[index + 1]) +
            Math.abs(firstPixels[index + 2] - secondPixels[index + 2]) +
            Math.abs(firstPixels[index + 3] - secondPixels[index + 3])
          comparedPixelCount += 1
          if (rgbaDifference > 8) {
            changedRgbaPixelCount += 1
            totalRgbaDifference += rgbaDifference
          }
        }
      }

      return {
        comparedPixelCount,
        changedRgbaPixelCount,
        totalRgbaDifference,
        fullImageRgbaChangedPixelCount,
        rgbaChangedBounds:
          fullImageRgbaChangedPixelCount > 0 ? rgbaChangedBounds : null,
        screenAnchor
      }
    },
    {
      firstDataUrl: `data:image/png;base64,${first.toString('base64')}`,
      secondDataUrl: `data:image/png;base64,${second.toString('base64')}`,
      metadata,
      sourceAnchor
    }
  )

test('outside solid bevel switch updates masked-source-stroke join pixels', async ({
  page
}) => {
  await createSelfCheckStar(page)
  await page.waitForFunction(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : null
    const computed = element?.getAllComputedData?.()
    return Boolean(computed?.strokes?.length && computed?.fills?.length)
  })
  await page.waitForTimeout(800)

  const roundScreenshot = await page.screenshot({ fullPage: false })
  const roundMetadata = await getSelfCheckMetadata(page)

  await changeSelfCheckStrokeJoinType(page, 'bevel')
  await page.waitForTimeout(800)
  const bevelScreenshot = await page.screenshot({ fullPage: false })
  const bevelMetadata = await getSelfCheckMetadata(page)

  await changeSelfCheckStrokeJoinType(page, 'miter')
  await page.waitForTimeout(800)
  const miterScreenshot = await page.screenshot({ fullPage: false })
  const miterMetadata = await getSelfCheckMetadata(page)

  const getProductPackets = (metadata: typeof miterMetadata) =>
    metadata.boundaryDomainPackets.filter(
      (packet) =>
        packet.productSignature?.startsWith('constrained-solid:') === true &&
        packet.strokePosition === 'outside'
    )
  const summarizeProductPackets = (metadata: typeof miterMetadata) =>
    getProductPackets(metadata).map((packet) => ({
      geometryId: packet.geometryId,
      strokeJoin: packet.strokeJoin,
      solidMaskModelVisibleRender: packet.solidMaskModelVisibleRender,
      solidMaskModelCoverageOracle: packet.solidMaskModelCoverageOracle,
      solidMaskModelMaskSide: packet.solidMaskModelMaskSide,
      domainPlanTerminalRole: packet.domainPlanTerminalRole,
      terminalCount: packet.domainPlanSplitRangeTerminals.length
    }))
  const getComputedJoinType = (metadata: typeof miterMetadata) =>
    metadata.computedStrokes[0]?.joinType ?? null

  expect(
    {
      miter: getComputedJoinType(miterMetadata),
      bevel: getComputedJoinType(bevelMetadata),
      round: getComputedJoinType(roundMetadata)
    },
    JSON.stringify(
      {
        miter: miterMetadata.computedStrokes,
        bevel: bevelMetadata.computedStrokes,
        round: roundMetadata.computedStrokes
      },
      null,
      2
    )
  ).toEqual({ miter: 'miter', bevel: 'bevel', round: 'round' })
  expect(getProductPackets(bevelMetadata).length).toBeGreaterThan(0)
  expect(
    getProductPackets(bevelMetadata).every(
      (packet) =>
        packet.strokeJoin === 'bevel' &&
        packet.solidMaskModelVisibleRender === 'masked-source-stroke' &&
        packet.solidMaskModelCoverageOracle === 'render-mask' &&
        packet.solidMaskModelMaskSide === 'outside-exterior' &&
        packet.domainPlanTerminalRole === null &&
        packet.domainPlanSplitRangeTerminals.length === 0
    ),
    JSON.stringify({ bevelPackets: getProductPackets(bevelMetadata) }, null, 2)
  ).toBe(true)

  const roundVsBevelTopRight = await compareLocalAnchorPixels(
    page,
    roundScreenshot,
    bevelScreenshot,
    roundMetadata,
    SELF_CHECK_SOURCE_POINTS['tp-14']
  )
  const roundVsBevelTopLeft = await compareLocalAnchorPixels(
    page,
    roundScreenshot,
    bevelScreenshot,
    roundMetadata,
    SELF_CHECK_SOURCE_POINTS['tp-15']
  )
  const bevelVsMiterTopRight = await compareLocalAnchorPixels(
    page,
    bevelScreenshot,
    miterScreenshot,
    bevelMetadata,
    SELF_CHECK_SOURCE_POINTS['tp-14']
  )
  const bevelVsMiterTopLeft = await compareLocalAnchorPixels(
    page,
    bevelScreenshot,
    miterScreenshot,
    bevelMetadata,
    SELF_CHECK_SOURCE_POINTS['tp-15']
  )

  expect(
    Math.max(
      roundVsBevelTopRight.changedRgbaPixelCount,
      roundVsBevelTopLeft.changedRgbaPixelCount,
      roundVsBevelTopRight.fullImageRgbaChangedPixelCount,
      roundVsBevelTopLeft.fullImageRgbaChangedPixelCount
    ),
    JSON.stringify(
      {
        message:
          'outside solid bevel must visibly differ from round after switching joinType',
        roundVsBevelTopRight,
        roundVsBevelTopLeft,
        roundCacheEntries: roundMetadata.renderStrokeCacheEntries,
        bevelCacheEntries: bevelMetadata.renderStrokeCacheEntries,
        roundPackets: summarizeProductPackets(roundMetadata),
        bevelPackets: summarizeProductPackets(bevelMetadata)
      },
      null,
      2
    )
  ).toBeGreaterThan(24)
  expect(
    Math.max(
      bevelVsMiterTopRight.changedRgbaPixelCount,
      bevelVsMiterTopLeft.changedRgbaPixelCount,
      roundVsBevelTopRight.changedRgbaPixelCount,
      roundVsBevelTopLeft.changedRgbaPixelCount,
      bevelVsMiterTopRight.fullImageRgbaChangedPixelCount,
      bevelVsMiterTopLeft.fullImageRgbaChangedPixelCount,
      roundVsBevelTopRight.fullImageRgbaChangedPixelCount,
      roundVsBevelTopLeft.fullImageRgbaChangedPixelCount
    ),
    JSON.stringify(
      {
        message:
          'outside solid bevel must participate in source-vertex join geometry after switching joinType',
        bevelVsMiterTopRight,
        bevelVsMiterTopLeft,
        roundVsBevelTopRight,
        roundVsBevelTopLeft,
        roundCacheEntries: roundMetadata.renderStrokeCacheEntries,
        bevelCacheEntries: bevelMetadata.renderStrokeCacheEntries,
        miterCacheEntries: miterMetadata.renderStrokeCacheEntries,
        bevelPackets: summarizeProductPackets(bevelMetadata),
        miterPackets: summarizeProductPackets(miterMetadata),
        roundPackets: summarizeProductPackets(roundMetadata)
      },
      null,
      2
    )
  ).toBeGreaterThan(24)
})
