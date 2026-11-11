import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (token) return NextResponse.next()

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }
  const login = new URL('/login', req.url)
  login.searchParams.set('callbackUrl', req.nextUrl.pathname)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/((?!api/auth|api/setup|login|setup|_next/static|_next/image|favicon.ico).*)'],
}
