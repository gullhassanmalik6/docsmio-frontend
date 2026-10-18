import { Link } from 'react-router-dom'
import { Notice } from '@/components/notice'
import { ToolFrame, ToolHeading } from '@/components/tool-heading'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-browser'
import { getTool } from '@/lib/tools'

export function UnavailableToolPage({ slug }: { slug: string }) {
  const tool = getTool(slug)
  usePageTitle(tool ? `${tool.title} — DocuFix` : 'Tool — DocuFix')

  if (!tool) {
    return (
      <ToolFrame>
        <h1 className="text-3xl font-semibold">Tool not found</h1>
      </ToolFrame>
    )
  }

  const detail =
    slug === 'pdf-to-word'
      ? 'DocuFix does not convert a PDF into an editable Word document. Extracting plain text would drop layout, fonts, and images, so this page will not rename the file or produce a download.'
      : 'DocuFix does not convert a Word document into a PDF. That needs a document engine, which is not installed, so this page will not accept a .docx upload or pretend a renamed file is a PDF.'

  return (
    <ToolFrame>
      <ToolHeading title={tool.title} description={tool.description} />
      <div className="rounded-3xl border border-white/10 bg-card p-6">
        <p className="text-lg font-semibold">This tool is not available yet</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p>
        <div className="mt-4">
          <Notice tone="warning">No file is processed here. Use a tool marked ready if you need an output today.</Notice>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/tools">Browse available tools</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/tools/convert">Open format converter</Link>
          </Button>
        </div>
      </div>
    </ToolFrame>
  )
}
