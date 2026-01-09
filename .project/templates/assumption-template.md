# Assumption Template

When adding new assumptions to `.project/ASSUMPTIONS.md`, use this format:

```markdown
### [Category] - [Date] - [AI Session ID]

**Assumption**: [What was assumed]
**Reasoning**: [Why this assumption was made]
**Evidence**: [Code patterns or industry standards that support this]
**Confidence**: [High/Medium/Low]
**Review Priority**: [Critical/Important/Nice-to-have]
**Status**: [Active/Reviewed/Corrected]
```

## Categories

Use these standard categories:
- **Architecture Decisions**: System design choices, patterns, frameworks
- **Design Principles**: UI/UX guidelines, visual standards
- **API Behaviors**: Endpoint design, data formats, error handling
- **Implementation Patterns**: Code organization, naming conventions, best practices
- **Business Logic**: Feature requirements, user workflows
- **Performance**: Optimization choices, resource usage decisions
- **Security**: Authentication, authorization, data protection

## Status Values

- **Active**: Currently being used as guidance
- **Reviewed**: Human has confirmed this assumption
- **Corrected**: Human has provided different guidance
- **Updated**: Assumption has been refined based on new information