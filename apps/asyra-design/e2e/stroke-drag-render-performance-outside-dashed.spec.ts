import {
  runStrokeDragRenderPerformanceUXGate,
  STROKE_DRAG_PERFORMANCE_CASE_GROUPS
} from './stroke-drag-render-performance.helpers'

runStrokeDragRenderPerformanceUXGate({
  suiteLabel: 'closed outside dashed',
  strokeCases: STROKE_DRAG_PERFORMANCE_CASE_GROUPS.outsideDashed
})
