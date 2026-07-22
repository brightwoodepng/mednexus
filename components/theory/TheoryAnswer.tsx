"use client"

/**
 * TheoryAnswer — renders the model answer with markdown-style formatting
 * and highlights any critical flags in a prominent red callout box.
 */

import React from "react"

interface TheoryAnswerProps {
  modelAnswer: string
  criticalFlags: string[]
}

// ── Lightweight inline markdown renderer ──────────────────────────────────────
// Handles: **bold**, *italic*, `code`, plain text
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2] !== undefined) {
      parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[2]}</strong>)
    } else if (match[3] !== undefined) {
      parts.push(<em key={match.index} className="italic">{match[3]}</em>)
    } else if (match[4] !== undefined) {
      parts.push(
        <code key={match.index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
          {match[4]}
        </code>
      )
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

// ── Block-level renderer ──────────────────────────────────────────────────────
function renderBlocks(raw: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = []
  // Split on blank lines to get paragraph groups
  const groups = raw.split(/\n{2,}/)

  groups.forEach((group, gi) => {
    const lines = group.split("\n").map((l) => l.trimEnd())

    // Check if all non-empty lines are list items
    const nonEmpty = lines.filter((l) => l.trim().length > 0)
    const isList = nonEmpty.length > 0 && nonEmpty.every((l) => /^[-•*]\s/.test(l.trim()))
    // Check for heading
    const isH2 = nonEmpty.length === 1 && /^##\s/.test(nonEmpty[0].trim())
    const isH3 = nonEmpty.length === 1 && /^###\s/.test(nonEmpty[0].trim())
    const isH1 = nonEmpty.length === 1 && /^#[^#]\s/.test(nonEmpty[0].trim())

    if (isH1) {
      const text = nonEmpty[0].replace(/^#\s+/, "")
      blocks.push(
        <h2 key={gi} className="mt-4 text-base font-bold text-foreground">
          {renderInline(text)}
        </h2>
      )
    } else if (isH2) {
      const text = nonEmpty[0].replace(/^##\s+/, "")
      blocks.push(
        <h3 key={gi} className="mt-3 text-[0.95rem] font-bold text-foreground">
          {renderInline(text)}
        </h3>
      )
    } else if (isH3) {
      const text = nonEmpty[0].replace(/^###\s+/, "")
      blocks.push(
        <h4 key={gi} className="mt-2 text-sm font-semibold text-foreground">
          {renderInline(text)}
        </h4>
      )
    } else if (isList) {
      blocks.push(
        <ul key={gi} className="mt-2 space-y-1.5 pl-1">
          {lines
            .filter((l) => l.trim().length > 0)
            .map((l, li) => {
              const content = l.trim().replace(/^[-•*]\s+/, "")
              return (
                <li key={li} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500 dark:bg-teal-400" />
                  <span>{renderInline(content)}</span>
                </li>
              )
            })}
        </ul>
      )
    } else {
      // Paragraph — join lines
      const text = lines.join(" ").trim()
      if (!text) return
      blocks.push(
        <p key={gi} className="mt-2 text-sm leading-relaxed text-foreground">
          {renderInline(text)}
        </p>
      )
    }
  })

  return blocks
}

// ── Component ─────────────────────────────────────────────────────────────────
export function TheoryAnswer({ modelAnswer, criticalFlags }: TheoryAnswerProps) {
  return (
    <div className="space-y-4">
      {/* Critical Flags callout */}
      {criticalFlags.length > 0 && (
        <div className="rounded-2xl border border-red-300/70 bg-red-50 p-4 shadow-sm dark:border-red-800/40 dark:bg-red-950/30">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-base">🚨</span>
            <span className="text-xs font-bold uppercase tracking-widest text-red-700 dark:text-red-400">
              Critical Points · Must-Mention Rules
            </span>
          </div>
          <ul className="space-y-1.5">
            {criticalFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-red-800 dark:text-red-300">
                <span className="mt-0.5 shrink-0 font-bold text-red-500">▸</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Model answer body */}
      <div className="rounded-2xl border border-teal-200/60 bg-teal-50/60 px-5 py-4 dark:border-teal-800/30 dark:bg-teal-950/20">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
          Model Answer
        </p>
        <div className="prose-theory">
          {renderBlocks(modelAnswer)}
        </div>
      </div>
    </div>
  )
}
