Feature: Stroke visual validation
  The visual validation phase verifies user-visible stroke behavior after the
  runtime product pipeline has already emitted product metadata.

  Background:
    Given the stroke engine spec is the source of stroke semantics
    And the stroke inspector flow is the source of runtime step and route order
    And legacy stroke tests are quarantined as historical evidence
    And the app visual review base URL is explicitly set to "http://localhost:3001"

  Scenario: Switching high-acute joins records runtime product evidence before screenshots
    Given a reported high-acute outside dashed vector is selected
    When the user switches the authored join through miter, bevel, and round
    Then each state exposes runtime product metadata for the selected stroke
    And each state produces a full screenshot and a focused high-acute crop
    And screenshot evidence is attached only after metadata assertions pass

  Scenario: Ordinary sharp join switching stays visibly and semantically distinct
    Given an ordinary sharp outside dashed vector is selected
    When the user switches the authored join through miter, bevel, and round
    Then the runtime metadata records the authored join state for each switch
    And the focused crops are comparable across the three join states
    And no endpoint cap, bridge, duplicate interval paint, or renderer-owned join completes the authored sharp corner

  Scenario: Smooth high-curvature spans remain smooth-continuity products
    Given a dashed outside vector contains tangent-continuous high-curvature smooth anchors
    When the focused smooth-span visual review runs
    Then the runtime metadata keeps smooth-continuity ownership separate from sharp source-vertex join ownership
    And the focused crop shows the same app-visible state represented by the runtime metadata

  Scenario: Descriptor and output channels remain separated
    Given a stroke fixture exercises descriptor, render, hit-export, diagnostics, hidden-output, paint-only, and cache-hit routes
    When the visual validation suite captures runtime evidence
    Then descriptor evidence is not treated as visible product output
    And hidden-output, paint-only, and cache-hit states do not become geometry repair routes
    And visual screenshots are attached only as app-visible evidence for those runtime states
