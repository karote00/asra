import {
  DocumentationPage,
  getDocumentationMetadata
} from '@/components/docs-page'

export const generateMetadata = () => getDocumentationMetadata('overview')

export default function DocumentationRootPage() {
  return <DocumentationPage pageId="overview" />
}
