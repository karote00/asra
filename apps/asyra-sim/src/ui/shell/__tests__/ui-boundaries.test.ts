import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'

const ui = fileURLToPath(new URL('../../', import.meta.url))

const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name)

    return entry.isDirectory() ? files(filename) : [filename]
  })

it('keeps canonical runtime and persistence calls out of TSX views', () => {
  const violations: string[] = []

  for (const filename of files(ui).filter((file) => file.endsWith('.tsx'))) {
    const source = ts.createSourceFile(
      filename,
      readFileSync(filename, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        /^(runtime|session)\./.test(node.expression.getText(source))
      ) {
        violations.push(
          `${path.relative(ui, filename)}: ${node.expression.getText(source)}`
        )
      }

      ts.forEachChild(node, visit)
    }

    visit(source)
  }

  expect(violations).toEqual([])
})

it('keeps Tailwind as the component styling system with only base and theme CSS', () => {
  const cssFiles = files(ui)
    .filter((file) => file.endsWith('.css'))
    .map((file) => path.relative(ui, file))
    .sort()

  expect(cssFiles).toEqual(['styles/index.css', 'styles/theme.css'])

  expect(readFileSync(path.join(ui, 'styles/index.css'), 'utf8')).toContain(
    "@import 'tailwindcss'"
  )

  expect(readFileSync(path.join(ui, 'styles/theme.css'), 'utf8')).toContain(
    '@theme inline'
  )
})
