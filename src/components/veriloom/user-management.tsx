'use client'

import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'

type Account = { id: string; name: string; email: string; role: string; active: boolean }

export function UserManagement() {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
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
      toast({ title: 'Account created', description: `${data.user.email} can now sign in.` })
    } catch (error) {
      toast({ title: 'Account creation failed', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true)
          void loadUsers()
        }}
      >
        <Users className="mr-1.5 h-4 w-4" /> Manage accounts
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Workspace accounts</DialogTitle>
            <DialogDescription>Create individual accounts with author, reviewer, or approver access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {loading ? <p className="text-sm text-faint">Loading accounts…</p> : users.map((user) => (
              <div key={user.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-line p-3 text-sm">
                <span><strong>{user.name}</strong><span className="ml-2 text-faint">{user.email}</span></span>
                <span className="text-faint">{user.role}{user.active ? '' : ' · inactive'}</span>
              </div>
            ))}
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
