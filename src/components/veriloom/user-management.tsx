'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Users } from 'lucide-react'
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

export function UserManagement() {
  const { data: session } = useSession()
  const { accountsDialogOpen, setAccountsDialogOpen, refresh } = useApp()
  const [users, setUsers] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('creator')

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
      <Dialog open={accountsDialogOpen} onOpenChange={setAccountsDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Workspace accounts &amp; role enforcement</DialogTitle>
            <DialogDescription>
              Provision individual Author, Reviewer, and Approver accounts or adjust active access. Each signed-in user sees only actions permitted by their role.
            </DialogDescription>
          </DialogHeader>

          {!loading && users.length > 0 && (
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
              <div><Label htmlFor="account-password">Temporary password (12+ characters)</Label><Input id="account-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} maxLength={200} /></div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
