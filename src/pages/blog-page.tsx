import { Link } from 'react-router-dom'
import { articles } from '@/content/blog'
import { usePageTitle } from '@/hooks/use-browser'

export function BlogPage() {
  usePageTitle('Blog — DocuFix')
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">BLOG</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Notes on file size, PDFs, and privacy</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Short explanations of how DocuFix behaves, written so the limits are as clear as the buttons.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {articles.map((article) => (
          <article key={article.slug} className="flex h-full flex-col rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs text-muted-foreground">
              {article.date} · {article.minutes} min
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              <Link to={`/blog/${article.slug}`} className="hover:text-primary">
                {article.title}
              </Link>
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{article.excerpt}</p>
            <Link to={`/blog/${article.slug}`} className="mt-4 text-sm font-medium text-primary">
              Read article
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
