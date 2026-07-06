import { test } from '@playwright/test'
import { strokeVisualE2ECoverageMap } from './stroke-visual-e2e-coverage-map'
import {
  assertIndependentSegmentDashPixelOracle,
  assertNewFlowBaseUrl,
  assertReferenceAcuteDashBodyEvidence,
  assertReferenceAcutePaintEvidence,
  assertRuntimeEvidenceMatchesCoverageCase,
  buildReferenceAcuteConstrainedDashComputedData,
  captureRuntimeEvidence,
  captureRuntimeMetadataArtifact,
  captureVisualArtifacts,
  centerWorkspacePointInViewport,
  createComputedVectorFixture,
  referenceAcuteEndpointOverviewFocusPoint,
  resetNewFlowCanvas,
  setZoomPercent
} from './test-harness'

const coverageCase = strokeVisualE2ECoverageMap.find(
  (entry) => entry.id === 'independent-terminal-half-dash-pixel-oracle'
)

if (!coverageCase) {
  throw new Error(
    'Missing independent-terminal-half-dash-pixel-oracle coverage case'
  )
}

test.describe('new stroke flow: independent terminal half dash pixel oracle', () => {
  test.beforeEach(async ({ page }) => {
    assertNewFlowBaseUrl()
    await page.setViewportSize(coverageCase.viewport)
    await resetNewFlowCanvas(page)
  })

  for (const position of ['inside', 'outside'] as const) {
    test(`keeps ${position} independent segment start/end terminal dash pixels and gap pixels honest`, async ({
      page
    }, testInfo) => {
      test.setTimeout(90_000)

      const computedData =
        buildReferenceAcuteConstrainedDashComputedData(position)
      const elementId = await createComputedVectorFixture(page, computedData)
      await setZoomPercent(page, 260)
      await centerWorkspacePointInViewport(
        page,
        referenceAcuteEndpointOverviewFocusPoint
      )

      const evidence = await captureRuntimeEvidence(
        page,
        coverageCase,
        elementId
      )
      await captureRuntimeMetadataArtifact({
        testInfo,
        coverageCase,
        evidence,
        label: position
      })
      assertReferenceAcutePaintEvidence(evidence)

      await captureVisualArtifacts({
        page,
        testInfo,
        coverageCase,
        evidence,
        label: position,
        cropSize: { width: 1300, height: 980 }
      })

      await assertIndependentSegmentDashPixelOracle({
        page,
        computedData,
        label: `${position} constrained dashed`
      })

      assertReferenceAcuteDashBodyEvidence(evidence)
      assertRuntimeEvidenceMatchesCoverageCase(evidence, coverageCase)
    })
  }
})
