'use client'

import { useState } from 'react'

export function CopyMarkdownButton({ markdown }: { markdown: string }) {
  const [status, setStatus] = useState('Copy Markdown')

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(markdown)
    setStatus('Copied')
    window.setTimeout(() => setStatus('Copy Markdown'), 1800)
  }

  return (
    <button className="docs-tool" onClick={copyMarkdown} type="button">
      {status}
    </button>
  )
}
