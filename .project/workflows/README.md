# Universal Workflows Integration Guide

**Purpose**: Guide for AI agents to integrate and execute universal workflows in any IDE

## Overview

Asra project provides 4 universal workflows that guarantee consistent development process execution:

- **`/feature`** - New feature development with automatic CDD compliance
- **`/refactor`** - Code improvement while preserving functionality
- **`/bugfix`** - Systematic issue resolution with regression prevention
- **`/docs`** - Comprehensive documentation updates with quality standards

## Universal Compatibility

These workflows are designed to work in **any AI agent or IDE** that can:

1. **Read project files** from `.project/` directory
2. **Execute shell commands** like `npx openskills read <skill>`
3. **Follow markdown instructions** from workflow files
4. **Update project files** using standard file operations

**Compatible environments:**

- Claude Code ✅
- Cursor ✅
- Windsurf ✅
- GitHub Copilot ✅
- OpenCode ✅
- Any agent supporting custom workflows ✅

## Workflow Execution Pattern

### 1. Command Recognition

AI agents should recognize these patterns:

```bash
/feature User wants to delete selected elements
/refactor Get selected element API should return string array
/bugfix Rectangle tool creates elements at wrong position
/docs Update API documentation for new methods
```

### 2. Workflow Loading

When workflow command is detected:

1. **Parse command** - Extract workflow type and description
2. **Load workflow file** - Read corresponding `.project/workflows/<name>.md`
3. **Follow steps** - Execute workflow phases sequentially
4. **Load skills** - Automatically load specified skills at appropriate phases
5. **Apply patterns** - Follow CDD principles automatically

### 3. Skill Integration

Workflows automatically load skills based on context:

| Phase                   | Skill Loaded       | Purpose                 |
| ----------------------- | ------------------ | ----------------------- |
| All workflows (Phase 1) | `cdd-development`  | Architecture patterns   |
| Testing phases          | `e2e-testing`      | Testing best practices  |
| Documentation           | `skill-creator`    | Template creation       |
| Visual docs             | `brand-guidelines` | Brand standards         |
| Any documentation       | `internal-comms`   | Communication templates |

## Implementation Guide for AI Agents

### Step 1: Command Detection

```javascript
// Pseudocode for workflow detection
if (userInput.startsWith('/feature ')) {
  executeWorkflow('feature', userInput.substring(9))
} else if (userInput.startsWith('/refactor ')) {
  executeWorkflow('refactor', userInput.substring(10))
} else if (userInput.startsWith('/bugfix ')) {
  executeWorkflow('bugfix', userInput.substring(8))
} else if (userInput.startsWith('/docs ')) {
  executeWorkflow('docs', userInput.substring(6))
}
```

### Step 2: Workflow Execution

```javascript
function executeWorkflow(type, description) {
  // Load workflow specification
  const workflow = readFile(`.project/workflows/${type}.md`)

  // Parse and follow phases
  executePhases(workflow.phases, description)
}

function executePhases(phases, description) {
  phases.forEach((phase) => {
    // Load required skills
    if (phase.requiredSkills) {
      phase.requiredSkills.forEach((skill) => {
        executeShellCommand(`npx openskills read ${skill}`)
      })
    }

    // Execute phase steps
    executePhaseSteps(phase.steps, description)
  })
}
```

### Step 3: Skill Loading

```javascript
function loadSkill(skillName) {
  // Check if skill already loaded
  if (!isSkillLoaded(skillName)) {
    executeShellCommand(`npx openskills read ${skillName}`)
    markSkillAsLoaded(skillName)
  }
}
```

## Quality Assurance

### Workflow Validation

Before executing workflows, ensure:

- [ ] Project has `.project/workflows/` directory
- [ ] AI_ESSENTIALS.md is readable
- [ ] Required skills are available
- [ ] Build tools are accessible
- [ ] Git repository is properly initialized

### Execution Monitoring

During workflow execution:

1. **Track progress** - Log current phase and step
2. **Handle errors** - Follow workflow error handling procedures
3. **Validate outputs** - Ensure quality gates are met
4. **Document results** - Create appropriate documentation artifacts

## Error Handling

### Workflow Not Found

If workflow file doesn't exist:

1. **Inform user** - "Workflow not found: <name>"
2. **Suggest available** - List workflows in `.project/workflows/`
3. **Check permissions** - Verify read access to project files

### Skill Loading Failures

If skill can't be loaded:

1. **Continue workflow** - Use basic patterns from AI_ESSENTIALS.md
2. **Log issue** - Record which skill failed and why
3. **Document workaround** - Note manual steps taken

### Process Interruptions

If workflow is interrupted:

1. **Save state** - Document current phase and completed steps
2. **Create checkpoint** - Allow resuming from interruption point
3. **Provide recovery** - Offer options to continue or restart

## Integration Examples

### Example 1: Feature Development

```bash
User: /feature User wants to delete selected elements

AI Execution:
1. Load workflow: .project/workflows/feature.md
2. Phase 1: Load cdd-development skill automatically
3. Phase 2: Follow request-handling-workflow.md steps
4. Phase 4: Load e2e-testing skill for UI components
5. Execute CDD patterns for delete functionality
6. Output: Working feature with comprehensive tests
```

### Example 2: Code Refactoring

```bash
User: /refactor Convert direct calls to reactive events

AI Execution:
1. Load workflow: .project/workflows/refactor.md
2. Phase 1: Load cdd-development skill automatically
3. Phase 3: Convert direct calls to event patterns
4. Phase 5: Add regression tests
5. Output: Refactored code following CDD principles
```

## Best Practices

### For AI Agents

- **Always read workflows** - Don't rely on memory of workflow content
- **Follow steps exactly** - Don't skip or modify workflow phases
- **Load skills on-demand** - Only load when workflow specifies
- **Document exceptions** - Note any deviations and reasons
- **Validate completion** - Ensure all quality gates are met

### For Users

- **Be specific in descriptions** - Provide clear context for workflows
- **Use appropriate workflow** - /feature for new features, /bugfix for issues
- **Provide feedback** - Report workflow execution issues
- **Review outputs** - Verify workflow delivered expected results

## Troubleshooting

### Common Issues

1. **Workflows not loading**

   - Check file permissions on `.project/workflows/`
   - Verify workflow files have correct naming
   - Ensure markdown formatting is valid

2. **Skills not available**

   - Run `npx openskills list` to verify installation
   - Check `.claude/skills/` directory contents
   - Update skills catalog with `./scripts/update-skills.sh`

3. **Process inconsistencies**
   - Verify AI_ESSENTIALS.md is current
   - Check that request-handling-workflow.md exists
   - Ensure all dependencies are installed

### Support

If workflow execution fails:

1. **Check this guide** - Review integration steps
2. **Review workflow logs** - Identify specific failure point
3. **Consult AGENTS.md** - Verify protocol understanding
4. **Report issue** - Provide specific error details

---

**This integration guide ensures that universal workflows work consistently across all AI agents and development environments while maintaining Asra's Communication-Driven Development principles.**
