Feature: Stroke Rendering
  As a design-tool user
  I want uniform-width strokes to render predictably
  So that I can manually test and trust Figma-like stroke placement

  Scenario: Closed shapes render constrained solid strokes with round joins
    Given a closed rectangle, oval, or simple vector path is selected
    And the stroke style is solid
    When I switch stroke position between inside and outside
    And I set the join type to round
    Then the stroke should remain visible on the authored constrained side
    And the fill interior should not be replaced by stroke pixels

  Scenario: Closed paths render constrained dashed strokes without falling back to center
    Given a closed simple vector path is selected
    And the stroke style is dashed
    When I switch stroke position from center to inside or outside
    Then the stroke should render through constrained placement
    And it should not disappear or silently render as centered substitute geometry

  Scenario: Round constrained dashed joins use round geometry
    Given a supported closed constrained dashed full-loop path
    And the join type is round
    When the stroke renders
    Then the visible stroke region should use bounded round join geometry
    And it should not use miter-spike geometry as a proxy

  Scenario: Open constrained vectors use exact constrained geometry or blocked diagnostics
    Given an open vector path is selected
    And the authored stroke position is inside or outside
    When the stroke renders
    Then simple non-self-intersecting paths should render through exact one-sided constrained geometry
    And unsupported open topology should emit blocked diagnostics without substitute center geometry
