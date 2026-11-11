import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userCount = await db.user.count()
  return NextResponse.json({
    setupRequired: userCount === 0,
    setupAvailable: Boolean(process.env.INITIAL_ADMIN_SETUP_KEY),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const setupKey = typeof body.setupKey === 'string' ? body.setupKey : ''
  const expectedKey = process.env.INITIAL_ADMIN_SETUP_KEY
  if (!expectedKey) {
    return NextResponse.json({ error: 'Initial account setup is disabled. Configure INITIAL_ADMIN_SETUP_KEY first.' }, { status: 503 })
  }
  const actualBytes = Buffer.from(setupKey)
  const expectedBytes = Buffer.from(expectedKey)
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return NextResponse.json({ error: 'Invalid setup key.' }, { status: 403 })
  }
  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid name and email address.' }, { status: 400 })
  }
  if (password.length < 12 || password.length > 200) {
    return NextResponse.json({ error: 'Password must be between 12 and 200 characters.' }, { status: 400 })
  }

  try {
    const user = await db.$transaction(async (tx) => {
      if (await tx.user.count() !== 0) return null
      return tx.user.create({
        data: { name, email, passwordHash: hashPassword(password), role: 'admin' },
        select: { id: true },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    if (!user) return NextResponse.json({ error: 'Initial account already exists.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json({ error: 'Initial account already exists.' }, { status: 409 })
    }
    console.error('[setup] initial admin creation failed:', error)
    return NextResponse.json({ error: 'Could not create the initial account.' }, { status: 500 })
  }
}
