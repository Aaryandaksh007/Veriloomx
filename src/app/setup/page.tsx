'use client'

import { FormEvent, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [required, setRequired] = useState<boolean | null>(null)
  const [available, setAvailable] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [setupKey, setSetupKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/setup', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not check account setup.')
        const data = await res.json()
        setRequired(data.setupRequired)
        setAvailable(data.setupAvailable)
      })
      .catch(() => setError('Could not check account setup. Refresh to try again.'))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, setupKey }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Account setup failed.')
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) throw new Error('Account created. Sign in with your new credentials.')
      router.replace('/')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Account setup failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-line bg-paper p-6 shadow-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-terra-600">
            First-run Administrator setup
          </p>
          <p className="mt-1 font-serif text-2xl font-semibold text-ink">Set up VeriLoom</p>
          <p className="mt-1 text-sm text-faint">
            Create the initial administrator account. From there, use Manage accounts to provision separate Author, Reviewer, and Approver users.
          </p>
        </div>
        {required === false ? (
          <p className="text-sm text-ink-soft">Initial setup is complete. <a className="font-semibold text-terra-700 underline" href="/login">Sign in</a>.</p>
        ) : !available ? (
          <p className="text-sm text-clay-700">Initial setup is disabled. Ask the deployment administrator to configure `INITIAL_ADMIN_SETUP_KEY`.</p>
        ) : (
          <>
            <label className="block text-sm font-medium text-ink">
              One-time setup key
              <input required type="password" autoComplete="off" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-ink">
              Name
              <input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-ink">
              Email
              <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-ink">
              Password <span className="font-normal text-faint">(at least 12 characters)</span>
              <input required minLength={12} maxLength={200} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2" />
            </label>
            {error && <p role="alert" className="text-sm text-clay-700">{error}</p>}
            <button disabled={busy || required === null} className="w-full rounded-md bg-terra-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
              {busy ? 'Creating account…' : 'Create administrator'}
            </button>
          </>
        )}
      </form>
    </main>
  )
}
