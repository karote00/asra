# Project Templates

This directory contains all template files used throughout the project to maintain consistency and provide guidance for documentation and development processes.

## Available Templates

### `changelog-template.md`
Guidelines for updating the main `CHANGELOG.md` file in the root directory.
- **Usage**: Referenced in AGENTS.md step 10
- **Format**: Keep a Changelog standard
- **Purpose**: Provide guidelines for updating the single changelog file with user-facing changes

### `epic-template.md`
Template for creating new epic files in collaborative workflows.
- **Usage**: When creating new epics in `docs/ai/project/epics/`
- **Format**: Structured epic documentation
- **Purpose**: Standardize epic creation and tracking

### `assumption-template.md`
Template for documenting AI assumptions in the assumptions log.
- **Usage**: Referenced in `docs/ai/project/ASSUMPTIONS.md`
- **Format**: Structured assumption documentation
- **Purpose**: Track and review AI-made decisions

## Usage Guidelines

1. **Always use templates**: Don't create documentation from scratch when a template exists
2. **Follow the format**: Templates ensure consistency across the project
3. **Update templates**: If you find a template needs improvement, update it here
4. **Reference correctly**: Always reference templates with full path (e.g., `docs/ai/project/templates/changelog-template.md`)

## Adding New Templates

When adding new templates:
1. Create the template file in this directory
2. Add documentation to this README
3. Update relevant process documentation to reference the new template
4. Follow the naming convention: `[purpose]-template.md`