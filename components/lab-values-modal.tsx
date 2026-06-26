"use client"

import { useState, useMemo } from "react"
import { Modal } from "@/components/ui/modal"
import { labValues } from "@/lib/questions-database"
import type { Question, LabCategory } from "@/lib/types"

const LAB_KEYWORDS: Record<string, string[]> = {
  "Sodium (Na+)":            ["sodium", "na+", "na =", "hyponatremia", "hypernatremia"],
  "Potassium (K+)":          ["potassium", "k+", "k =", "hypokalemia", "hyperkalemia"],
  "Chloride (Cl-)":          ["chloride", "cl-"],
  "Bicarbonate (HCO3-)":     ["bicarbonate", "hco3", "alkalosis", "acidosis"],
  "Blood Urea Nitrogen":     ["bun", "blood urea", "urea", "azotemia", "uremia"],
  "Creatinine":              ["creatinine", "cr =", "renal failure", "kidney failure", "aki", "ckd"],
  "Glucose (fasting)":       ["glucose", "blood sugar", "hyperglycemia", "hypoglycemia", "diabetic", "diabetes"],
  "Calcium (total)":         ["calcium", "ca2+", "hypocalcemia", "hypercalcemia"],
  "Magnesium":               ["magnesium", "mg2+", "hypomagnesemia"],
  "Hemoglobin (male)":       ["hemoglobin", "hgb", "hb =", "anemia", "anaemia"],
  "Hemoglobin (female)":     ["hemoglobin", "hgb", "hb =", "anemia", "anaemia"],
  "Hematocrit (male)":       ["hematocrit", "hct"],
  "Hematocrit (female)":     ["hematocrit", "hct"],
  "Leukocyte count (WBC)":   ["wbc", "leukocyte", "white blood cell", "leukocytosis", "leukopenia", "neutrophil", "infection"],
  "Platelet count":          ["platelet", "thrombocytopenia", "thrombocytosis", "plt"],
  "Mean corpuscular volume":  ["mcv", "mean corpuscular", "microcytic", "macrocytic"],
  "INR (no anticoagulation)": ["inr", "prothrombin", "coagulation", "warfarin", "bleeding"],
  "Total cholesterol":       ["cholesterol", "dyslipidemia", "hyperlipidemia"],
  "LDL cholesterol":         ["ldl"],
  "HDL cholesterol":         ["hdl"],
  "Triglycerides":           ["triglyceride"],
}

function getRelevantLabs(question: Question): LabCategory[] {
  const text = (question.vignette + " " + question.options.map(o => o.text).join(" ")).toLowerCase()

  const result: LabCategory[] = labValues.map((cat) => ({
    category: cat.category,
    values: cat.values.filter((v) => {
      const keywords = LAB_KEYWORDS[v.name]
      if (!keywords) return false
      return keywords.some((kw) => text.includes(kw))
    }),
  })).filter((cat) => cat.values.length > 0)

  return result.length > 0 ? result : labValues
}

interface LabValuesModalProps {
  open: boolean
  onClose: () => void
  question?: Question
}

export function LabValuesModal({ open, onClose, question }: LabValuesModalProps) {
  const categories = useMemo(
    () => (question ? getRelevantLabs(question) : labValues),
    [question]
  )

  const [active, setActive] = useState<string>("")
  const activeCategory = active && categories.find((c) => c.category === active)
    ? active
    : categories[0]?.category ?? ""
  const current = categories.find((c) => c.category === activeCategory) ?? categories[0]

  return (
    <Modal open={open} onClose={onClose} title="Lab Reference Values" widthClass="max-w-lg">
      {question && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing labs relevant to this question.
        </p>
      )}

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.category}
            type="button"
            onClick={() => setActive(cat.category)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeCategory === cat.category
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
