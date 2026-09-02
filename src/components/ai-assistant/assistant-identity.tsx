"use client"

import Image from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

interface AssistantIdentityProps {
  size?: number
  variant?: "folio" | "mark"
  className?: string
  alt?: string
}

const identityAssets = {
  folio: "/illustrations/jobsilver-assistant-folio.png",
  mark: "/jobsilver-mark.svg",
} as const

export function AssistantIdentity({
  size = 32,
  variant = "mark",
  className,
  alt = "",
}: AssistantIdentityProps) {
  const src = identityAssets[variant]
  const [failedAsset, setFailedAsset] = useState<string | null>(null)
  const hasFailed = failedAsset === src

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={{ width: size, height: size }}
      className={cn(
        "relative block shrink-0 overflow-hidden",
        variant === "folio" ? "rounded-[22%]" : "rounded-[24%]",
        className
      )}
    >
      {hasFailed ? (
        <svg
          viewBox="0 0 32 32"
          className="h-full w-full"
          aria-hidden="true"
        >
          <rect width="32" height="32" rx="8" fill="#F4F1E9" />
          <rect x="6" y="6" width="20" height="20" rx="5" fill="#17253D" />
          <path d="M10 25a6 6 0 0 1 12 0Z" fill="#D85B37" />
          <path d="M6 22h20M16 6v16" stroke="#F4F1E9" strokeWidth="1.5" />
        </svg>
      ) : (
        <Image
          src={src}
          width={size}
          height={size}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          onError={() => setFailedAsset(src)}
        />
      )}
    </span>
  )
}
