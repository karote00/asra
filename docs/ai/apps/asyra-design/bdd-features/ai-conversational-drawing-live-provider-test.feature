Feature: Conversational AI live provider formal testing
  As an Asyra Design release owner
  I want a credential-gated live provider acceptance suite
  So that a real model is tested without exposing secrets or replacing deterministic Mock authority

  Background:
    Given exact "ai=mock" remains keyless and deterministic
    And the live provider can be reached only through a loopback same-origin test proxy
    And live provider output remains untrusted until complete runtime preflight passes
    And the default live run allows at most 8 requests, 5 provider minutes, USD 2.00, and 45 seconds per request

  Scenario: Default and Mock test commands never require a live API key
    Given the live-test opt-in is absent
    When ordinary unit, integration, E2E, lint, and build commands run
    Then no live provider proxy should start
    And no vendor request or secret read should occur
    When Asyra Design starts with exact "ai=mock"
    Then only the deterministic Mock provider should be composed
    And the Agent experience should remain available without an API key

  Scenario: An explicit live run fails before launch when the key is missing
    Given "ASYRA_DESIGN_LIVE_AI_TEST" is "1"
    And "ASYRA_DESIGN_LIVE_AI_TEST_API_KEY" is absent
    When the formal live-provider command starts
    Then preflight should fail before test server and browser launch
    And no vendor request should occur
    And the failure should name only the missing secret name
    And the command should not skip, fall back to Mock, or report live success

  Scenario: A dedicated key stays inside the proxy process
    Given the provider account owner approved a dedicated project-scoped test key
    And the key is injected only into the loopback proxy process
    When the App calls the same-origin live-test endpoint
    Then the browser request should contain no vendor key or authorization value
    And the key should not appear in HTML, runtime metadata, query strings, storage, DOM, console, screenshots, videos, traces, or reports
    And the proxy should own vendor authentication, usage accounting, and stable redacted errors

  Scenario: Exact live-test activation is fail-closed
    Given server-side credential, provider, model, endpoint, and budget preflight succeeded
    When Asyra Design starts with exactly one "ai=live-test" value
    Then one generic HTTP provider should target the ready same-origin endpoint
    And the existing Agent panel, attachments, operational status, confirmation, and Message Bar should be reused
    When the query is duplicated, mixed, empty, unknown, or served without the ready capability
    Then live AI should remain disabled or settle as unavailable without a vendor request

  Scenario: A live model interprets the committed cat reference safely
    Given the user attaches the committed tabby reference image
    When the user asks in English to draw only the cat on a pure white background with the uploaded photo's exact width and height
    Then the selected real model should receive only the bounded attachment and provider-safe action context
    And the candidate should use only registered App actions
    And a generic request may first return the App-owned drawing-detail clarification without canvas mutation
    And provider-selected option labels, resource counts, warnings, raw reasoning, and unknown actions should be rejected

  Scenario: A live bounded creation executes through ordinary App owners
    When the live provider returns a bounded editable cat-face composition candidate
    Then the complete candidate should normalize and validate before permission or transaction work
    And execution should use the registered composition action and ordinary common APIs
    And the external request budget should not become an App item, path, point, payload, or composition ceiling
    And the mutating turn should create one outer transaction and one intended Undo action
    And schema-invalid, denied, cancelled, or failed candidates should create no accepted canonical prefix

  Scenario: A live follow-up changes only revalidated existing whiskers
    Given an editable cat-face composition exists with canonical semantic target hints
    When the user asks the live Agent to change the existing whiskers to blue
    Then only currently existing and permitted whisker ids should reach the provider-safe context
    And targets should be revalidated again immediately before mutation
    And unrelated elements and topology ids should remain unchanged
    And the turn should create one outer transaction and one intended Undo action
    And a missing target should not regenerate the complete composition

  Scenario: Confirmation and cancellation remain App-owned
    Given the live provider returns a registered confirmation-required action
    When the runtime requests confirmation
    Then the App should show a concise Allow or Deny impact request without chain-of-thought
    And no transaction should open while confirmation is pending
    And target ids should be revalidated after an Allow decision
    When the user denies, cancels, closes the App, or the session ends
    Then the wait and any provider request should settle without later mutation or a hidden Promise

  Scenario: Credential and provider failures are stable and redacted
    When the key is invalid or revoked, quota is exhausted, rate limiting occurs, the request times out, JSON is malformed, or the provider candidate is invalid
    Then the turn should settle with a stable owner stage and error code
    And no raw vendor body, SDK exception, authorization value, secret, action arguments, or chain-of-thought should be exposed
    And no failed preflight should create a transaction or Undo action

  Scenario: Formal live evidence is bounded and does not replace Mock authority
    When the explicitly authorized live matrix completes
    Then the report should contain only provider and model aliases, timing, scenario outcomes, request count, bounded usage and cost, stable errors, and canonical history summaries
    And the run should fail closed before exceeding any approved request, time, or spend limit
    And generated reports, screenshots, videos, and traces should remain ignored local artifacts
    And deterministic Mock and VTracer tests should remain merge-CI, exact visual, collaboration, and performance authority
    And the provider account owner should revoke the disposable key or apply the approved rotation policy
