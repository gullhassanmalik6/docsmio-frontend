import {
  Combine,
  FileArchive,
  FileImage,
  FileText,
  FileType,
  Images,
  Scaling,
  ScanLine,
  Scissors,
  Stamp,
  type LucideIcon,
} from 'lucide-react'

export type ToolCategory = 'image' | 'pdf' | 'convert' | 'scan' | 'edit'
export type ToolStatus = 'ready' | 'preview' | 'unavailable'
export type ToolAccent = 'emerald' | 'red' | 'orange' | 'blue' | 'violet' | 'amber'

export type ToolDefinition = {
  slug: string
  title: string
  description: string
  category: ToolCategory
  status: ToolStatus
  href: string
  icon: LucideIcon
  accent: ToolAccent
}

export const categoryFilters = [
  { id: 'all', label: 'All Tools' },
  { id: 'image', label: 'Image Tools' },
  { id: 'pdf', label: 'PDF Tools' },
  { id: 'convert', label: 'Convert Tools' },
  { id: 'scan', label: 'Scan & OCR' },
  { id: 'edit', label: 'Edit Tools' },
] as const

export type CategoryFilter = (typeof categoryFilters)[number]['id']

export const tools: ToolDefinition[] = [
  {
    slug: 'image-resize',
    title: 'Image Resize & Compress',
    description: 'Resize an image and reduce it toward an exact KB or MB size.',
    category: 'image',
    status: 'ready',
    href: '/tools/image-resize',
    icon: Scaling,
    accent: 'emerald',
  },
  {
    slug: 'compress-pdf',
    title: 'Compress PDF',
    description: 'Reduce a PDF and see the real output size before you download it.',
    category: 'pdf',
    status: 'ready',
    href: '/tools/compress-pdf',
    icon: FileArchive,
    accent: 'red',
  },
  {
    slug: 'merge-pdf',
    title: 'Merge PDF',
    description: 'Combine PDFs into one file, in the order you choose.',
    category: 'pdf',
    status: 'ready',
    href: '/tools/merge-pdf',
    icon: Combine,
    accent: 'orange',
  },
  {
    slug: 'split-pdf',
    title: 'Split PDF',
    description: 'Export the pages you select into a new PDF.',
    category: 'pdf',
    status: 'ready',
    href: '/tools/split-pdf',
    icon: Scissors,
    accent: 'red',
  },
  {
    slug: 'pdf-to-word',
    title: 'PDF to Word',
    description: 'Unavailable. A PDF is not turned into an editable Word file.',
    category: 'convert',
    status: 'unavailable',
    href: '/tools/pdf-to-word',
    icon: FileType,
    accent: 'blue',
  },
  {
    slug: 'image-to-pdf',
    title: 'Image to PDF',
    description: 'Place JPG, PNG, or WebP images onto PDF pages.',
    category: 'convert',
    status: 'ready',
    href: '/tools/image-to-pdf',
    icon: Images,
    accent: 'amber',
  },
  {
    slug: 'word-to-pdf',
    title: 'Word to PDF',
    description: 'Unavailable. A Word document is not converted into a PDF.',
    category: 'convert',
    status: 'unavailable',
    href: '/tools/word-to-pdf',
    icon: FileText,
    accent: 'blue',
  },
  {
    slug: 'jpg-to-pdf',
    title: 'JPG to PDF',
    description: 'Build a PDF from JPEG images without re-saving the originals.',
    category: 'convert',
    status: 'ready',
    href: '/tools/jpg-to-pdf',
    icon: FileImage,
    accent: 'violet',
  },
  {
    slug: 'scan',
    title: 'Scan & OCR',
    description: 'Capture or upload a page, then read the text in this browser.',
    category: 'scan',
    status: 'ready',
    href: '/tools/scan',
    icon: ScanLine,
    accent: 'emerald',
  },
  {
    slug: 'watermark',
    title: 'Add Watermark',
    description: 'Stamp text across every page of a PDF.',
    category: 'edit',
    status: 'ready',
    href: '/tools/watermark',
    icon: Stamp,
    accent: 'violet',
  },
]

export const accentClasses: Record<ToolAccent, string> = {
  emerald: 'bg-emerald-400/15 text-emerald-300',
  red: 'bg-red-400/15 text-red-300',
  orange: 'bg-orange-400/15 text-orange-300',
  blue: 'bg-sky-400/15 text-sky-300',
  violet: 'bg-violet-400/15 text-violet-300',
  amber: 'bg-amber-400/15 text-amber-300',
}

export function getTool(slug: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.slug === slug)
}

export function filterTools(query: string, category: CategoryFilter = 'all'): ToolDefinition[] {
  const needle = query.trim().toLowerCase()
  return tools.filter((tool) => {
    const categoryMatches = category === 'all' || tool.category === category
    const haystack = `${tool.title} ${tool.description}`.toLowerCase()
    return categoryMatches && (needle.length === 0 || haystack.includes(needle))
  })
}

export function isCategoryFilter(value: string | null): value is CategoryFilter {
  return categoryFilters.some((category) => category.id === value)
}
