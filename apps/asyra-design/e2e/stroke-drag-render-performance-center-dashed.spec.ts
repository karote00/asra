import { test } from '@playwright/test'
import {
  createStrokeDragRenderPerformanceUXGateCases,
  runStrokeDragRenderPerformanceUXGateCase,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

const dragPerformanceCases = createStrokeDragRenderPerformanceUXGateCases({
  suiteLabel: 'closed center dashed',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.centerDashed
})

test.describe('stroke drag render performance UX gate: closed center dashed', () => {
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
