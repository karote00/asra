import {
  DocumentationPage,
  getDocumentationMetadata
} from '@/components/docs-page'

// Docs content is loaded from the repository-root `docs/public` directory,
// not from a content directory inside `apps/asyra-framework-site`.
export const generateMetadata = () => getDocumentationMetadata('overview')

export default function DocumentationRootPage() {
  return <DocumentationPage pageId="overview" />
}
