import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Notice } from '@/components/notice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePageTitle } from '@/hooks/use-browser'
import { loadPreferences, savePreferences } from '@/lib/preferences'
import { fieldClass } from '@/lib/utils'

const schema = z.object({
  defaultQuality: z.number({ invalid_type_error: 'Enter a quality from 5 to 100.' }).min(5).max(100),
  defaultFormat: z.enum(['jpeg', 'png', 'webp']),
  defaultTargetKb: z.number({ invalid_type_error: 'Enter a target in KB.' }).min(10).max(10240),
})

type SettingsForm = z.infer<typeof schema>

export function SettingsPage() {
  usePageTitle('Settings — DocuFix')
  const [saved, setSaved] = useState(false)
  const form = useForm<SettingsForm>({ resolver: zodResolver(schema), defaultValues: loadPreferences() })

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">These defaults are stored in this browser and used the next time you open Image Resize & Compress.</p>
      <form
        className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-card p-5"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          savePreferences(values)
          setSaved(true)
        })}
      >
        <div>
          <Label htmlFor="default-target">Default target (KB)</Label>
          <Input id="default-target" type="number" min={10} className="mt-1.5" {...form.register('defaultTargetKb', { valueAsNumber: true })} />
          {form.formState.errors.defaultTargetKb ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.defaultTargetKb.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="default-quality">Default quality</Label>
          <Input id="default-quality" type="number" min={5} max={100} className="mt-1.5" {...form.register('defaultQuality', { valueAsNumber: true })} />
          {form.formState.errors.defaultQuality ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.defaultQuality.message}</p> : null}
        </div>
        <div>
          <Label htmlFor="default-format">Default format</Label>
          <select id="default-format" className={fieldClass + ' mt-1.5'} {...form.register('defaultFormat')}>
            <option value="jpeg">JPG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        <Button type="submit">Save changes</Button>
        {saved ? <Notice tone="success">Saved on this device.</Notice> : null}
      </form>
    </div>
  )
}
