# AI Agent Workflow

Use this sequence for every coding request in this project.

1. Restate one observable objective.
2. Name the owner paths you may change and the behavior that must stay fixed.
3. Read only the relevant local guide and linked upstream Framework contract.
4. For a bug, run the existing formal test first; if it misses the failure, add
   a failing regression test before production code.
5. Implement at the first incorrect owner boundary in a small slice.
6. Run the focused test, typecheck/build as applicable, then the documented App
   gates.
7. Review only the final diff, direct consumers, and the fixed checks. Report
   unrelated findings without silently expanding the task.

Before editing, answer these questions:

- Is this Framework mechanics, Preset defaults, App domain behavior, or service
  policy?
- Which Feature accepts the intent?
- Which common API owns the mutation or query?
- What is the intended transaction and undo boundary?
- Which schema validates runtime writes and loaded data?
- Which projection observes the canonical result?
- What formal test would fail if this behavior regressed?

Do not ask an agent to "improve the whole architecture". Give it one product
behavior, its owner guide, explicit exclusions, and the required checks.
