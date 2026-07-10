import { test } from '@playwright/test'
import {
  createStrokeDragRenderPerformanceUXGateCases,
  runStrokeDragRenderPerformanceUXGateCase,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

const dragPerformanceCases = createStrokeDragRenderPerformanceUXGateCases({
  suiteLabel: 'open solid',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.openSolid
})

test.describe('stroke drag render performance UX gate: open solid', () => {
  test.setTimeout(300000)

  for (const dragPerformanceCase of dragPerformanceCases) {
    test(dragPerformanceCase.title, async ({ page }) => {
      await runStrokeDragRenderPerformanceUXGateCase(
        page,
        dragPerformanceCase
      )
    })
  }
})
