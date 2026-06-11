export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createProject, getProjects, linkToProject, unlinkFromProject } from '@/lib/cortex'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projects = await getProjects(session.user.id)
    return NextResponse.json(projects)
  } catch (error) {
    console.error('[Cortex] Projects error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, description, metadata } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const project = await createProject(session.user.id, name, description, metadata)
    return NextResponse.json(project)
  } catch (error) {
    console.error('[Cortex] Create project error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

// PUT: Link or unlink entity from project
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, projectId, entityType, entityId, context } = await req.json()
    if (!projectId || !entityType || !entityId) {
      return NextResponse.json({ error: 'projectId, entityType, and entityId are required' }, { status: 400 })
    }

    if (action === 'unlink') {
      await unlinkFromProject(projectId, entityType, entityId)
      return NextResponse.json({ success: true })
    }

    const link = await linkToProject(projectId, entityType, entityId, context)
    return NextResponse.json({ success: true, link })
  } catch (error) {
    console.error('[Cortex] Project link error:', error)
    return NextResponse.json({ error: 'Failed to update project links' }, { status: 500 })
  }
}
