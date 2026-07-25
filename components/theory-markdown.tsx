"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"

export function TheoryMarkdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`theory-markdown text-sm leading-7 text-foreground ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: props => <h1 className="mb-3 mt-6 text-2xl font-bold" {...props} />,
          h2: props => <h2 className="mb-3 mt-6 text-xl font-bold" {...props} />,
          h3: props => <h3 className="mb-2 mt-5 text-lg font-bold" {...props} />,
          p: props => <p className="my-3" {...props} />,
          ul: props => <ul className="my-3 list-disc space-y-1 pl-6" {...props} />,
          ol: props => <ol className="my-3 list-decimal space-y-1 pl-6" {...props} />,
          blockquote: props => <blockquote className="my-4 border-l-4 border-primary/40 bg-primary/5 px-4 py-2" {...props} />,
          code: props => <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]" {...props} />,
          table: props => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left" {...props} /></div>,
          th: props => <th className="border border-border bg-muted px-3 py-2 font-semibold" {...props} />,
          td: props => <td className="border border-border px-3 py-2 align-top" {...props} />,
          a: props => <a className="font-semibold text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
