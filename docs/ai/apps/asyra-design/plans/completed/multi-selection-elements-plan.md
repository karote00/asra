# Plan: Multi-Selection for Elements

## Scope

Enable predictable multi-selection for elements across the content panel and
canvas, including selection visuals and fills aggregation behavior in the
properties panel.

Targets:

- shift-click range selection in the contents panel
- no deselect when shift-clicking empty canvas
- render a single selection box around multi-selected elements
- fills panel shows MIXED when selection differs by count or fill values

## Completion (2026-03-17)

- outcome: shift-click in contents panel selects a contiguous range without
  removing existing selections
- outcome: multi-selection renders a single selection box covering all
  selected elements
- outcome: fills panel now reports MIXED unless all fills match in count and
  value (including gradient stops/handles)
- completed plan: `docs/ai/apps/asyra-design/plans/completed/multi-selection-elements-plan.md`

## Steps

1. Selection interactions

- update contents panel row selection to support shift-range selection
- avoid deselecting on shift-click empty canvas

2. Selection visuals

- render multi-selection bounds as a single selection box

3. Fills aggregation

- return MIXED when selection fill counts differ
- return MIXED when any fill differs by color/opacity or gradient data

4. Validation

- manual: shift-click range selection in contents panel
- manual: shift-click empty canvas keeps selection
- manual: multi-selection shows a single selection box on canvas
- manual: fills panel shows mixed vs concrete fills per rules

## Validation

- manual checks for selection interactions, selection box, and fills panel
