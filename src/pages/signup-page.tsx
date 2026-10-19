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

const signupSchema = z
  .object({
    name: z.string().min(2, 'Enter your name.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirm: z.string().min(8, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match.',
  })

type SignupValues = z.infer<typeof signupSchema>

export function SignupPage() {
  usePageTitle('Sign up — Docsmio')
  const auth = useAuth()
  const navigate = useNavigate()
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  })
  const mutation = useMutation({
    mutationFn: (values: SignupValues) => auth.register({ name: values.name, email: values.email, password: values.password }),
    onSuccess: () => navigate('/files'),
  })

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Sign up</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create an account to keep a history of filenames and sizes, and to use the online library. Document tools and the local library do not require an account. Files are uploaded only when you choose to copy them online.</p>
        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" autoComplete="name" className="mt-1.5" {...form.register('name')} />
            {form.formState.errors.name ? <p className="mt-1 text-sm text-red-300">{form.formState.errors.name.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" type="email" autoComplete="email" className="mt-1.5" {...form.register('email')} />
            {form.formState.errors.email ? <p className="mt-1 text-sm text-red-300">{form.formState.errors.email.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="signup-password">Password</Label>
            <Input id="signup-password" type="password" autoComplete="new-password" className="mt-1.5" {...form.register('password')} />
            {form.formState.errors.password ? <p className="mt-1 text-sm text-red-300">{form.formState.errors.password.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" className="mt-1.5" {...form.register('confirm')} />
            {form.formState.errors.confirm ? <p className="mt-1 text-sm text-red-300">{form.formState.errors.confirm.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        {mutation.error ? (
          <div className="mt-4">
            <Notice tone="error">{accountErrorMessage(mutation.error, 'The account could not be created.')}</Notice>
          </div>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">
          Already have the form?{' '}
          <Link to="/login" className="text-primary">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
