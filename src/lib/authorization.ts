import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Role } from '@/lib/types'

export async function currentUser() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return null

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, active: true },
  })
  if (!user?.active) return null

  return {
    ...session.user,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  }
}

export async function hasRole(...roles: Role[]) {
  const user = await currentUser()
  return user && roles.includes(user.role) ? user : null
}
