export type Article = {
  slug: string
  title: string
  excerpt: string
  date: string
  minutes: number
  paragraphs: string[]
}

export const articles: Article[] = [
  {
    slug: 'hit-a-file-size-limit',
    title: 'How to hit a file size limit without guessing',
    excerpt: 'Portals ask for 200 KB or 1 MB. The useful part is knowing whether the exported file actually landed under that number.',
    date: '14 October 2026',
    minutes: 4,
    paragraphs: [
      'Most upload forms care about one number: the size of the file you attach. They rarely tell you how much quality you will lose to get there. A useful compressor shows the original, the target, and the size of the file it actually produced.',
      'For photos, JPEG and WebP can trade quality for size. PNG usually cannot, because it is built for sharp graphics rather than photographs. If a PNG will not fit, converting it to JPEG is an honest next step, not a hidden one.',
      'Dimensions matter as much as the quality slider. A 4000 pixel photo can miss a 200 KB target even at a low quality setting. DocuFix starts from the size you enter, then reduces quality, and only then scales the image down if the target is still out of reach. The note on the page tells you when that happened.',
      'Keep the original. The export is a new file. If the portal rejects it, you still have the photo you started with and can try a different target.',
    ],
  },
  {
    slug: 'what-pdf-compression-can-do',
    title: 'What PDF compression can and cannot promise',
    excerpt: 'Re-saving a PDF is not the same thing as making it smaller. The difference matters when the form still rejects the upload.',
    date: '14 October 2026',
    minutes: 5,
    paragraphs: [
      'A PDF is a container. It may hold selectable text, fonts, vector drawings, and images that were already compressed. Saving that container again often changes nothing important about the file size.',
      'DocuFix Low compression rewrites the PDF structure and keeps selectable text. If the file does not get smaller, the page says so and does not offer a fake compressed download.',
      'Balanced and High compression rebuild each page as an image. That can shrink scanned documents and photo-heavy PDFs. It also removes selectable text, links, and form fields. The tool says that before you download.',
      'Some targets are impossible without a file you would not want to submit. A 30 page scan will not become 100 KB and stay readable. When the attempt stops, DocuFix shows the real size instead of relabeling the original.',
      'Very long PDFs are split first. Rebuilding dozens of pages in the browser can freeze the tab, so the compressor stops at 40 pages and points you to Split PDF.',
    ],
  },
  {
    slug: 'files-stay-in-the-browser',
    title: 'Why these files stay in the browser',
    excerpt: 'A document utility should not need an account to resize a photo. This version keeps the work on your device.',
    date: '15 October 2026',
    minutes: 3,
    paragraphs: [
      'Image resize, PDF merge, split, watermark, and the conversions that are actually enabled all run in your browser. The original file is read locally. The export is a new download. DocuFix does not replace the file you picked.',
      'My Files is a history of outputs created in this browser. It uses the browser’s own storage. It is not a cloud drive, and it is empty until you process something. You can remove one file or clear the list.',
      'Word conversion is still unavailable. There is no reliable way to turn a PDF into an editable Word file, or a Word file into a PDF, without a document engine. Those pages do not produce a download.',
      'OCR uses Tesseract.js in the browser. Language data is downloaded when you extract text. The image and the transcript are not sent to DocuFix, and the result should be reviewed because OCR can be wrong.',
      'You can use the ready tools without an account. A signed-in file history stores the filename, operation, and sizes, not the document. Payments are not connected.',
    ],
  },
]

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug)
}
