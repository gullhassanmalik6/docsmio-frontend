import { Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks/use-browser'

const questions = [
  {
    q: 'Where do my files go?',
    a: 'Ready tools read them in this browser and give you a new download. They are not uploaded for those tools.',
  },
  {
    q: 'Why did PDF compression not get smaller?',
    a: 'Low mode only rewrites the PDF container. If the images inside were already compressed, the size stays put and Docsmio will not pretend otherwise. Balanced and High rebuild pages as images and remove selectable text.',
  },
  {
    q: 'Can I turn a PDF into Word?',
    a: 'No. Those pages do not accept a file and do not produce a renamed download. There is no reliable Word conversion engine in this version.',
  },
  {
    q: 'Does scan read the text?',
    a: 'The scan tool reads text in this browser with Tesseract.js. Review it, because OCR can be wrong. That scan is not uploaded. Online images can save a transcript to your account only after you choose Read image text. PDF text extraction uses the embedded text and does not send the file to an external AI service.',
  },
  {
    q: 'Do I need an account?',
    a: 'The tools and the local document library work without an account. Signing in stores your name, email, and file-history metadata. A document is uploaded only when you explicitly copy it to the online library.',
  },
]

export function HelpPage() {
  usePageTitle('Help — Docsmio')
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Help & Support</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Limits are part of the product. If a control cannot do something, the page should say that instead of returning a broken file.
      </p>
      <div className="mt-6 space-y-3">
        {questions.map((item) => (
          <article key={item.q} className="rounded-2xl border border-white/10 bg-card p-4">
            <h2 className="font-semibold">{item.q}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.a}</p>
          </article>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Read the <Link className="text-primary" to="/privacy">privacy notes</Link> or go back to <Link className="text-primary" to="/tools">tools</Link>.
      </p>
    </div>
  )
}
