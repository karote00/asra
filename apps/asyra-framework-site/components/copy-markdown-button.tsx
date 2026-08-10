'use client'

import { Check, Clipboard, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

interface CopyMarkdownButtonProps {
  markdown: string
}

export function CopyMarkdownButton({ markdown }: CopyMarkdownButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  let label = 'Copy as Markdown'
  let icon = <Clipboard aria-hidden="true" size={17} />
  if (status === 'copied') {
    label = 'Markdown copied'
    icon = <Check aria-hidden="true" size={17} />
  }
  if (status === 'failed') {
    label = 'Copy unavailable'
    icon = <TriangleAlert aria-hidden="true" size={17} />
  }

  return (
    <button className="copy-markdown" onClick={copy} type="button">
      {icon}
      <span aria-live="polite">{label}</span>
    </button>
  )
}
