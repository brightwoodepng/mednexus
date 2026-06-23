"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { labValues } from "@/lib/questions-database"

interface LabValuesModalProps {
  open: boolean
  onClose: () => void
}

export function LabValuesModal({ open, onClose }: LabValuesModalProps) {
  const [active, setActive] = useState(labValues[0]?.category ?? "")
  const current = labValues.find((c) => c.category === active) ?? labValues[0]

  return (
    <Modal open={open} onClose={onClose} title="Lab Reference Values" widthClass="max-w-lg">
      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {labValues.map((cat) => (
          <button
            key={cat.category}
            type="button"
            onClick={() => setActive(cat.category)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              active === cat.category
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat.category}
          </button>
        ))}
      </div>

      {/* Values table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-left text-xs font-semibold text-muted-foreground">
              <th className="px-4 py-2.5">Test</th>
              <th className="px-4 py-2.5 text-right">Reference Range</th>
            </tr>
          </thead>
          <tbody>
            {current?.values.map((v, i) => (
              <tr key={v.name} className={i % 2 ? "bg-card" : "bg-background"}>
                <td className="px-4 py-2.5 font-medium">{v.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {v.range} {v.units}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
