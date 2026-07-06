import { expect, test } from '@playwright/test'
import { strokeVisualE2ECoverageMap } from './stroke-visual-e2e-coverage-map'
import {
  assertNewFlowBaseUrl,
  assertRuntimeEvidenceMatchesCoverageCase,
  buildSmoothCurvatureComputedData,
  captureRuntimeMetadataArtifact,
  captureRuntimeEvidence,
  captureVisualArtifacts,
  centerWorkspacePointInViewport,
  createComputedVectorFixture,
  resetNewFlowCanvas,
  setZoomPercent,
  smoothCurvatureFocusPoint
} from './test-harness'

const coverageCase = strokeVisualE2ECoverageMap.find(
  (entry) => entry.id === 'smooth-curvature-non-join'
)

if (!coverageCase) {
  throw new Error('Missing smooth-curvature-non-join coverage case')
}

test.describe('new stroke flow: smooth high-curvature non-join validation', () => {
  test.beforeEach(async ({ page }) => {
    assertNewFlowBaseUrl()
    await page.setViewportSize(coverageCase.viewport)
    await resetNewFlowCanvas(page)
  })

  test('keeps smooth curvature ownership out of source-vertex join materialization', async ({
    page
  }, testInfo) => {
    test.setTimeout(60_000)

    const elementId = await createComputedVectorFixture(
      page,
      buildSmoothCurvatureComputedData('round')
    )
    await setZoomPercent(page, 520)
    await centerWorkspacePointInViewport(page, smoothCurvatureFocusPoint)

    const evidence = await captureRuntimeEvidence(page, coverageCase, elementId)
    await captureRuntimeMetadataArtifact({
      testInfo,
      coverageCase,
      evidence,
      label: 'smooth-high-curvature'
    })
    assertRuntimeEvidenceMatchesCoverageCase(evidence, coverageCase)

    await captureVisualArtifacts({
      page,
      testInfo,
      coverageCase,
      evidence,
      label: 'smooth-high-curvature',
      cropSize: { width: 520, height: 420 }
    })

    await expect(page.locator('canvas').first()).toBeVisible()
  })
})
