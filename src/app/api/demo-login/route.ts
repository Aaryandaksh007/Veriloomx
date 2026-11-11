import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store, max-age=0' }

export async function GET() {
  if (process.env.DEMO_LOGIN_ENABLED !== 'true') {
    return NextResponse.json({ available: false }, { headers: noStore })
  }

  const email = process.env.DEMO_LOGIN_EMAIL?.trim().toLowerCase()
  const password = process.env.DEMO_LOGIN_PASSWORD
  if (!email || !password || password.length < 12 || password.length > 200) {
    return NextResponse.json(
      { error: 'Demo sign-in is enabled but its account is not fully configured.' },
      { status: 503, headers: noStore }
    )
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { role: true, active: true, passwordHash: true },
    })
    if (
      !user?.active ||
      user.role !== 'creator' ||
      !verifyPassword(password, user.passwordHash)
    ) {
      return NextResponse.json(
        { error: 'The configured demo credentials must match an active Author account.' },
        { status: 503, headers: noStore }
      )
    }

    return NextResponse.json({ available: true, email, password }, { headers: noStore })
  } catch (error) {
    console.error('[demo-login] could not verify configured demo account:', error)
    return NextResponse.json(
      { error: 'Could not load demo sign-in. Use your assigned workspace account.' },
      { status: 500, headers: noStore }
    )
  }
}
