import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasRole } from '@/lib/authorization'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const VALID_ROLES = ['creator', 'manager', 'reviewer', 'admin'] as const

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const admin = await hasRole('admin')
  if (!admin) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })

  const data: { role?: string; active?: boolean } = {}

  if (body.role !== undefined) {
    if (typeof body.role !== 'string' || !VALID_ROLES.includes(body.role as (typeof VALID_ROLES)[number])) {
      return NextResponse.json({ error: 'Role must be creator, manager, reviewer, or admin.' }, { status: 400 })
    }
    if (id === admin.id && body.role !== 'admin') {
      return NextResponse.json(
        { error: 'You cannot remove your own administrator role.' },
        { status: 409 }
      )
    }
    if (target.role === 'admin' && body.role !== 'admin') {
      const otherActiveAdmins = await db.user.count({
        where: { role: 'admin', active: true, id: { not: id } },
      })
      if (otherActiveAdmins === 0) {
        return NextResponse.json(
          { error: 'At least one active administrator account must remain.' },
          { status: 409 }
        )
      }
    }
    data.role = body.role
  }

  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'active must be a boolean.' }, { status: 400 })
    }
    if (id === admin.id && !body.active) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account.' },
        { status: 409 }
      )
    }
    if (target.role === 'admin' && !body.active) {
      const otherActiveAdmins = await db.user.count({
        where: { role: 'admin', active: true, id: { not: id } },
      })
      if (otherActiveAdmins === 0) {
        return NextResponse.json(
          { error: 'At least one active administrator account must remain.' },
          { status: 409 }
        )
      }
    }
    data.active = body.active
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Provide role or active status to update.' }, { status: 400 })
  }

  const updated = await db.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  })

  return NextResponse.json({ user: updated })
}

