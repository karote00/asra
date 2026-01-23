# AI Skills & Capabilities

This directory contains reusable AI agent skills and capabilities that can be loaded on-demand for specialized tasks.

## 🎯 Available Skills

### Core Development Skills

- **refactor.md** - Systematic code refactoring with architecture patterns
- **add-feature.md** - End-to-end feature development with CDD compliance
- **review-pr.md** - Pull request review and quality assessment

### Specialized Skills

- **git-operations** - Git/gh CLI separation and best practices
- **frontend-design** - Production-grade UI component design
- **webapp-testing** - Playwright-based application testing
- **mcp-builder** - MCP server creation and integration

## 🚀 Usage

### Loading a Skill

```bash
# List available skills
npx openskills list

# Load a specific skill
npx openskills read <skill-name>
```

### Skill Integration

Skills are designed to be:

- **Modular**: Load only what you need
- **Composable**: Combine multiple skills for complex tasks
- **Reusable**: Cross-project compatible patterns
- **Versioned**: Independent updates and maintenance

## 📋 Skill Structure

Each skill follows this pattern:

- **Purpose**: Clear objective and domain
- **Prerequisites**: Required tools or context
- **Usage**: Step-by-step guidance
- **Examples**: Practical implementation patterns
- **Integration**: How to combine with other skills

## 🔄 Management

### Update Skills Catalog

```bash
./scripts/update-skills.sh
```

### Add New Skills

1. Create skill file in this directory
2. Follow the established structure
3. Update this README
4. Run skills catalog sync

## 📚 Related Documentation

- **[Project Architecture](../project/ARCHITECTURE.md)** - Technical context
- **[Development Workflows](../workflows/)** - Process automation
- **[AI Essentials](../project/AI_ESSENTIALS.md)** - Core guidelines
