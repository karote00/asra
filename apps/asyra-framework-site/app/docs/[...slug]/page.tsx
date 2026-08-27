import {
  DocumentationPage,
  getDocumentationMetadata
} from '@/components/docs-page'
import type { VerifiedPublicContent } from '@/lib/content'
import { loadVerifiedPublicContent } from '@/lib/content.mjs'

// Every slug maps through the public content manifest to Markdown under the
// repository-root `docs/public` directory; page bodies do not live here.
export const dynamicParams = false

const loadContent = async (): Promise<VerifiedPublicContent> =>
  loadVerifiedPublicContent()

const pageIdFromSlug = (slug: readonly string[]) => slug.join('/')

export async function generateStaticParams() {
  const { pages } = await loadContent()
  return pages.flatMap(({ id }) =>
    id === 'overview' ? [] : [{ slug: id.split('/') }]
  )
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  return getDocumentationMetadata(pageIdFromSlug(slug))
}

export default async function DocumentationDetailPage({
  params
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  return <DocumentationPage pageId={pageIdFromSlug(slug)} />
}
