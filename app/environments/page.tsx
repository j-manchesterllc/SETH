'use client'

import { SkyboxGenerator } from '@/components/skybox/skybox-generator'
import { Globe, Sparkles } from 'lucide-react'

export default function EnvironmentsPage() {
  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Environments</h1>
            <p className="text-sm text-muted-foreground">
              Generate immersive 360° panoramic worlds with AI
            </p>
          </div>
        </div>
      </div>

      <SkyboxGenerator />

      <div className="mt-8 rounded-xl border border-border/50 bg-card/30 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Tips</span>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Be specific and vivid — <span className="text-foreground">"Neon-lit cyberpunk marketplace at night with rain reflections"</span></li>
          <li>• You can also ask Seth in chat to generate environments for you</li>
          <li>• Drag the panorama to explore your 360° world</li>
          <li>• Use the expand button for a full-screen immersive view</li>
          <li>• Different styles produce dramatically different results — experiment!</li>
        </ul>
      </div>
    </div>
  )
}
