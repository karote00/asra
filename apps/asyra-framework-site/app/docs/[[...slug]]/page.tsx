import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DocsChrome } from '@/components/docs-chrome'
import { loadContentBundle, pageForSlug } from '@/lib/content'

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return loadContentBundle().pages.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({
  params
}: DocsPageProps): Promise<Metadata> {
  const { slug = [] } = await params
  const page = pageForSlug(loadContentBundle(), slug)
  if (!page) return { title: 'Documentation not found' }
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.route }
  }
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug = [] } = await params
  const bundle = loadContentBundle()
  const page = pageForSlug(bundle, slug)
  if (!page) notFound()
  return <DocsChrome bundle={bundle} page={page} />
}
