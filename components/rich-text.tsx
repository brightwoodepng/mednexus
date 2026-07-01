"use client"

/**
 * RichText — renders content that may contain HTML (e.g. <img> tags from
 * Word/PDF imports) or plain prose.
 *
 * When the content contains any HTML tag it is rendered via
 * dangerouslySetInnerHTML after DOM-based allowlist sanitization.
 * Plain-text strings are rendered as-is with whitespace preserved.
 *
 * Source of content: Gemini-parsed HTML produced by the admin import flow.
 * Even though only admins can trigger imports we still sanitize rigorously
 * to prevent stored-XSS if the DB is ever tampered with.
 */

// ── Allowlist ─────────────────────────────────────────────────────────────────

/** Elements whose tags are kept (content is preserved, not stripped). */
const ALLOWED_TAGS = new Set([
  "p", "br", "span", "div",
  "strong", "b", "em", "i", "u", "s", "sub", "sup",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "img", "figure", "figcaption",
  "blockquote", "pre", "code",
  "hr",
])

/** Per-element allowed attributes (applied on top of global rules). */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  img:  new Set(["src", "alt", "width", "height", "loading"]),
  td:   new Set(["colspan", "rowspan"]),
  th:   new Set(["colspan", "rowspan", "scope"]),
  a:    new Set([]), // <a> is not in ALLOWED_TAGS but guard anyway
}

/** URI schemes allowed in src/href attributes. */
const SAFE_SCHEMES = new Set(["data", "http", "https"])

function schemeIsAllowed(value: string): boolean {
  // data URIs from mammoth are always image/* — block data:text/html etc.
  if (value.startsWith("data:")) {
    return /^data:image\//i.test(value)
  }
  try {
    const scheme = new URL(value).protocol.replace(/:$/, "")
    return SAFE_SCHEMES.has(scheme)
  } catch {
    // Relative URLs have no scheme — allow them.
    return !value.trim().toLowerCase().startsWith("javascript")
  }
}

// ── DOM-based sanitizer ───────────────────────────────────────────────────────

/**
 * Sanitize HTML using the browser's own DOM parser plus an allowlist.
 * Returns a safe HTML string ready for dangerouslySetInnerHTML.
 * Must only be called in a browser context (it uses document.createElement).
 */
function sanitize(raw: string): string {
  // Parse into a detached document so scripts don't execute
  const template = document.createElement("template")
  template.innerHTML = raw

  const root = template.content

  // Walk every node depth-first; collect elements to remove after the walk
  // to avoid mutating the live node list mid-traversal.
  const toRemove: ChildNode[] = []

  function walk(node: ChildNode) {
    if (node.nodeType === Node.TEXT_NODE) return

    if (node.nodeType !== Node.ELEMENT_NODE) {
      // Comments, PIs, etc. — remove them
      toRemove.push(node)
      return
    }

    const el = node as Element
    const tag = el.tagName.toLowerCase()

    if (!ALLOWED_TAGS.has(tag)) {
      // Replace with children (unwrap) if the tag is unknown but benign,
      // remove entirely for known dangerous containers.
      const REMOVE_ENTIRELY = new Set(["script", "style", "link", "meta",
        "iframe", "frame", "frameset", "object", "embed", "applet",
        "base", "form", "input", "button", "textarea", "select",
        "svg", "math", "template", "noscript", "xmp"])
      if (REMOVE_ENTIRELY.has(tag)) {
        toRemove.push(el)
      } else {
        // Unwrap: move children before the element, then remove element
        while (el.firstChild) el.parentNode!.insertBefore(el.firstChild, el)
        toRemove.push(el)
      }
      return
    }

    // Strip disallowed attributes
    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>()
    const attrNames = Array.from(el.attributes).map((a) => a.name)
    for (const attr of attrNames) {
      const lower = attr.toLowerCase()
      // Block all event handlers
      if (lower.startsWith("on")) { el.removeAttribute(attr); continue }
      if (!allowed.has(lower))   { el.removeAttribute(attr); continue }
      // Validate URL attributes
      if (lower === "src" || lower === "href" || lower === "action") {
        const val = el.getAttribute(attr) ?? ""
        if (!schemeIsAllowed(val)) el.removeAttribute(attr)
      }
    }

    // Recurse into children
    Array.from(el.childNodes).forEach(walk)
  }

  Array.from(root.childNodes).forEach(walk)
  toRemove.forEach((n) => n.parentNode?.removeChild(n))

  // Serialize back to string
  const wrapper = document.createElement("div")
  wrapper.appendChild(root)
  return wrapper.innerHTML
}

// ── HTML detection ────────────────────────────────────────────────────────────

const HTML_TAG_RE = /<[a-z][^>]*>/i

// ── Component ─────────────────────────────────────────────────────────────────

interface RichTextProps {
  content: string | null | undefined
  className?: string
}

export function RichText({ content, className }: RichTextProps) {
  if (!content) return null

  if (HTML_TAG_RE.test(content)) {
    // sanitize() uses document — only runs client-side (this is "use client")
    const safe = typeof document !== "undefined" ? sanitize(content) : ""
    return (
      <div
        className={`rich-text leading-relaxed ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    )
  }

  return (
    <p className={`leading-relaxed whitespace-pre-wrap ${className ?? ""}`}>
      {content}
    </p>
  )
}
