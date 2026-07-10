import { test } from '@playwright/test'
import {
  createStrokeDragRenderPerformanceUXGateCases,
  runStrokeDragRenderPerformanceUXGateCase,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

const dragPerformanceCases = createStrokeDragRenderPerformanceUXGateCases({
  suiteLabel: 'open outside dashed',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.openOutsideDashed
})

test.describe('stroke drag render performance UX gate: open outside dashed', () => {
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
