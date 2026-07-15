# Git Commit and Push Policy

This is the project-wide policy for AI-assisted local commits and remote Git
operations. It applies to framework, app, documentation, plan, and workflow
tasks.

## Branch Safety

- Never modify or commit on `main`.
- Start work from a feature branch based on the intended current base.
- Verify the current branch before staging or committing.
- Preserve unrelated user changes in a dirty worktree.

## Commit Authority

An agent may create local commits without requesting separate approval for each
commit when all of the following are true:

- the work is on a non-main feature branch;
- the commit closes one bounded implementation step, Inspector owner step,
  stage, or independently reviewable documentation stage;
- the scoped validation required by that step or stage has passed;
- the staged diff has been reviewed and contains only files belonging to that
  step or stage;
- the commit message identifies the completed behavior or contract.

Do not commit arbitrary work-in-progress, a known failing state, unrelated user
changes, transient diagnostics, secrets, or local test artifacts. A checkpoint
commit is allowed only when the task plan explicitly defines that checkpoint as
a coherent, reviewable stage with its own validation and stop condition.

Before every commit:

1. verify the current branch is not `main`;
2. inspect `git status --short`;
3. stage only the intended files;
4. inspect the staged file list and bounded staged diff;
5. confirm the step/stage gates and `git diff --check` pass;
6. create one cohesive commit;
7. report the commit hash and remaining worktree state.

## Push Authority

- A local commit never implies permission to push.
- Never push a branch, tag, or commit unless the user explicitly requests a
  remote action such as push, publish, or pull-request creation.
- A request to create a pull request authorizes only the minimum source-branch
  push required for that pull request, unless the user says not to push.
- Never force-push, rewrite remote history, publish a release, or merge a pull
  request without explicit user authorization for that operation.
- When push is not authorized, finish with local commits only and state clearly
  that nothing was pushed.

## History Safety

- Do not amend, squash, rebase, reset, prune, or otherwise rewrite commits that
  may already be shared unless the user explicitly authorizes the history
  operation.
- Prefer a new corrective commit over rewriting an existing commit.
- Main-branch integration remains a human-owned pull-request action unless the
  user explicitly requests an allowed remote operation.

## Workflow Handoff

At task handoff, report:

- local commit hashes created during completed stages;
- uncommitted files or unfinished stages, if any;
- validation status for each committed stage;
- confirmation that no push occurred unless one was explicitly requested.
