# /docs Workflow

**Purpose**: Update and maintain project documentation systematically with consistent formatting and comprehensive coverage

## Usage

```bash
/docs <documentation-task>
```

Example:

```bash
/docs Update API documentation for new scene tree methods
/docs Create user guide for element selection features
/docs Update architecture documentation with new event patterns
/docs Add troubleshooting guide for common issues
/docs Create onboarding guide for new developers
```

## Pre-requisites

- Must have read `AI_ESSENTIALS.md` (loaded automatically)
- Must follow existing documentation standards
- Must maintain consistency with current format
- Must ensure accuracy and completeness

## Workflow Steps

### Phase 1: Documentation Analysis (Automatic)

1. **Load Relevant Skills**: Automatically load appropriate skills based on documentation type
2. **Parse Request**: Understand what documentation needs updating
3. **Identify Target**: Determine which docs need changes (API, architecture, user guides)
4. **Assess Scope**: Evaluate impact on other documentation
5. **Plan Structure**: Define organization and flow

### Phase 2: Content Planning

1. **Review Existing Docs**: Analyze current state and identify gaps
2. **Create Outline**: Structure new content logically
3. **Define Templates**: Use appropriate `.project/templates/` formats
4. **Plan Examples**: Identify code examples and diagrams needed
5. **Cross-Reference Plan**: Link to related documentation

### Phase 3: Content Creation

1. **Write Core Content**: Create main documentation text
2. **Add Code Examples**: Include practical, tested examples
3. **Add Diagrams**: Create architectural flow diagrams if needed
4. **Include Troubleshooting**: Add common issues and solutions
5. **Add Cross-References**: Link to related documentation

### Phase 4: Quality Assurance

1. **Accuracy Check**: Verify all technical details are correct
2. **Completeness Review**: Ensure all aspects are covered
3. **Consistency Check**: Maintain format and terminology consistency
4. **Example Testing**: Verify all code examples work
5. **Link Validation**: Check all cross-references work

### Phase 5: Integration & Updates

1. **Update Navigation**: Update table of contents and navigation
2. **Sync Related Docs**: Update cross-referenced documentation
3. **Update Summaries**: Ensure abstracts reflect current content
4. **Update Changelog**: Add documentation changes to changelog
5. **Version Control**: Commit with clear documentation messages

### Phase 6: Accessibility & Usability

1. **Readability Review**: Ensure content is easy to understand
2. **Searchability Check**: Verify content can be found easily
3. **Format Validation**: Check markdown/rendering works correctly
4. **Multi-device Testing**: Ensure docs work on different screen sizes
5. **Print Testing**: Verify printable versions work well

## Documentation Types & Standards

### 1. API Documentation

````markdown
# API: Scene Tree Operations

## Methods Overview

### addRectangle(data: RectangleData, inUndoRedo: boolean): string

Adds a new rectangle element to the scene tree.

**Parameters:**

- `data`: RectangleData - Position, size, and properties of rectangle
- `inUndoRedo`: boolean - Whether action should be recorded for undo

**Returns:**

- `string` - Unique ID of created element

**Example:**

```typescript
const elementId = core.requests.sceneTree.addRectangle(
  {
    position: { x: 100, y: 100 },
    size: { width: 50, height: 50 }
  },
  true
)
```
````

**Events Published:**

- `addElement` - When element is successfully added

````

### 2. Architecture Documentation
```markdown
# Communication-Driven Development (CDD)

## Core Principles

### Event-Driven Communication
All packages communicate via typed events in `@asra/reactive-events`. No direct function calls between packages.

### Request-Response Pattern
Synchronous operations use dependency injection via request APIs in `@asra/core`.

### Transaction Management
All state changes must support undo/redo through `@asra/factory`.

## Package Structure

### System Layer
- `@asra/core`: System orchestrator with request APIs
- `@asra/interaction-core`: Decision-making engine
- `@asra/reactive-events`: Event communication system

[Continue with detailed package descriptions...]
````

### 3. User Guides

```markdown
# Getting Started Guide

## Creating Your First Element

1. **Select Drawing Tool**: Click the rectangle tool in the toolbar
2. **Draw Element**: Click and drag on canvas to create rectangle
3. **Edit Properties**: Select element to see properties panel
4. **Save Work**: Changes are automatically saved

## Common Tasks

### Selecting Elements

- Click element to select
- Shift+click for multi-select
- Escape to deselect

### Keyboard Shortcuts

- `Cmd/Ctrl + Z`: Undo
- `Cmd/Ctrl + Shift + Z`: Redo
- `Delete`: Remove selected elements
```

## Required Skills Loading

This workflow automatically loads these skills based on documentation type:

- **`skill-creator`**: When creating new documentation templates
- **`brand-guidelines`**: When creating visual documentation or presentations
- **`theme-factory`**: When styling documentation artifacts
- **`internal-comms`**: When creating internal communications
- **`webapp-testing`**: When documenting testing procedures

## Quality Gates

Before completing documentation, ensure:

- [ ] All technical information is accurate
- [ ] Code examples are tested and work
- [ ] Cross-references are correct and up-to-date
- [ ] Formatting follows project standards
- [ ] Content is complete and comprehensive
- [ ] Navigation and structure are logical
- [ ] All links work correctly
- [ ] Documentation is accessible and readable

## Documentation Templates

### API Documentation Template

Located in: `.project/templates/api-doc-template.md`

### User Guide Template

Located in: `.project/templates/user-guide-template.md`

### Architecture Doc Template

Located in: `.project/templates/architecture-doc-template.md`

## Integration with Existing Tools

This workflow integrates with:

- `handoff-ai` commands for documentation updates
- `.project/templates/` for consistent formatting
- Existing documentation structure
- Current version control system
- Documentation hosting platforms

## Content Management

### Version Control

- Each documentation change in separate commit
- Clear commit messages describing documentation changes
- Branch for documentation updates if extensive changes
- Pull requests for review before merging

### Review Process

1. **Technical Review**: Verify technical accuracy
2. **User Experience Review**: Check clarity and usability
3. **Editorial Review**: Ensure consistency and style
4. **Integration Review**: Verify cross-references and navigation

## Expected Output

- **Accurate documentation** reflecting current system state
- **Consistent formatting** following project standards
- **Complete coverage** of all documented topics
- **Working cross-references** to related documentation
- **Usable content** for target audience
- **Updated navigation** reflecting new structure

---

**This workflow ensures that all documentation updates are systematic, accurate, and maintain high quality standards while integrating seamlessly with existing project structure.**
