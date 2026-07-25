Feature: Optional AI agent runtime
  As an Asyra Design user
  I want natural-language actions to follow ordinary app and framework boundaries
  So that AI planning cannot bypass validation, permission, undo, collaboration, or cleanup

  Background:
    Given Asyra Design owns the AI Feature lifecycle
    And the app owns context, actions, schemas, permission, confirmation, and transaction adapters
    And deterministic providers require no live API key

  Scenario: AI-disabled startup has zero AI side effects
    Given AI activation is disabled
    When Asyra Design starts
    Then no AI runtime or provider is constructed
    And no AI Feature, network request, secret read, listener, or timer is created

  Scenario: Provider-disabled invocation fails before planning
    Given AI activation is enabled
    And the provider composition is disabled
    When the AI Feature receives natural-language intent
    Then the Feature returns an unavailable result
    And context collection and provider transport are not invoked
    And canonical state is unchanged

  Scenario: Action registration is deterministic and duplicate-safe
    Given the app registers two schema-backed actions in order
    When the runtime lists provider-safe action descriptions
    Then the descriptions preserve successful registration order
    And registering a duplicate name fails without replacing the original action

  Scenario: Unknown or schema-invalid action rejects the complete plan
    Given the provider returns a multi-action candidate plan
    And one action is unknown or has invalid arguments
    When the runtime validates the complete plan
    Then the complete plan is rejected before permission or confirmation
    And no action executor or transaction runner is invoked
    And no valid canonical prefix is applied

  Scenario: Permission denial rejects the complete plan
    Given every candidate action is registered and schema-valid
    And the app permission policy denies one action
    When the runtime completes permission preflight
    Then the complete plan is denied before confirmation or transaction execution
    And canonical state is unchanged

  Scenario: Required confirmation can be accepted or cancelled
    Given every candidate action is registered, schema-valid, and allowed
    And the app policy requires confirmation
    When the app receives one immutable complete preview
    Then accepting opens one plan transaction
    But cancelling returns a no-mutation result

  Scenario: Valid multi-action plan creates one undo commit
    Given a complete plan has several registered schema-valid allowed actions
    And any required confirmation is accepted
    When the app transaction runner executes the plan
    Then every app action executor runs in plan order
    And the executors mutate only through app common or public APIs
    And the accepted plan creates one intended undo commit

  Scenario: Executor failure rolls back without a canonical prefix
    Given a confirmed plan is executing inside one transaction
    And a later app action executor fails
    When the transaction runner settles
    Then every rollbackable write from the plan is reversed
    And no normal undo commit or accepted canonical prefix remains

  Scenario: Provider failure retry is bounded and transaction-safe
    Given the provider fails with a retryable redacted error
    And the runtime retry policy allows one additional attempt
    When planning is retried
    Then only provider planning is repeated
    And no transaction or action executor is repeated
    And an exhausted failure returns a stable redacted result

  Scenario: Abort timeout and disposal clean request resources
    Given provider planning or action orchestration is in flight
    When the Feature aborts, the provider times out, or the runtime is disposed
    Then request-owned timers, listeners, retry state, and intermediate values are released
    And no later post-abort mutation is applied
    And Feature System remains the sole lifecycle owner

  Scenario: Secret values are redacted from failures and audit output
    Given provider input or failures contain authorization, token, API key, or configured secret fields
    When the runtime returns preview, audit, explanation, or failure output
    Then secret values are recursively redacted
    And raw provider bodies and credentials are not returned
    And the detached output cannot mutate canonical state

  Scenario: Runtime instances remain isolated
    Given two app-owned AI runtime instances
    When each instance registers actions and performs planning
    Then registry, provider, policy, abort, timeout, retry, audit, and disposal state do not cross instances

  Scenario: Collaboration uses the ordinary canonical publication route
    Given Asyra Design already enabled Collaboration
    And an accepted app action uses its ordinary shared mutation options
    When the AI plan transaction commits
    Then Factory emits the ordinary shared publication
    And Collaboration uses the unchanged transport-only route
    And AI runtime owns no dedupe, permission, conflict, or reconnect policy

  Scenario: Generic HTTP and fake providers are replaceable
    Given the runtime uses the public provider contract
    When the app selects a deterministic fake provider or generic HTTP provider
    Then registry, preflight, transaction, action, and result contracts are unchanged
    And formal tests require no live endpoint or API key
