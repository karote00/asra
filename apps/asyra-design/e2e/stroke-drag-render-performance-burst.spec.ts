import { test } from '@playwright/test'
import {
  createStrokeDragRenderPerformanceUXGateCases,
  runStrokeDragRenderPerformanceUXGateCase,
  STROKE_DRAG_PERFORMANCE_BURST_CASES
} from './stroke-drag-render-performance.helpers'

const dragPerformanceCases = createStrokeDragRenderPerformanceUXGateCases({
  suiteLabel: 'burst coalescing',
  strokeCases: [],
  burstStrokeCases: STROKE_DRAG_PERFORMANCE_BURST_CASES
})

test.describe('stroke drag render performance UX gate: burst coalescing', () => {
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
