import { NextRequest, NextResponse } from "next/server"
import PDFDocument from "pdfkit"
import { getRequestAuth, unauthorized } from "@/lib/request-auth"
import { theoryDatabaseAvailable, theoryPool } from "@/lib/theory-server"

export const runtime = "nodejs"

function plain(markdown: string | null | undefined) {
  return (markdown ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`>]/g, "")
    .trim()
}

async function pdfBuffer(document: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    document.on("data", chunk => chunks.push(Buffer.from(chunk)))
    document.on("end", () => resolve(Buffer.concat(chunks)))
    document.on("error", reject)
    document.end()
  })
}

export async function POST(request: NextRequest) {
  if (!theoryDatabaseAvailable()) return NextResponse.json({ error: "Theory Vault database is not configured." }, { status: 503 })
  try {
    const body = await request.json() as Record<string, unknown>
    const source = body.source === "bookmarks" || body.source === "revision" || body.source === "notes" ? body.source : "set"
    const auth = await getRequestAuth(request)
    if (source !== "set" && !auth) return unauthorized()
    const sourceId = typeof body.sourceId === "string" ? body.sourceId : null
    if (source === "set" && !sourceId) return NextResponse.json({ error: "Set id is required." }, { status: 400 })
    const includeAnswers = body.includeAnswers === true
    const includeNotes = body.includeNotes === true && Boolean(auth)
    const pool = await theoryPool()
    const join = source === "bookmarks"
      ? "JOIN mednexus_theory_bookmarks owned ON owned.question_id=q.id AND owned.user_id=$1"
      : source === "revision"
        ? "JOIN mednexus_theory_revision_queue owned ON owned.question_id=q.id AND owned.user_id=$1 AND owned.active"
        : source === "notes"
          ? "JOIN mednexus_theory_notes owned ON owned.question_id=q.id AND owned.user_id=$1"
          : ""
    const where = source === "set" ? "q.set_id=$2" : "TRUE"
    const result = await pool.query(`SELECT q.id,q.title,q.prompt,q.model_answer AS "modelAnswer",
      q.key_marking_points AS "keyMarkingPoints",q.marks,
      c.title AS collection,COALESCE(m.name,d.name,'Unassigned') AS "groupName",s.name AS "setTitle",
      CASE WHEN $1::text IS NULL THEN NULL ELSE n.body END AS note
      FROM mednexus_theory_questions q ${join}
      JOIN mednexus_theory_collections c ON c.id=q.collection_id
      LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
      LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
      LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
      LEFT JOIN mednexus_theory_notes n ON n.question_id=q.id AND n.user_id=$1
      WHERE q.status='published' AND ${where}
      ORDER BY c.sort_order,COALESCE(m.sort_order,d.sort_order),s.sort_order,q.sort_order,q.created_at`,
    [auth?.uid ?? null, sourceId])
    if (!result.rows.length) return NextResponse.json({ error: "No Theory questions matched this export." }, { status: 404 })

    const title = source === "set" ? result.rows[0].setTitle : source === "bookmarks"
      ? "Theory Bookmarks" : source === "revision" ? "Theory Revision Queue" : "Theory Notes"
    const doc = new PDFDocument({ size: "A4", margins: { top: 54, right: 54, bottom: 62, left: 54 }, bufferPages: true, info: { Title: `MedNexus — ${title}` } })
    doc.fillColor("#0f766e").fontSize(12).font("Helvetica-Bold").text("MEDNEXUS")
    doc.fillColor("#111827").fontSize(22).text(title)
    doc.fillColor("#64748b").fontSize(10).font("Helvetica").text(
      `${result.rows[0].collection} · ${result.rows[0].groupName} · Generated ${new Date().toLocaleDateString("en-GB")}`,
    )
    doc.moveDown(1).strokeColor("#99f6e4").moveTo(54, doc.y).lineTo(541, doc.y).stroke().moveDown(1)

    result.rows.forEach((question, index) => {
      if (index > 0) doc.addPage()
      doc.fillColor("#0f766e").fontSize(10).font("Helvetica-Bold").text(`QUESTION ${index + 1}${question.marks != null ? ` · ${question.marks} MARKS` : ""}`)
      if (question.title) doc.fillColor("#111827").fontSize(15).text(plain(question.title))
      doc.moveDown(0.4).fillColor("#111827").fontSize(12).font("Helvetica").text(plain(question.prompt), { lineGap: 3 })
      if (includeAnswers) {
        doc.moveDown(1).fillColor("#0f766e").fontSize(11).font("Helvetica-Bold").text("MODEL ANSWER")
        doc.moveDown(0.3).fillColor("#1f2937").fontSize(10.5).font("Helvetica").text(plain(question.modelAnswer), { lineGap: 3 })
        if (question.keyMarkingPoints?.length) {
          doc.moveDown(0.8).font("Helvetica-Bold").text("Key points")
          question.keyMarkingPoints.forEach((point: string) => doc.font("Helvetica").text(`• ${plain(point)}`, { indent: 10, lineGap: 2 }))
        }
      }
      if (includeNotes && question.note) {
        doc.moveDown(1).fillColor("#0f766e").font("Helvetica-Bold").text("MY NOTE")
        doc.moveDown(0.3).fillColor("#1f2937").font("Helvetica").text(plain(question.note), { lineGap: 3 })
      }
    })

    const range = doc.bufferedPageRange()
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index)
      doc.fillColor("#64748b").fontSize(8).font("Helvetica")
        .text(`MedNexus Theory Vault · Page ${index + 1} of ${range.count}`, 54, 792, { width: 487, align: "center" })
    }
    const buffer = await pdfBuffer(doc)
    const filename = `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theory-vault"}.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("[theory export POST]", error)
    return NextResponse.json({ error: "Unable to generate the Theory PDF." }, { status: 500 })
  }
}
