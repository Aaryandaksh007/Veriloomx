'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Check, Copy, Eye, EyeOff, KeyRound, Plus, Sparkles, Users } from 'lucide-react'
import { useApp } from '@/lib/store'
import { ROLE_META, type Role } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type Account = { id: string; name: string; email: string; role: Role; active: boolean }
type ProvisionedCredential = { role: Role; name: string; email: string; password: string }

const WORKFLOW_ROLE_TEMPLATES: { role: 'creator' | 'manager' | 'reviewer'; name: string; handle: string }[] = [
  { role: 'creator', name: 'Workspace Author', handle: 'author' },
  { role: 'manager', name: 'Brand Reviewer', handle: 'reviewer' },
  { role: 'reviewer', name: 'Final Approver', handle: 'approver' },
]

function generateStrongPassword(length = 16): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&*'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export function UserManagement() {
  const { data: session } = useSession()
  const { accountsDialogOpen, setAccountsDialogOpen, refresh } = useApp()
  const [users, setUsers] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('creator')
  const [provisioned, setProvisioned] = useState<ProvisionedCredential[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  async function loadUsers() {
    setLoading(true)
    try {
      const response = await fetch('/api/users', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not load accounts.')
      setUsers(data.users)
    } catch (error) {
      toast({ title: 'Account list unavailable', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (accountsDialogOpen) void loadUsers()
  }, [accountsDialogOpen])

  async function addUser() {
    setSaving(true)
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not create account.')
      setUsers((current) => [...current, data.user])
      setName('')
      setEmail('')
      setPassword('')
      await refresh()
      toast({ title: 'Account created', description: `${data.user.email} can now sign in.` })
    } catch (error) {
      toast({ title: 'Account creation failed', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function updateUser(accountId: string, patch: { role?: Role; active?: boolean }) {
    setUpdatingId(accountId)
    try {
      const response = await fetch(`/api/users/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not update account.')
      setUsers((current) => current.map((u) => (u.id === accountId ? data.user : u)))
      await refresh()
      toast({ title: 'Account updated', description: `${data.user.name} updated.` })
    } catch (error) {
      toast({ title: 'Update failed', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' })
    } finally {
      setUpdatingId(null)
    }
  }

  const activeUsers = users.filter((u) => u.active)
  const missingTemplates = WORKFLOW_ROLE_TEMPLATES.filter(
    (tpl) => !activeUsers.some((u) => u.role === tpl.role)
  )

  async function provisionMissingRoles() {
    if (missingTemplates.length === 0) return
    setProvisioning(true)
    const adminEmail = session?.user?.email ?? ''
    const rawDomain = adminEmail.includes('@') ? adminEmail.split('@')[1] : 'veriloom.local'
    const domain = rawDomain || 'veriloom.local'
    const tag = Date.now().toString(36).slice(-4)
    const createdCreds: ProvisionedCredential[] = []
    const createdAccounts: Account[] = []

    try {
      for (const tpl of missingTemplates) {
        const candidateEmail = `${tpl.handle}.${tag}@${domain}`
        const generatedPassword = generateStrongPassword(16)
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tpl.name,
            email: candidateEmail,
            password: generatedPassword,
            role: tpl.role,
          }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? `Could not create ${ROLE_META[tpl.role].label}.`)
        createdAccounts.push(body.user)
        createdCreds.push({
          role: tpl.role,
          name: tpl.name,
          email: body.user.email,
          password: generatedPassword,
        })
      }
      setUsers((cur) => [...cur, ...createdAccounts])
      setProvisioned((prev) => [...createdCreds, ...prev])
      await refresh()
      toast({
        title: `Provisioned ${createdCreds.length} workflow account${createdCreds.length === 1 ? '' : 's'}`,
        description: 'Copy the one-time passwords shown below before closing this dialog.',
      })
    } catch (error) {
      if (createdAccounts.length > 0) {
        setUsers((cur) => [...cur, ...createdAccounts])
        setProvisioned((prev) => [...createdCreds, ...prev])
        await refresh()
      }
      toast({
        title: 'Batch provisioning incomplete',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setProvisioning(false)
    }
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1800)
    } catch {
      toast({ title: 'Copy failed', description: 'Copy the credentials manually.', variant: 'destructive' })
    }
  }

  const selfId = session?.user?.id

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAccountsDialogOpen(true)}
      >
        <Users className="mr-1.5 h-4 w-4" /> Manage accounts
      </Button>
      <Dialog
        open={accountsDialogOpen}
        onOpenChange={(open) => {
          setAccountsDialogOpen(open)
          if (!open) setProvisioned([])
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Workspace accounts &amp; role enforcement</DialogTitle>
            <DialogDescription>
              Provision individual Author, Reviewer, and Approver accounts or adjust active access. Each signed-in user sees only actions permitted by their role.
            </DialogDescription>
          </DialogHeader>

          {!loading && users.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {(['creator', 'manager', 'reviewer', 'admin'] as Role[]).map((r) => {
                  const count = activeUsers.filter((u) => u.role === r).length
                  return (
                    <span
                      key={r}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 font-semibold',
                        count > 0 ? 'border-olive-200 bg-olive-50 text-olive-700' : 'border-ochre-300 bg-ochre-50 text-ochre-700'
                      )}
                    >
                      {ROLE_META[r].label}: {count} active
                    </span>
                  )
                })}
              </div>
              {missingTemplates.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={provisioning}
                  className="h-7 border-terra-300 bg-terra-50 text-xs text-terra-800 hover:bg-terra-100"
                  onClick={() => void provisionMissingRoles()}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {provisioning
                    ? 'Provisioning…'
                    : `Quick-provision ${missingTemplates.map((t) => ROLE_META[t.role].label).join(' + ')}`}
                </Button>
              )}
            </div>
          )}

          {provisioned.length > 0 && (
            <div className="space-y-2 rounded-xl border border-olive-300 bg-olive-50/70 p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-olive-900">
                  One-time credentials created (scrypt-hashed in DB — save before closing)
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 border-olive-300 bg-paper px-2 text-[11px] text-olive-800"
                  onClick={() =>
                    void copyText(
                      'all',
                      provisioned
                        .map((p) => `${ROLE_META[p.role].label} (${p.name})\nEmail: ${p.email}\nPassword: ${p.password}`)
                        .join('\n\n')
                    )
                  }
                >
                  {copiedKey === 'all' ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                  {copiedKey === 'all' ? 'Copied' : 'Copy all'}
                </Button>
              </div>
              <div className="space-y-1.5">
                {provisioned.map((cred) => (
                  <div
                    key={cred.email}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-olive-200 bg-paper px-3 py-2"
                  >
                    <div className="min-w-0 font-mono text-[11px]">
                      <span className="font-sans font-bold text-olive-800">{ROLE_META[cred.role].label}:</span>{' '}
                      <span className="text-ink">{cred.email}</span> · <span className="text-terra-700">{cred.password}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => void copyText(cred.email, `Email: ${cred.email}\nPassword: ${cred.password}`)}
                    >
                      {copiedKey === cred.email ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                      Copy
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {loading ? <p className="text-sm text-faint">Loading accounts…</p> : users.map((user) => {
              const isSelf = user.id === selfId || user.email === session?.user?.email
              const rowBusy = updatingId === user.id
              return (
                <div
                  key={user.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3 text-sm',
                    !user.active && 'bg-parchment/70 opacity-65'
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {user.name}
                      {isSelf && <span className="ml-2 text-[10px] font-bold uppercase text-terra-600">(you)</span>}
                    </p>
                    <p className="text-xs text-faint">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={user.role}
                      disabled={isSelf || rowBusy}
                      onValueChange={(next) => void updateUser(user.id, { role: next as Role })}
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="creator" className="text-xs">Author</SelectItem>
                        <SelectItem value="manager" className="text-xs">Reviewer</SelectItem>
                        <SelectItem value="reviewer" className="text-xs">Approver</SelectItem>
                        <SelectItem value="admin" className="text-xs">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSelf || rowBusy}
                      onClick={() => void updateUser(user.id, { active: !user.active })}
                      className={cn(
                        'h-8 text-xs',
                        user.active ? 'text-stone-600 hover:text-clay-700' : 'border-olive-300 text-olive-700'
                      )}
                    >
                      {user.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="space-y-3 border-t border-line pt-4">
            <h3 className="text-sm font-semibold">Add an account</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="account-name">Name</Label><Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} /></div>
              <div><Label htmlFor="account-email">Email</Label><Input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="account-password">Temporary password (12+ chars)</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(generateStrongPassword(16))
                      setShowPassword(true)
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-terra-700 hover:underline"
                  >
                    <KeyRound className="h-3 w-3" /> Generate
                  </button>
                </div>
                <div className="relative mt-1">
                  <Input
                    id="account-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={12}
                    maxLength={200}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Author</SelectItem>
                    <SelectItem value="manager">Reviewer</SelectItem>
                    <SelectItem value="reviewer">Approver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button disabled={saving || name.trim().length < 2 || !email || password.length < 12} onClick={addUser}>
              <Plus className="mr-1.5 h-4 w-4" />{saving ? 'Creating…' : 'Create account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
