'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Building2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signIn(email, password)
    if (error) {
      setError(error)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded bg-limona-lime/10 mb-4">
            <Building2 size={32} className="text-limona-lime" />
          </div>
          <h1 className="font-heading font-bold text-3xl uppercase tracking-wide text-limona-white">
            Limona CRM
          </h1>
          <p className="text-limona-text-muted text-sm mt-2">
            System zarządzania nieruchomościami
          </p>
        </div>

        {/* Form */}
        <div className="limona-card p-8">
          <div className="mb-6">
            <span className="limona-eyebrow">Logowanie</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-limona-text-muted uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="limona-input"
                placeholder="jan@limona.com.pl"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-limona-text-muted uppercase tracking-wider mb-2">
                Hasło
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="limona-input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-limona-text-dim hover:text-limona-text-muted"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-limona-red text-sm bg-limona-red/10 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="limona-btn w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </form>

          <p className="text-center text-sm text-limona-text-muted mt-6">
            Nie masz konta?{' '}
            <Link href="/auth/register" className="text-limona-lime hover:text-limona-lime-hover transition-colors">
              Zarejestruj się
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
