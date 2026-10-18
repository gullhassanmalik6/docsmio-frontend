import { FileImage, FileText, FileType } from 'lucide-react'

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -left-6 top-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -right-4 bottom-8 h-32 w-32 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="relative rounded-[1.6rem] border border-white/10 bg-[#0c1411] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-300/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-xs text-muted-foreground">DocuFix — Your files, ready to go</span>
        </div>
        <div className="grid gap-3 p-3 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-xs tracking-[0.14em] text-emerald-300">TARGET SIZE</p>
            <p className="mt-2 text-3xl font-semibold">200 KB</p>
            <p className="mt-1 text-xs text-muted-foreground">Original 4.2 MB</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[72%] rounded-full bg-primary" />
            </div>
            <p className="mt-3 text-xs text-emerald-200">Output 186 KB · under target</p>
          </div>
          <div className="grid gap-2">
            {[
              ['Passport photo', 'JPG · 180 KB'],
              ['Merged packet', 'PDF · 1.2 MB'],
              ['Application form', 'PDF · 420 KB'],
            ].map(([name, meta]) => (
              <div key={name} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{meta}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -left-3 top-16 hidden items-center gap-2 rounded-2xl border border-white/10 bg-[#121c18] px-3 py-2 shadow-xl sm:flex">
        <span className="grid size-9 place-items-center rounded-lg bg-red-400/15 text-red-300">
          <FileText className="size-4" />
        </span>
        <span className="text-xs font-semibold">PDF</span>
      </div>
      <div className="absolute -right-2 top-8 hidden items-center gap-2 rounded-2xl border border-white/10 bg-[#121c18] px-3 py-2 shadow-xl sm:flex">
        <span className="grid size-9 place-items-center rounded-lg bg-sky-400/15 text-sky-300">
          <FileType className="size-4" />
        </span>
        <span className="text-xs font-semibold">DOCX</span>
      </div>
      <div className="absolute -bottom-4 right-10 hidden items-center gap-2 rounded-2xl border border-white/10 bg-[#121c18] px-3 py-2 shadow-xl sm:flex">
        <span className="grid size-9 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300">
          <FileImage className="size-4" />
        </span>
        <span className="text-xs font-semibold">JPG</span>
      </div>
    </div>
  )
}
