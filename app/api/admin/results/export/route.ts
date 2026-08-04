import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { bestAttempts, loadAttempts, percentage } from "@/lib/admin-results"
import { auditAdmin } from "@/lib/platform-settings"
import { assessmentGradingModeSql, gradingModeLabel } from "@/lib/assessment-grading"
import { runtimePool } from "@/lib/runtime-db"

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_assessments")
  if (!admin) return adminAccessDenied(req)
  const id = req.nextUrl.searchParams.get("assessmentId")
  if (!id) return NextResponse.json({ error: "assessmentId is required" }, { status: 400 })
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv"
  const view = req.nextUrl.searchParams.get("view") === "all" ? "all" : "best"
  const pool = await runtimePool()
  const result = await pool.query(
    `SELECT id,title,pass_mark,
      ${assessmentGradingModeSql("mednexus_assessments")} AS grading_mode
     FROM mednexus_assessments WHERE id=$1`,
    [id],
  )
  const assessment = result.rows[0]
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
  const loaded = await loadAttempts(pool, id)
  const attempts = view === "best" ? bestAttempts(loaded) : loaded
  await auditAdmin(pool, admin.uid, "export", "assessment_results", id, { format, view, rows: attempts.length })

  if (format === "csv") {
    const lines = [
      ["Participant", "Account type", "Grading", "Score", "Total", "Percentage", "Result", "Submitted"].map(csvCell).join(","),
      ...attempts.map((attempt) => [
        attempt.participantName, attempt.isGuest ? "Guest" : "Registered", gradingModeLabel(assessment.grading_mode ?? "standard"), attempt.score, attempt.total,
        percentage(attempt), percentage(attempt) >= assessment.pass_mark ? "Pass" : "Fail", attempt.submittedAt,
      ].map(csvCell).join(",")),
    ]
    return new Response(`\uFEFF${lines.join("\r\n")}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${id}-results.csv"` } })
  }

  const PDFDocument = (await import("pdfkit")).default
  const document = new PDFDocument({ margin: 48, size: "A4", bufferPages: true })
  const chunks: Buffer[] = []
  document.on("data", (chunk) => chunks.push(chunk))
  document.fontSize(20).fillColor("#0f766e").text("MedNexus")
  document.moveDown(0.2).fontSize(16).fillColor("#111827").text(assessment.title)
  document.fontSize(9).fillColor("#6b7280").text(`${view === "best" ? "Best attempt" : "All attempts"} report · Generated ${new Date().toLocaleString()}`)
  document.fontSize(9).fillColor("#6b7280").text(`Grading: ${gradingModeLabel(assessment.grading_mode ?? "standard")}`)
  document.moveDown()
  for (const attempt of attempts) {
    if (document.y > 735) document.addPage()
    document.fontSize(10).fillColor("#111827").text(attempt.participantName, { continued: true, width: 260 })
    document.fillColor("#4b5563").text(`  ${attempt.isGuest ? "Guest" : "Registered"} · ${attempt.score}/${attempt.total} (${percentage(attempt)}%) · ${percentage(attempt) >= assessment.pass_mark ? "Pass" : "Fail"}`)
    document.moveDown(0.35)
  }
  const range = document.bufferedPageRange()
  for (let index = 0; index < range.count; index++) {
    document.switchToPage(index)
    document.fontSize(8).fillColor("#6b7280").text(`Page ${index + 1} of ${range.count}`, 48, 800, { align: "center", width: 500 })
  }
  document.end()
  await new Promise<void>((resolve) => document.on("end", resolve))
  return new Response(Buffer.concat(chunks), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${id}-results.pdf"` } })
}
