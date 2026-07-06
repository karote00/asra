import { expect, test } from '@playwright/test'
import { strokeVisualE2ECoverageMap } from './stroke-visual-e2e-coverage-map'
import {
  assertNewFlowBaseUrl,
  assertRuntimeEvidenceMatchesCoverageCase,
  buildHiddenOutputComputedData,
  buildOrdinarySharpComputedData,
  buildPaintOnlyComputedData,
  captureRuntimeMetadataArtifact,
  captureRuntimeEvidence,
  captureVisualArtifacts,
  centerWorkspacePointInViewport,
  changeComputedVectorFixture,
  createComputedVectorFixture,
  ordinarySharpFocusPoint,
  resetNewFlowCanvas,
  resetStrokeNewFlowRuntimeEvidence,
  setZoomPercent
} from './test-harness'

const coverageCase = strokeVisualE2ECoverageMap.find(
  (entry) => entry.id === 'descriptor-channel-separation'
)

if (!coverageCase) {
  throw new Error('Missing descriptor-channel-separation coverage case')
}

const descriptorVisibleRuntimeAssertions = [
  'computed-stroke-state',
  'render-entry-presence',
  'owner-stage-metadata',
  'visible-contributor-metadata',
  'geometry-basis-metadata',
  'route-product-signature-metadata',
  'descriptor-channel-separation'
] as const

const descriptorVisibleRuntimeFields = [
  'computedStrokeState',
  'renderEntries',
  'ownerStage',
  'visibleContributor',
  'geometryBasis',
  'routeId',
  'productSignature',
  'productMode',
  'descriptorProductPolygonsVisible'
] as const

