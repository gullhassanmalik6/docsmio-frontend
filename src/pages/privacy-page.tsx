import { Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks/use-browser'

export function PrivacyPage() {
  usePageTitle('Privacy — DocuFix')
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy notes</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
        <p>Image resize, PDF merge, split, watermark, and the enabled conversions run in your browser. The file you pick is not uploaded for those tools.</p>
        <p>My Files keeps downloadable outputs in this browser. If you are signed in, DocuFix can also save a history record with the filename, operation, and sizes. That record cannot be downloaded from the server because the file is not stored there.</p>
        <p>Pricing buttons do not start a payment. OCR reads an image in this browser and does not upload the photo or the transcript.</p>
        <p>DocuFix does not add analytics that record document contents. File names you type, such as an export name, stay on the device with the output.</p>
        <p>
          Questions about a limit belong on the <Link className="text-primary" to="/help">help page</Link>.
        </p>
      </div>
    </div>
  )
}
