'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface SethAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  glow?: boolean
}

const sizeMap = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
}

const pxMap = {
  xs: 16,
  sm: 20,
  md: 32,
  lg: 40,
}

export function SethAvatar({ size = 'sm', className, glow = false }: SethAvatarProps) {
  return (
    <div
      className={cn(
        'relative flex-shrink-0 rounded-full overflow-hidden',
        sizeMap[size],
        glow && 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]',
        className
      )}
    >
      <Image
        src="/seth-logo.png"
        alt="SETH"
        width={pxMap[size]}
        height={pxMap[size]}
        className="object-contain w-full h-full"
        priority
      />
    </div>
  )
}
