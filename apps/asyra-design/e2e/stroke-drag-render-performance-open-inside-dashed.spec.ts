import { test } from '@playwright/test'
import {
  createStrokeDragRenderPerformanceUXGateCases,
  runStrokeDragRenderPerformanceUXGateCase,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

const dragPerformanceCases = createStrokeDragRenderPerformanceUXGateCases({
  suiteLabel: 'open inside dashed',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.openInsideDashed
})

test.describe('stroke drag render performance UX gate: open inside dashed', () => {
  test.setTimeout(300000)

  for (const dragPerformanceCase of dragPerformanceCases) {
    test(dragPerformanceCase.title, async ({ page }, testInfo) => {
      await runStrokeDragRenderPerformanceUXGateCase(
        page,
        testInfo,
        dragPerformanceCase
      )
    })
  }
})
