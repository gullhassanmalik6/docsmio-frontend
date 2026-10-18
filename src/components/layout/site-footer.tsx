import { Link } from 'react-router-dom'
import { Logo } from '@/components/layout/logo'

const product = [
  { to: '/', label: 'Home' },
  { to: '/tools', label: 'Tools' },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/blog', label: 'Blog' },
]

const categories = [
  { to: '/tools?category=image', label: 'Image tools' },
  { to: '/tools?category=pdf', label: 'PDF tools' },
  { to: '/tools?category=convert', label: 'Convert tools' },
  { to: '/tools?category=scan', label: 'Scan & OCR' },
  { to: '/tools?category=edit', label: 'Edit tools' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/30">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
            Prepare your documents. Get the right file size. Ready tools run in this browser and export a new file.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Product</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {product.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Tool categories</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {categories.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Privacy</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Supported tools process files on your device. A signed-in account stores filenames and sizes for tool history. Document bytes are uploaded only when you copy a file into the online library.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/privacy" className="hover:text-foreground">
                Privacy notes
              </Link>
            </li>
            <li>
              <Link to="/files" className="hover:text-foreground">
                My Files
              </Link>
            </li>
            <li>
              <Link to="/help" className="hover:text-foreground">
                Help
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 DocuFix. Smart Document Tool.</p>
          <p>No account is required for the tools that are ready.</p>
        </div>
      </div>
    </footer>
  )
}
