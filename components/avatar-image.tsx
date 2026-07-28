"use client"

import { useState } from "react"
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

  const [small, large] = avatar.optimizedAssets

  return (
    <img
      src={small.src}
      srcSet={`${small.src} ${small.width}w, ${large.src} ${large.width}w`}
      sizes="128px"
      width={128}
      height={128}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      alt={avatar.altLabel}
      className={className}
      style={{ objectPosition: `${avatar.focalPoint.x * 100}% ${avatar.focalPoint.y * 100}%` }}
      onError={() => setFailed(true)}
    />
  )
}
