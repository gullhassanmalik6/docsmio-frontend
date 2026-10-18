import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-browser'

const features = [
  {
    title: 'Target-size image compression',
    copy: 'Enter kilobytes or megabytes. DocuFix searches JPEG and WebP quality, then scales the image only if the target is still missed. The page reports the real byte size.',
  },
  {
    title: 'Resize with an aspect lock',
    copy: 'Width and height start from the photo. The lock keeps the photo’s ratio. Turn it off when you need a different shape. Upscaling is off unless you allow it.',
  },
  {
    title: 'PDF compression with a straight answer',
    copy: 'Low mode rewrites the file and keeps selectable text. If that does not shrink it, there is no download pretending otherwise. Balanced and High rebuild pages as images and say that text selection is removed.',
  },
  {
    title: 'Merge, split, and watermark',
    copy: 'Put PDFs in the order you want, pull out a page range such as 1-3, 5, or stamp text on every page. Each one exports a new PDF.',
  },
  {
    title: 'Conversions that the browser can finish',
    copy: 'JPG, PNG, and WebP can move between each other. Images can become a PDF. Selected PDF pages can become PNG or JPG images. Word conversion stays unavailable.',
  },
  {
    title: 'A scan preview, not a transcript',
    copy: 'Use the camera or upload a photo, rotate or crop it, then download the image or a PDF. OCR reads the image in this browser. The transcript can contain mistakes and should be reviewed.',
  },
]

export function FeaturesPage() {
  usePageTitle('Features — DocuFix')
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">FEATURES</p>
      <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight">A smaller toolbox that tells the truth about the file</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        DocuFix is for the upload that has a size limit, a page limit, or a format rule. The ready tools run in the browser. The ones that would damage a document are marked unavailable.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-xl font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.copy}</p>
          </article>
        ))}
      </div>
      <Button className="mt-8" asChild>
        <Link to="/tools">Explore Tools</Link>
      </Button>
    </div>
  )
}
