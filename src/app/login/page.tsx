'use client'

import { FormEvent, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [sessionNotice, setSessionNotice] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'expired') {
      setSessionNotice(true)
    }
    fetch('/api/setup', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Setup status request failed')
        const data = await response.json()
        setSetupRequired(Boolean(data.setupRequired && data.setupAvailable))
      })
      .catch(() => setError('Could not check workspace setup. Refresh to try again.'))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (!result || result.error) {
        setError('Email or password is incorrect.')
        return
      }
      const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl') || '/'
      router.replace(callbackUrl.startsWith('/') ? callbackUrl : '/')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-paper p-6 shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-terra-600">
              Living Brand Vault
            </p>
            <p className="mt-1 font-serif text-2xl font-semibold text-ink">VeriLoom AI</p>
            <p className="mt-1 text-sm text-faint">Sign in with your assigned workspace account</p>
          </div>
          {sessionNotice && !error && (
            <p className="rounded-lg border border-ochre-300 bg-ochre-50 px-3 py-2 text-xs text-ochre-900">
              Your session ended or access was updated. Sign in again to continue.
            </p>
          )}
          <label className="block text-sm font-medium text-ink">
            Email
            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-ink">
            Password
            <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
          </label>
          {error && <p role="alert" className="text-sm text-clay-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-md bg-terra-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-terra-500 disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {setupRequired && (
            <a href="/setup" className="block text-center text-sm font-medium text-terra-700 underline">
              Set up the first administrator account
            </a>
          )}
        </form>
        <div className="rounded-xl border border-line bg-parchment/80 p-4 text-xs text-ink-soft">
          <p className="font-semibold text-ink">Role-enforced governance gates</p>
          <ul className="mt-1.5 space-y-1">
            <li><strong className="text-ink">Author:</strong> Draft copy &amp; assets, run 6-pillar fail-safe audits, apply fixes/overrides, and submit.</li>
            <li><strong className="text-ink">Reviewer:</strong> Inspect version diffs &amp; request changes before release.</li>
            <li><strong className="text-ink">Approver:</strong> Issue final sign-off and tamper-evident SHA-256 certificates.</li>
            <li><strong className="text-ink">Administrator:</strong> Manage user roles/status and versioned Brand Vault rules.</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
