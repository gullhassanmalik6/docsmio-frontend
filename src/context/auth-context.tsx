import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { ApiError, api, type AccountUser } from '@/lib/api'

type AuthContextValue = {
  user: AccountUser | null
  ready: boolean
  error: string | null
  login: (input: { email: string; password: string }) => Promise<AccountUser>
  register: (input: { name: string; email: string; password: string }) => Promise<AccountUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const me = useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      try {
        return await api<AccountUser>('/api/auth/me')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
  })

  const loginMutation = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<{ user: AccountUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (result) => {
      queryClient.setQueryData(['account'], result.user)
    },
  })

  const registerMutation = useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      api<{ user: AccountUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (result) => {
      queryClient.setQueryData(['account'], result.user)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.setQueryData(['account'], null)
      queryClient.removeQueries({ queryKey: ['server-history'] })
    },
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user: me.data ?? null,
      ready: me.isFetched,
      error: me.error instanceof Error ? me.error.message : null,
      login: async (input) => (await loginMutation.mutateAsync(input)).user,
      register: async (input) => (await registerMutation.mutateAsync(input)).user,
      logout: async () => {
        await logoutMutation.mutateAsync()
      },
    }),
    [loginMutation, logoutMutation, me.data, me.error, me.isFetched, registerMutation],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
