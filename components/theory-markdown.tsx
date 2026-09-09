"use client"

import { Children, isValidElement, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"
import { formatTheorySubquestions, theorySectionKey } from "@/lib/theory-format"

function plainText(children: ReactNode): string {
  return Children.toArray(children).map(child => {
    if (typeof child === "string" || typeof child === "number") return String(child)
    if (isValidElement<{ children?: ReactNode }>(child)) return plainText(child.props.children)
    return ""
  }).join("")
}

export function TheoryMarkdown({
  children,
  className = "",
  linkedSectionKeys = [],
  onSectionSelect,
  answerSectionPrefix,
  highlightedSectionKey,
}: {
  children: string
  className?: string
  linkedSectionKeys?: readonly string[]
  onSectionSelect?: (key: string) => void
  answerSectionPrefix?: string
  highlightedSectionKey?: string | null
}) {
  const linkedSections = new Set(linkedSectionKeys)
  const sectionProps = (props: { children?: ReactNode }, baseClass: string) => {
    const key = theorySectionKey(plainText(props.children))
    const isAnswerTarget = Boolean(key && answerSectionPrefix)
    const highlighted = isAnswerTarget && key === highlightedSectionKey
    const content = key && onSectionSelect && linkedSections.has(key) ? (
      <button
        type="button"
        onClick={() => onSectionSelect(key)}
        className="-mx-2 w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition-colors hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:bg-primary/15"
        aria-label={`Jump to model answer ${key}`}
        title="Jump to the matching model answer"
      >
        {props.children}
      </button>
    ) : props.children

    return {
      id: isAnswerTarget ? `${answerSectionPrefix}-${key!.toLowerCase()}` : undefined,
      tabIndex: isAnswerTarget ? -1 : undefined,
      className: `${baseClass} scroll-mt-24 rounded-lg transition-[background-color,box-shadow] duration-500 ${highlighted ? "bg-primary/15 ring-2 ring-primary/30" : ""}`,
      children: content,
    }
  }

  return (
    <div className={`theory-markdown min-w-0 break-words text-[15px] leading-7 text-foreground [overflow-wrap:anywhere] sm:text-base ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({node: _node, ...props}) => <h1 {...sectionProps(props, "mb-3 mt-5 text-xl font-bold sm:mt-6 sm:text-2xl")} />,
          h2: ({node: _node, ...props}) => <h2 {...sectionProps(props, "mb-3 mt-5 text-lg font-bold sm:mt-6 sm:text-xl")} />,
          h3: ({node: _node, ...props}) => <h3 {...sectionProps(props, "mb-2 mt-4 text-base font-bold sm:mt-5 sm:text-lg")} />,
          p: ({node: _node, ...props}) => <p {...sectionProps(props, "my-3")} />,
          ul: props => <ul className="my-3 list-disc space-y-1 pl-5 sm:pl-6" {...props} />,
          ol: props => <ol className="my-3 list-decimal space-y-1 pl-5 sm:pl-6" {...props} />,
          blockquote: props => <blockquote className="my-4 border-l-4 border-primary/40 bg-primary/5 px-3 py-2 sm:px-4" {...props} />,
          code: props => <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]" {...props} />,
          table: props => <div className="my-4 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border"><table className="min-w-full border-collapse text-left text-sm" {...props} /></div>,
          th: props => <th className="border-b border-r border-border bg-muted px-2 py-2 font-semibold last:border-r-0 sm:px-3" {...props} />,
          td: props => <td className="border-b border-r border-border px-2 py-2 align-top last:border-r-0 sm:px-3" {...props} />,
          a: props => <a className="font-semibold text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
        }}
      >
        {formatTheorySubquestions(children)}
      </ReactMarkdown>
    </div>
  )
}
