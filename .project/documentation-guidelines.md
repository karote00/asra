# Documentation Content Guidelines

These guidelines ensure that our Markdown documentation is clear, consistent, and optimized for both human readability and AI-driven retrieval via `context-rag`.

## 1. File Naming and Location

*   **Descriptive Names:** Use clear, descriptive filenames (e.g., `user-authentication-epic.md`, `create-rectangle-golden-path.md`).
*   **Logical Grouping:** Store files in their respective logical directories within `.project/` (e.g., `epics/`, `features/`, `golden-paths/`, `frontend-apis/`).

## 2. Content Structure within Files

*   **Clear Headings:** Always start with a top-level heading (`# Title`) for the document's main topic. Use subsequent headings (`## Section`, `### Subsection`) to structure content logically.
*   **Conciseness:** Keep sections and paragraphs focused. Break down complex topics into smaller, digestible chunks.
*   **Focused Files:** If a single topic becomes very long, consider splitting it into multiple, more focused Markdown files. This improves human scannability and helps `context-rag` retrieve more precise context.
*   **Introduction:** Start each document with a brief introduction summarizing its purpose and scope.

## 3. Metadata (Optional but Recommended)

Consider adding YAML front matter at the top of your Markdown files for metadata. This can aid future tooling and `context-rag`'s understanding.

```yaml
---
title: "Descriptive Document Title"
description: "A brief summary of the document's content."
tags: ["tag1", "tag2", "category"]
keywords: ["keyword1", "keyword2"]
---
```

## 4. Language and Style

*   **Clarity:** Use clear, unambiguous language. Avoid jargon where simpler terms suffice.
*   **Consistency:** Maintain a consistent tone and style across all documentation.
*   **Code Examples:** Use Markdown code blocks for all code examples, specifying the language (e.g., ````typescript`, ````bash`).

## 5. Cross-referencing

*   **Internal Links:** Use relative Markdown links to refer to other documents within the `.project/` directory (e.g., `[Related Epic](../epics/some-epic.md)`).
