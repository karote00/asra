import {
  runStrokeDragRenderPerformanceUXGate,
  STROKE_DRAG_PERFORMANCE_BURST_CASES
} from './stroke-drag-render-performance.helpers'

runStrokeDragRenderPerformanceUXGate({
  suiteLabel: 'burst coalescing',
  strokeCases: [],
  burstStrokeCases: STROKE_DRAG_PERFORMANCE_BURST_CASES
})
