import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken } from "@/lib/admin-auth"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? ""
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 })
  }

  try {
    const { vignette, options, correctAnswer, subject } = await req.json()
    if (!vignette || !options || !correctAnswer) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const optionsText = options
      .map((o: { id: string; text: string }) => `${o.id}. ${o.text}`)
      .join("\n")

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a medical education expert. Given a clinical vignette MCQ, write a high-quality structured explanation for medical learners. Return ONLY valid JSON matching this shape exactly:
{
  "objective": "One concise sentence stating the learning objective/concept being tested.",
  "details": "2-4 sentences explaining why the correct answer is right, referencing relevant pathophysiology, mechanisms, or clinical reasoning.",
  "incorrectReasoning": "1-2 sentences explaining why the other answer choices are wrong or less appropriate."
}`,
        },
        {
          role: "user",
          content: `Subject: ${subject || "Medicine"}

Clinical Vignette:
${vignette}

Answer Choices:
${optionsText}

Correct Answer: ${correctAnswer}

Write an enhanced explanation for this question.`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content ?? ""
    const explanation = JSON.parse(content)

    if (!explanation.objective || !explanation.details) {
      throw new Error("Invalid AI response shape")
    }

    return NextResponse.json({ explanation })
  } catch (err) {
    console.error("[enhance-question]", err)
    return NextResponse.json({ error: "Enhancement failed" }, { status: 500 })
  }
}
