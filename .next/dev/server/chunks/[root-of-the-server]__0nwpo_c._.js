module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/app/api/parse-pdf/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
// ── Regex-based MCQ parser ────────────────────────────────────────────────────
// Handles common formats found in medical MCQ PDFs.
function cleanText(t) {
    return t.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function parseQuestions(raw, defaultSubject) {
    const text = cleanText(raw);
    const results = [];
    // Split on question boundaries. Matches:
    //   1. / Q1. / Question 1 / Q1: / 1) at line start
    const qSplitter = /(?:^|\n)(?:Question\s+|Q\.?\s*)?(\d{1,3})[.):\s]/gm;
    const boundaries = [];
    let m;
    while((m = qSplitter.exec(text)) !== null){
        boundaries.push(m.index);
    }
    if (boundaries.length === 0) return results;
    const blocks = [];
    for(let i = 0; i < boundaries.length; i++){
        const start = boundaries[i];
        const end = i + 1 < boundaries.length ? boundaries[i + 1] : text.length;
        blocks.push(text.slice(start, end).trim());
    }
    for (const block of blocks){
        const q = parseBlock(block, defaultSubject);
        if (q) results.push(q);
    }
    return results;
}
function parseBlock(block, defaultSubject) {
    const lines = block.split("\n").map((l)=>l.trim()).filter(Boolean);
    if (lines.length < 3) return null;
    // Strip leading question number from first line
    const vignetteLines = [];
    const optionLines = [];
    let answerLine = "";
    let explanationLines = [];
    let inExplanation = false;
    let inOptions = false;
    // Option patterns: A. / A) / (A) / A: / A -
    const optPattern = /^([A-Ea-e])[.):\-\s]\s+(.+)$/;
    // Answer patterns
    const answerPattern = /^(?:answer|correct\s+answer|key|ans)[.:\s]*([A-Ea-e])/i;
    // Explanation patterns
    const explPattern = /^(?:explanation|rationale|discussion|reason|solution|note)[.:\s]/i;
    for(let i = 0; i < lines.length; i++){
        const line = lines[i];
        if (inExplanation) {
            explanationLines.push(line);
            continue;
        }
        // Check for answer line
        const ansMath = line.match(answerPattern);
        if (ansMath) {
            answerLine = ansMath[1].toUpperCase();
            inExplanation = false;
            continue;
        }
        // Check for explanation header
        if (explPattern.test(line)) {
            inExplanation = true;
            // Include rest of line after the header word
            const rest = line.replace(explPattern, "").trim();
            if (rest) explanationLines.push(rest);
            continue;
        }
        // Check for option
        const optMatch = line.match(optPattern);
        if (optMatch) {
            inOptions = true;
            optionLines.push(line);
            continue;
        }
        // Everything before options is vignette
        if (!inOptions) {
            // Strip leading question number
            const cleaned = line.replace(/^(?:Question\s+|Q\.?\s*)?\d{1,3}[.):\s]+/, "").trim();
            if (cleaned) vignetteLines.push(cleaned);
        }
    }
    if (vignetteLines.length === 0 || optionLines.length < 2) return null;
    // Parse options
    const options = [];
    for (const ol of optionLines){
        const om = ol.match(optPattern);
        if (om) options.push({
            id: om[1].toUpperCase(),
            text: om[2].trim()
        });
    }
    if (options.length < 2) return null;
    // Determine correct answer — fallback to first option if not found
    const correctAnswer = answerLine || options[0].id;
    // Build explanation
    const explText = explanationLines.join(" ").trim();
    // Try to split explanation into objective / details / incorrectReasoning
    let objective = "";
    let details = explText;
    let incorrectReasoning = "";
    // If explanation mentions "incorrect" or distractor reasoning, split there
    const incorrectIdx = explText.search(/incorrect|distractor|wrong choice|other option/i);
    if (incorrectIdx > 50) {
        details = explText.slice(0, incorrectIdx).trim();
        incorrectReasoning = explText.slice(incorrectIdx).trim();
    }
    // Derive objective from vignette: first sentence or first 100 chars
    const vignetteText = vignetteLines.join(" ");
    const firstSentenceEnd = vignetteText.search(/[.?!]/);
    if (firstSentenceEnd > 20 && firstSentenceEnd < 150) {
        objective = vignetteText.slice(0, firstSentenceEnd + 1).trim();
    } else {
        objective = vignetteText.slice(0, Math.min(120, vignetteText.length)).trim();
    }
    return {
        subject: defaultSubject,
        vignette: vignetteText,
        options,
        correctAnswer,
        explanation: {
            objective: objective || "Clinical reasoning question.",
            details: details || "See explanation above.",
            incorrectReasoning: incorrectReasoning || ""
        }
    };
}
// ── OpenAI-enhanced parsing (used if key is available) ────────────────────────
async function parseWithAI(text, moduleName) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                temperature: 0,
                max_tokens: 4096,
                messages: [
                    {
                        role: "system",
                        content: `You are a medical education assistant. Extract all MCQ questions from the given text and return a JSON array.

Each question must match this TypeScript interface:
{
  subject: string,            // use the provided module name
  vignette: string,           // the full question stem / clinical vignette
  options: { id: string, text: string }[],  // A, B, C, D (and optionally E)
  correctAnswer: string,      // single letter: "A" | "B" | "C" | "D" | "E"
  explanation: {
    objective: string,        // 1 sentence: what concept is tested
    details: string,          // why the correct answer is correct
    incorrectReasoning: string // why the distractors are wrong
  }
}

Return ONLY a valid JSON array. No markdown, no code fences, no extra text.`
                    },
                    {
                        role: "user",
                        content: `Module name: ${moduleName}\n\nText to parse:\n\n${text.slice(0, 12000)}`
                    }
                ]
            })
        });
        if (!res.ok) return null;
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
    } catch  {
        return null;
    }
    return null;
}
async function POST(req) {
    try {
        const { text, moduleName = "Imported Module" } = await req.json();
        if (!text || typeof text !== "string") {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "text is required"
            }, {
                status: 400
            });
        }
        // Try AI-enhanced parsing first (only if OPENAI_API_KEY is set)
        const aiResult = await parseWithAI(text, moduleName);
        if (aiResult && aiResult.length > 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                questions: aiResult,
                source: "ai"
            });
        }
        // Fall back to regex parser
        const questions = parseQuestions(text, moduleName);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            questions,
            source: "regex"
        });
    } catch (err) {
        console.error("parse-pdf error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Parse failed"
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0nwpo_c._.js.map