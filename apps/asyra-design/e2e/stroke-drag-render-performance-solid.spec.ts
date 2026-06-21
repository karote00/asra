import { test } from '@playwright/test'
import {
  createStrokeDragRenderPerformanceUXGateCases,
  runStrokeDragRenderPerformanceUXGateCase,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

const dragPerformanceCases = createStrokeDragRenderPerformanceUXGateCases({
  suiteLabel: 'closed solid',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.solid,
  includeMoveVector: true
})

test.describe('stroke drag render performance UX gate: closed solid', () => {
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
