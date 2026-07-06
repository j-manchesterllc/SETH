export const dynamic = 'force-dynamic'
export const revalidate = 0
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        objectives: true,
        preferences: true,
        workingStyle: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error: any) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any)?.id as string
    const body = await request.json()

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: body?.name,
        objectives: body?.objectives,
        preferences: body?.preferences,
        workingStyle: body?.workingStyle,
      },
      select: {
        id: true,
        email: true,
        name: true,
        objectives: true,
        preferences: true,
        workingStyle: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error: any) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
