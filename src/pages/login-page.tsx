import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Notice } from '@/components/notice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/auth-context'
import { usePageTitle } from '@/hooks/use-browser'
import { accountErrorMessage } from '@/lib/api'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  usePageTitle('Login — DocuFix')
  const auth = useAuth()
  const navigate = useNavigate()
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const mutation = useMutation({
    mutationFn: (values: LoginValues) => auth.login(values),
    onSuccess: () => navigate('/files'),
  })

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to save file-history metadata to your account. The document tools still run in this browser.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" className="mt-1.5" {...form.register('email')} />
            {form.formState.errors.email ? <p className="mt-1 text-sm text-red-300">{form.formState.errors.email.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" className="mt-1.5" {...form.register('password')} />
            {form.formState.errors.password ? <p className="mt-1 text-sm text-red-300">{form.formState.errors.password.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Signing in…' : 'Login'}
          </Button>
        </form>
        {mutation.error ? (
          <div className="mt-4">
            <Notice tone="error">{accountErrorMessage(mutation.error, 'Sign in failed.')}</Notice>
          </div>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">
          Need an account page?{' '}
          <Link to="/signup" className="text-primary">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
