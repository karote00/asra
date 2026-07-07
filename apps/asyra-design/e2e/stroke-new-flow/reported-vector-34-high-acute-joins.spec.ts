import { expect, test } from '@playwright/test'
import { strokeVisualE2ECoverageMap } from './stroke-visual-e2e-coverage-map'
import {
  assertComputedJoin,
  assertNewFlowBaseUrl,
  assertRuntimeEvidenceMatchesCoverageCase,
  reportedVector34AnchorFocusPoints,
  buildReportedVector34ComputedData,
  captureRuntimeMetadataArtifact,
  captureRuntimeEvidence,
  captureVisualArtifacts,
  centerWorkspacePointInViewport,
  changeSelectedStrokeJoinViaUi,
  createComputedVectorFixture,
  resetNewFlowCanvas,
  setVectorEditOverlayVisible,
  setZoomPercent,
  strokeJoinTypes
} from './test-harness'

const coverageCase = strokeVisualE2ECoverageMap.find(
  (entry) => entry.id === 'reported-vector-34-high-acute-joins'
)

if (!coverageCase) {
  throw new Error('Missing reported-vector-34-high-acute-joins coverage case')
}

test.describe('new stroke flow: reported vector-34 high-acute joins', () => {
  test.beforeEach(async ({ page }) => {
    assertNewFlowBaseUrl()
    await page.setViewportSize(coverageCase.viewport)
    await resetNewFlowCanvas(page)
  })

  test('validates runtime metadata before visual evidence for miter, bevel, and round', async ({
    page
  }, testInfo) => {
    test.setTimeout(90_000)

    const elementId = await createComputedVectorFixture(
      page,
      buildReportedVector34ComputedData('miter')
    )

    for (const joinType of strokeJoinTypes) {
      await changeSelectedStrokeJoinViaUi(page, joinType)

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
      assertRuntimeEvidenceMatchesCoverageCase(evidence, coverageCase)

      for (const focus of reportedVector34AnchorFocusPoints) {
        await setZoomPercent(page, 5200)
        await centerWorkspacePointInViewport(page, focus.point)

        await captureVisualArtifacts({
          page,
          testInfo,
          coverageCase,
          evidence,
          label: `${joinType}-${focus.id}-micro`,
          cropSize: { width: 760, height: 620 }
        })

        await setVectorEditOverlayVisible(page, elementId, false)
        await captureVisualArtifacts({
          page,
          testInfo,
          coverageCase,
          evidence,
          label: `${joinType}-${focus.id}-render-only-micro`,
          cropSize: { width: 760, height: 620 }
        })
        await setVectorEditOverlayVisible(page, elementId, true)
      }
    }

    await expect(page.locator('canvas').first()).toBeVisible()
  })
})
