# Skills Catalog

**Available AI Agent Skills** - Expert capabilities for enhanced development workflow

## Overview

This catalog contains specialized skills that extend AI agent capabilities. Skills are loaded on-demand to provide domain expertise and best practices.

## Quick Reference

- **Load skill**: `npx openskills read <skill-name>`
- **List all**: `npx openskills list`
- **Update catalog**: `npx openskills sync -y --output .project/SKILLS.md`

## Available Skills

### Core Development

#### git-operations

**Purpose**: Enforce git/gh CLI separation rule for version control operations  
**When to use**: Any git operations, commits, branch management, PR creation  
**Key principle**: Use `git` for local operations, `gh` for GitHub PR operations only

#### frontend-design

**Purpose**: Create production-grade frontend interfaces with high design quality  
**When to use**: React components, web pages, dashboards, UI styling  
**Avoids**: Generic AI aesthetics in favor of polished, creative design

#### webapp-testing

**Purpose**: Test local web applications using Playwright  
**When to use**: Frontend verification, UI debugging, screenshots, browser logs  
**Capabilities**: Form interaction, navigation testing, responsive validation

#### mcp-builder

**Purpose**: Build high-quality MCP servers for external service integration  
**When to use**: Creating MCP servers in Python (FastMCP) or Node/TypeScript  
**Covers**: Tool design, authentication, error handling

### Design & Theming

#### brand-guidelines

**Purpose**: Apply Anthropic's official brand colors and typography  
**When to use**: Artifacts needing Anthropic look-and-feel, visual formatting  
**Includes**: Color schemes, typography, design standards

#### theme-factory

**Purpose**: Style artifacts with professional themes  
**When to use**: Slides, docs, reports, landing pages  
**Features**: 10 preset themes + custom theme generation

#### algorithmic-art

**Purpose**: Create generative art using p5.js with seeded randomness  
**When to use**: Algorithmic art, flow fields, particle systems  
**Note**: Create original works, avoid copyright violations

### Productivity & Communication

#### internal-comms

**Purpose**: Write professional internal communications  
**When to use**: Status reports, leadership updates, newsletters, FAQs  
**Formats**: Company-preferred communication templates

#### skill-creator

**Purpose**: Create new skills for extending AI capabilities  
**When to use**: Building custom workflows, domain expertise  
**Includes**: Skill structure, validation, best practices

#### template

**Purpose**: Placeholder skill template  
**When to use**: Starting point for new skill creation

## Usage Workflow

1. **Identify task** - Determine what you need to accomplish
2. **Check catalog** - See if a relevant skill exists
3. **Load skill** - Run `npx openskills read <skill-name>`
4. **Follow guidance** - Use skill instructions for best practices
5. **Execute task** - Apply expertise to complete work

## Managing Skills

### Installation

```bash
# From marketplace
npx openskills install <repo-name>

# Local development
npx openskills install ./local-skill

# Update catalog
npx openskills sync -y --output .project/SKILLS.md
```

### Removal

```bash
npx openskills remove <skill-name>
```

### Creation

```bash
npx openskills read skill-creator  # Learn to build skills
```

## Integration with AGENTS.md

The main AGENTS.md file references this catalog. AI agents should:

1. Read AGENTS.md for core protocol
2. Check this SKILLS.md for available capabilities
3. Load specific skills when needed for tasks

## Philosophy

Skills follow **progressive disclosure**:

- **Lightweight** - Only loaded when needed
- **Specialized** - Domain-specific expertise
- **Reusable** - Consistent patterns across projects
- **Versioned** - Skills can be updated independently

This keeps AI agents focused while providing instant access to expert knowledge when required.

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: `npx openskills read <skill-name>` (run in your shell)
  - For multiple: `npx openskills read skill-one,skill-two`
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>algorithmic-art</name>
<description>Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original algorithmic art rather than copying existing artists' work to avoid copyright violations.</description>
<location>project</location>
</skill>

<skill>
<name>brand-guidelines</name>
<description>Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.</description>
<location>project</location>
</skill>

<skill>
<name>frontend-design</name>
<description>Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.</description>
<location>project</location>
</skill>

<skill>
<name>git-operations</name>
<description>Enforce git/gh CLI separation rule for version control operations</description>
<location>project</location>
</skill>

<skill>
<name>internal-comms</name>
<description>A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.).</description>
<location>project</location>
</skill>

<skill>
<name>mcp-builder</name>
<description>Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).</description>
<location>project</location>
</skill>

<skill>
<name>skill-creator</name>
<description>Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.</description>
<location>project</location>
</skill>

<skill>
<name>template</name>
<description>Replace with description of the skill and when Claude should use it.</description>
<location>project</location>
</skill>

<skill>
<name>theme-factory</name>
<description>Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact that has been creating, or can generate a new theme on-the-fly.</description>
<location>project</location>
</skill>

<skill>
<name>webapp-testing</name>
<description>Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.</description>
<location>project</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
