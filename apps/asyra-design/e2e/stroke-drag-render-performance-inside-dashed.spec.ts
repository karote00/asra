import {
  runStrokeDragRenderPerformanceUXGate,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

runStrokeDragRenderPerformanceUXGate({
  suiteLabel: 'closed inside dashed',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.insideDashed
})
