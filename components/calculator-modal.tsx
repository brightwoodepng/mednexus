"use client"

import { useState, useCallback } from "react"
import { Modal } from "@/components/ui/modal"

interface CalculatorModalProps {
  open: boolean
  onClose: () => void
}

// A fully functional numpad calculator. Evaluates a simple expression string
// safely without using eval() by parsing tokens.
export function CalculatorModal({ open, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState("0")
  const [expression, setExpression] = useState("")

  const press = useCallback(
    (key: string) => {
      setDisplay((prev) => {
        if (key === "C") {
          setExpression("")
          return "0"
        }
        if (key === "DEL") {
          const next = prev.length > 1 ? prev.slice(0, -1) : "0"
          return next
        }
        if (key === "=") {
          try {
            const result = safeEvaluate(expression + prev)
            setExpression("")
            return result
          } catch {
            return "Error"
          }
        }
        if (["+", "-", "×", "÷", "%"].includes(key)) {
          setExpression((e) => e + (prev === "Error" ? "0" : prev) + key)
          return "0"
        }
        // digit or decimal
        if (key === "." && prev.includes(".")) return prev
        if (prev === "0" && key !== ".") return key
        if (prev === "Error") return key
        return prev + key
      })
    },
    [expression],
  )

  const keys = [
    "C",
    "DEL",
    "%",
    "÷",
    "7",
    "8",
    "9",
    "×",
    "4",
    "5",
    "6",
    "-",
    "1",
    "2",
    "3",
    "+",
    "0",
    ".",
    "=",
  ]

  const isOp = (k: string) => ["+", "-", "×", "÷", "%"].includes(k)

  return (
    <Modal open={open} onClose={onClose} title="Medical Calculator" widthClass="max-w-xs">
      <div className="mb-4 rounded-xl bg-muted px-4 py-4 text-right">
        <p className="h-5 truncate text-xs text-muted-foreground">{expression || "\u00A0"}</p>
        <p className="truncate text-3xl font-semibold tabular-nums">{display}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={`rounded-xl py-3.5 text-sm font-semibold transition-colors ${
              k === "="
                ? "col-span-2 bg-primary text-primary-foreground hover:opacity-90"
                : k === "C" || k === "DEL"
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : isOp(k)
                    ? "bg-accent text-accent-foreground hover:opacity-80"
                    : "bg-muted text-foreground hover:bg-secondary"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </Modal>
  )
}

// Safe left-to-right expression evaluator (no operator precedence, like a
// basic clinical calculator). Avoids eval entirely.
function safeEvaluate(expr: string): string {
  const tokens = expr.match(/(\d+\.?\d*|[+\-×÷%])/g)
  if (!tokens || tokens.length === 0) return "0"
  let acc = Number.parseFloat(tokens[0])
  let i = 1
  while (i < tokens.length - 1) {
    const op = tokens[i]
    const next = Number.parseFloat(tokens[i + 1])
    if (Number.isNaN(next)) break
    if (op === "+") acc += next
    else if (op === "-") acc -= next
    else if (op === "×") acc *= next
    else if (op === "÷") acc = next === 0 ? Number.NaN : acc / next
    else if (op === "%") acc = acc % next
    i += 2
  }
  if (Number.isNaN(acc)) return "Error"
  return String(Math.round(acc * 100000) / 100000)
}
