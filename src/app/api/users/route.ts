import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { Prisma } from '@prisma/client'
import { hasRole } from '@/lib/authorization'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await hasRole('admin'))) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  if (!(await hasRole('admin'))) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = body.role
  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid name and email address.' }, { status: 400 })
  }
  if (password.length < 12 || password.length > 200) {
    return NextResponse.json({ error: 'Password must be between 12 and 200 characters.' }, { status: 400 })
  }
  if (!['creator', 'manager', 'reviewer'].includes(role)) {
    return NextResponse.json({ error: 'Role must be creator, manager, or reviewer.' }, { status: 400 })
  }

  try {
    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password), role },
      select: { id: true, name: true, email: true, role: true, active: true },
    })
    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('[users] account creation failed:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account already uses this email.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not create account.' }, { status: 500 })
  }
}
