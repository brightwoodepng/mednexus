"use client"

import { useState } from "react"
import Image from "next/image"
import { getAvatarManifestEntry } from "@/lib/avatar-manifest"

interface AvatarImageProps {
  avatarId: string
  className?: string
  eager?: boolean
  fallback?: string
}

/** Renders manifest-backed avatar artwork with stable dimensions and an accessible fallback. */
export function AvatarImage({ avatarId, className, eager = false, fallback }: AvatarImageProps) {
  const [failed, setFailed] = useState(false)
  const avatar = getAvatarManifestEntry(avatarId)
  const fallbackLabel = fallback ?? avatar?.fallbackIcon ?? "Avatar"

  if (!avatar || failed) {
    return <span role="img" aria-label={avatar?.altLabel ?? "Avatar"}>{fallbackLabel}</span>
  }

  return (
    <Image
      src={avatar.sourceAsset}
      sizes="128px"
      width={avatar.width}
      height={avatar.height}
      quality={avatar.quality}
      priority={eager}
      alt={avatar.altLabel}
      className={className}
      style={{ objectPosition: `${avatar.focalPoint.x * 100}% ${avatar.focalPoint.y * 100}%` }}
      onError={() => setFailed(true)}
    />
  )
}
