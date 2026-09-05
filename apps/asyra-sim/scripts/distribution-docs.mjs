import { lstatSync } from 'node:fs'
import path from 'node:path'

const escapeHtml = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Keep shipped links local; label unshipped references without assuming publication. */
export function rewriteDistributionMarkdown(
  text,
  sourceFile,
  targets,
  snapshot,
  commit
) {
  const destination = targets.get(sourceFile)
  if (!destination || !/^[a-f0-9]{40}$/.test(commit))
    throw new Error('Invalid documentation provenance.')
  return text.replace(
    /(!?)\[([^\]]+)\]\(([^)\s]+)\)/g,
    (original, image, label, href) => {
      if (href.startsWith('#')) return original
      if (/^https?:\/\//.test(href))
        return image
          ? original
          : `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
      const [filename, anchor] = href.split('#')
      const target = path.posix.normalize(
        path.posix.join(
          path.posix.dirname(sourceFile),
          decodeURIComponent(filename)
        )
      )
      if (target.startsWith('../') || path.isAbsolute(target))
        throw new Error(`Documentation target escapes source: ${href}`)
      const stat = lstatSync(path.join(snapshot, target))
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error(`Invalid documentation target: ${target}`)
      const local = targets.get(target)
      const suffix = anchor ? `#${anchor}` : ''
      if (local)
        return `${image}[${label}](${path.posix.relative(path.posix.dirname(destination), local)}${suffix})`
      if (image) throw new Error(`Unshipped documentation image: ${target}`)
      return `${label} (source-only reference: \`${target}${suffix}\` at \`${commit}\`; not included)`
    }
  )
}
