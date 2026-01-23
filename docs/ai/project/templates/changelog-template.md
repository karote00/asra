# Changelog Update Guidelines

This template provides guidelines for updating the main `CHANGELOG.md` file in the root directory.

## How to Update the Changelog

When working on any feature or fix, you MUST update the `CHANGELOG.md` file by adding your changes under the `## [Unreleased]` section.

### Step-by-Step Process

1. **Open `CHANGELOG.md`** in the root directory
2. **Find the `## [Unreleased]` section** at the top
3. **Add your changes** under the appropriate category
4. **Use present tense** and describe from user perspective
5. **Include breaking changes** with `[BREAKING]` prefix

### Categories to Use

Add your changes under the appropriate subsection:

#### Added
- New features, components, or functionality
- New API endpoints or methods
- New configuration options
- New dependencies

#### Changed
- Changes in existing functionality
- API modifications (breaking or non-breaking)
- Performance improvements
- Refactoring that affects behavior

#### Deprecated
- Features that are still available but will be removed in future versions
- APIs that should no longer be used

#### Removed
- Features, APIs, or functionality that has been removed
- Dependencies that are no longer used

#### Fixed
- Bug fixes
- Security vulnerabilities addressed
- Performance issues resolved

#### Security
- Security improvements
- Vulnerability patches
- Authentication/authorization changes

## Writing Guidelines

1. **Write for users**: Describe changes from the user's perspective, not implementation details
2. **Be specific**: Include component names, API endpoints, or feature names
3. **Group related changes**: Combine similar changes under one bullet point when appropriate
4. **Use present tense**: "Add support for..." not "Added support for..."
5. **Include breaking changes**: Clearly mark any breaking changes with `[BREAKING]` prefix

## Example Updates

### Good Examples

```markdown
## [Unreleased]

### Added
- Rectangle tool with keyboard shortcut (R key) for creating rectangular shapes
- Shift modifier support for creating perfect squares
- Alt modifier support for center-based rectangle creation

### Changed
- [BREAKING] Input system now requires explicit event registration
- Improved selection feedback with better visual indicators

### Fixed
- Fixed issue where rectangle creation would fail on rapid clicks
- Resolved memory leak in event listener cleanup
```

### Bad Examples

```markdown
### Added
- Updated InputSystem.ts (too technical, not user-focused)
- Fixed stuff (too vague)
- Refactored code (implementation detail, not user-facing)
```

## Merge Conflicts

If you encounter merge conflicts in `CHANGELOG.md`:

1. **Keep both sets of changes** - don't overwrite others' entries
2. **Maintain chronological order** within each category
3. **Resolve conflicts by combining entries** under the `[Unreleased]` section
4. **Ask for help** if unsure about how to resolve conflicts

## Release Process

When preparing a release:

1. **Change `[Unreleased]` to version number** and date
2. **Add new `[Unreleased]` section** at the top
3. **Review all entries** for accuracy and completeness
4. **Group related changes** if needed for clarity

This ensures the changelog is always up-to-date and ready for the next release.