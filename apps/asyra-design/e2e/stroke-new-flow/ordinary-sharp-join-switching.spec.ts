import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { strokeVisualE2ECoverageMap } from './stroke-visual-e2e-coverage-map'
import {
  assertComputedJoin,
  assertNewFlowBaseUrl,
  assertOutsideDashedJoinPixelOracle,
  assertRuntimeEvidenceMatchesCoverageCase,
  buildReferenceAcuteJoinComputedData,
  captureRuntimeMetadataArtifact,
  captureRuntimeEvidence,
  captureVisualArtifacts,
  centerWorkspacePointInViewport,
  changeSelectedStrokeJoinViaUi,
  createComputedVectorFixture,
  referenceAcuteJoinFocusPoint,
  resetNewFlowCanvas,
  assertReferenceAcuteDashBodyEvidence,
  assertReferenceAcutePaintEvidence,
  setZoomPercent,
  type StrokeJoin,
  strokeJoinTypes
} from './test-harness'

const coverageCase = strokeVisualE2ECoverageMap.find(
  (entry) => entry.id === 'ordinary-sharp-join-switching'
)

if (!coverageCase) {
  throw new Error('Missing ordinary-sharp-join-switching coverage case')
}

const hashRenderEntries = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

test.describe('new stroke flow: ordinary sharp join switching', () => {
  test.beforeEach(async ({ page }) => {
    assertNewFlowBaseUrl()
    await page.setViewportSize(coverageCase.viewport)
    await resetNewFlowCanvas(page)
  })

  test('keeps miter, bevel, and round runtime render evidence distinguishable', async ({
    page
  }, testInfo) => {
    test.setTimeout(90_000)

    const computedData = buildReferenceAcuteJoinComputedData('miter', {
      dash: 45,
      gap: 20
    })
    const elementId = await createComputedVectorFixture(page, computedData)
    const renderEntryHashes: string[] = []
    const visualMaskSignatures = new Map<StrokeJoin, string>()

    for (const joinType of strokeJoinTypes) {
      await changeSelectedStrokeJoinViaUi(page, joinType)
      await setZoomPercent(page, 2300)
      await centerWorkspacePointInViewport(page, referenceAcuteJoinFocusPoint)

      const evidence = await captureRuntimeEvidence(
        page,
        coverageCase,
        elementId
      )
      await captureRuntimeMetadataArtifact({
        testInfo,
        coverageCase,
        evidence,
        label: joinType
      })
      assertComputedJoin(evidence, joinType)
      assertReferenceAcutePaintEvidence(evidence)
      assertReferenceAcuteDashBodyEvidence(evidence)
      assertRuntimeEvidenceMatchesCoverageCase(evidence, coverageCase)
      renderEntryHashes.push(hashRenderEntries(evidence.renderEntries))

      const artifacts = await captureVisualArtifacts({
        page,
        testInfo,
        coverageCase,
        evidence,
        label: joinType,
        cropSize: { width: 760, height: 620 }
      })
      expect(
        artifacts.focusedCropMetrics.redPixelCount,
        `${joinType} crop must contain visible red stroke pixels`
      ).toBeGreaterThan(0)
      await setZoomPercent(page, 900)
      await centerWorkspacePointInViewport(page, referenceAcuteJoinFocusPoint)
      await assertOutsideDashedJoinPixelOracle({
        page,
        computedData,
        label: `${joinType} reference acute outside dashed`
      })
      visualMaskSignatures.set(
        joinType,
        artifacts.focusedCropMetrics.redMaskSignature
      )
    }

    expect(new Set(renderEntryHashes).size).toBe(strokeJoinTypes.length)
    expect(new Set(visualMaskSignatures.values()).size).toBe(
      strokeJoinTypes.length
    )
  })
})
