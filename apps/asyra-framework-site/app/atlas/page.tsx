import type { Metadata } from 'next'
import { RuntimeAtlas } from '@/components/runtime-atlas'

export const metadata: Metadata = {
  title: 'Runtime Atlas',
  description:
    'Operate six real Asyra browser cases and inspect intent, ownership, transactions, canonical state, optional composition, projections, and failure evidence.'
}

export default function RuntimeAtlasPage() {
  return <RuntimeAtlas />
}
