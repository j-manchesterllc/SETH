'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { User, Target, Settings, Briefcase, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

interface Profile {
  id: string
  email: string
  name: string | null
  objectives: string | null
  preferences: string | null
  workingStyle: string | null
  createdAt: string
}

export function ProfilePageClient() {
  const { data: session } = useSession() || {}
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [objectives, setObjectives] = useState('')
  const [preferences, setPreferences] = useState('')
  const [workingStyle, setWorkingStyle] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const data = await res.json()
          setProfile(data)
          setName(data?.name ?? '')
          setObjectives(data?.objectives ?? '')
          setPreferences(data?.preferences ?? '')
          setWorkingStyle(data?.workingStyle ?? '')
        }
      } catch (e: any) {
        console.error('Failed to fetch profile', e)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, objectives, preferences, workingStyle }),
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        toast.success('Profile updated!')
      } else {
        toast.error('Failed to update profile')
      }
    } catch (e: any) {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Help Seth understand you better by providing your objectives and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" />
              Basic Information
            </CardTitle>
            <CardDescription>Your identity and contact info</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email ?? ''} disabled className="opacity-60" />
            </div>
          </CardContent>
        </Card>

        {/* Objectives */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-primary" />
              Objectives
            </CardTitle>
            <CardDescription>Your key goals and priorities that Seth should keep in mind</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={objectives}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObjectives(e.target.value)}
              placeholder="e.g., Scale the company to $10M ARR by Q4, Build a world-class engineering team, Launch new product line..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-primary" />
              Preferences
            </CardTitle>
            <CardDescription>Communication and decision-making preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={preferences}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPreferences(e.target.value)}
              placeholder="e.g., I prefer brief, direct communication. Give me data-backed recommendations. Flag risks early..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Working Style */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="w-5 h-5 text-primary" />
              Working Style
            </CardTitle>
            <CardDescription>How you work best so Seth can adapt</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={workingStyle}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setWorkingStyle(e.target.value)}
              placeholder="e.g., Deep work in mornings, meetings in afternoon. Prefer async communication. Decision-maker, not micromanager..."
              rows={4}
            />
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full" loading={saving}>
          <Save className="w-4 h-4 mr-2" />
          Save Profile
        </Button>
      </div>
    </div>
  )
}