test.describe('new stroke flow: descriptor and output channel separation', () => {
  test.beforeEach(async ({ page }) => {
    assertNewFlowBaseUrl()
    await page.setViewportSize(coverageCase.viewport)
    await resetNewFlowCanvas(page)
  })

  test('keeps descriptor-visible runtime state channel-separated before screenshot capture', async ({
    page
  }, testInfo) => {
    const elementId = await createComputedVectorFixture(
      page,
      buildOrdinarySharpComputedData('miter')
    )
    await setZoomPercent(page, 360)
    await centerWorkspacePointInViewport(page, ordinarySharpFocusPoint)

    const evidence = await captureRuntimeEvidence(page, coverageCase, elementId)
    await captureRuntimeMetadataArtifact({
      testInfo,
      coverageCase,
      evidence,
      label: 'descriptor-visible'
    })
    assertRuntimeEvidenceMatchesCoverageCase(evidence, coverageCase, {
      runtimeMetadataAssertions: descriptorVisibleRuntimeAssertions,
      requiredRuntimeEvidenceFields: descriptorVisibleRuntimeFields
    })

    await captureVisualArtifacts({
      page,
      testInfo,
      coverageCase,
      evidence,
      label: 'descriptor-visible',
      cropSize: { width: 1000, height: 760 }
    })
  })

  test('records hidden-output as non-geometry runtime evidence', async ({
    page
  }, testInfo) => {
    await resetNewFlowCanvas(page)
    const elementId = await createComputedVectorFixture(
      page,
      buildHiddenOutputComputedData()
    )
    await setZoomPercent(page, 360)
    await centerWorkspacePointInViewport(page, ordinarySharpFocusPoint)

    const evidence = await captureRuntimeEvidence(page, coverageCase, elementId)
    await captureRuntimeMetadataArtifact({
      testInfo,
      coverageCase,
      evidence,
      label: 'hidden-output'
    })
    assertRuntimeEvidenceMatchesCoverageCase(evidence, coverageCase, {
      runtimeMetadataAssertions: [
        'computed-stroke-state',
        'hidden-output-non-geometry'
      ],
      requiredRuntimeEvidenceFields: ['computedStrokeState', 'renderEntries'],
      allowEmptyRenderEntries: true
    })
    expect(
      evidence.renderEntries.every(
        (entry) =>
          entry.strokeMaskPolygonCount === 0 &&
          entry.fillPolygonCount === 0 &&
          entry.strokePathGroupCount === 0
      )
    ).toBe(true)

    await captureVisualArtifacts({
      page,
      testInfo,
      coverageCase,
      evidence,
      label: 'hidden-output',
      cropSize: { width: 1000, height: 760 }
    })
  })

  test('records paint-only validation without treating paint as a geometry owner', async ({
    page
  }, testInfo) => {
    const redElementId = await createComputedVectorFixture(
      page,
      buildPaintOnlyComputedData('#cc3333')
    )
    await setZoomPercent(page, 360)
    await centerWorkspacePointInViewport(page, ordinarySharpFocusPoint)
    const redEvidence = await captureRuntimeEvidence(
      page,
      coverageCase,
      redElementId
    )
    await captureRuntimeMetadataArtifact({
      testInfo,
      coverageCase,
      evidence: redEvidence,
      label: 'paint-only-red'
    })
    assertRuntimeEvidenceMatchesCoverageCase(redEvidence, coverageCase, {
      runtimeMetadataAssertions: [
        ...descriptorVisibleRuntimeAssertions,
        'paint-only-non-geometry'
      ],
      requiredRuntimeEvidenceFields: descriptorVisibleRuntimeFields
    })

    await captureVisualArtifacts({
      page,
      testInfo,
      coverageCase,
      evidence: redEvidence,
      label: 'paint-only-red',
      cropSize: { width: 1000, height: 760 }
    })

    await resetNewFlowCanvas(page)
    const blueElementId = await createComputedVectorFixture(
      page,
      buildPaintOnlyComputedData('#3366cc')
    )
    await setZoomPercent(page, 360)
    await centerWorkspacePointInViewport(page, ordinarySharpFocusPoint)
    const blueEvidence = await captureRuntimeEvidence(
      page,
      coverageCase,
      blueElementId
    )
    await captureRuntimeMetadataArtifact({
      testInfo,
      coverageCase,
      evidence: blueEvidence,
      label: 'paint-only-blue'
    })
    assertRuntimeEvidenceMatchesCoverageCase(blueEvidence, coverageCase, {
      runtimeMetadataAssertions: [
        ...descriptorVisibleRuntimeAssertions,
        'paint-only-non-geometry'
      ],
      requiredRuntimeEvidenceFields: descriptorVisibleRuntimeFields
    })

    expect(redEvidence.computed?.pointIds).toEqual(
      blueEvidence.computed?.pointIds
    )
    expect(redEvidence.computed?.segmentIds).toEqual(
      blueEvidence.computed?.segmentIds
    )
    expect(redEvidence.computed?.networkIds).toEqual(
      blueEvidence.computed?.networkIds
    )

    await captureVisualArtifacts({
      page,
      testInfo,
      coverageCase,
      evidence: blueEvidence,
      label: 'paint-only-blue',
      cropSize: { width: 1000, height: 760 }
    })
  })

  test('records cache-hit validation without treating cache reuse as geometry repair', async ({
    page
  }, testInfo) => {
    const elementId = await createComputedVectorFixture(
      page,
      buildPaintOnlyComputedData('#cc3333')
    )
    await setZoomPercent(page, 360)
    await centerWorkspacePointInViewport(page, ordinarySharpFocusPoint)

    const baselineEvidence = await captureRuntimeEvidence(
      page,
      coverageCase,
      elementId
    )
    await captureRuntimeMetadataArtifact({
      testInfo,
      coverageCase,
      evidence: baselineEvidence,
      label: 'cache-hit-baseline'
    })
    assertRuntimeEvidenceMatchesCoverageCase(baselineEvidence, coverageCase, {
      runtimeMetadataAssertions: descriptorVisibleRuntimeAssertions,
      requiredRuntimeEvidenceFields: descriptorVisibleRuntimeFields
    })

    await resetStrokeNewFlowRuntimeEvidence(page)
    await changeComputedVectorFixture(
      page,
      elementId,
      buildPaintOnlyComputedData('#3366cc')
    )

    const cacheHitEvidence = await captureRuntimeEvidence(
      page,
      coverageCase,
      elementId
    )
    await captureRuntimeMetadataArtifact({
      testInfo,
      coverageCase,
      evidence: cacheHitEvidence,
      label: 'cache-hit-rerender'
    })
    assertRuntimeEvidenceMatchesCoverageCase(cacheHitEvidence, coverageCase, {
      runtimeMetadataAssertions: [
        ...descriptorVisibleRuntimeAssertions,
        'cache-hit-non-geometry'
      ],
      requiredRuntimeEvidenceFields: [
        ...descriptorVisibleRuntimeFields,
        'pipelineCounters'
      ]
    })

    expect(
      cacheHitEvidence.renderEntries.map((entry) => entry.productSignature)
    ).toEqual(
      baselineEvidence.renderEntries.map((entry) => entry.productSignature)
    )
    expect(
      cacheHitEvidence.renderEntries.map((entry) => entry.productMode)
    ).toEqual(baselineEvidence.renderEntries.map((entry) => entry.productMode))

    await captureVisualArtifacts({
      page,
      testInfo,
      coverageCase,
      evidence: cacheHitEvidence,
      label: 'cache-hit-rerender',
      cropSize: { width: 1000, height: 760 }
    })
  })
})
