import { Link, useParams } from 'react-router-dom'
import { getArticle } from '@/content/blog'
import { usePageTitle } from '@/hooks/use-browser'

export function BlogArticlePage() {
  const { slug } = useParams()
  const article = slug ? getArticle(slug) : undefined
  usePageTitle(article ? `${article.title} — DocuFix` : 'Article — DocuFix')

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-semibold">Article not found</h1>
        <Link to="/blog" className="mt-4 inline-block text-primary">
          Back to the blog
        </Link>
      </div>
    )
  }

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">
        Blog
      </Link>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{article.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {article.date} · {article.minutes} min read
      </p>
      <div className="mt-8 space-y-4 text-base leading-7 text-foreground/90">
        {article.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </article>
  )
}
