(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/pdf-extract.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "extractTextFromPdf",
    ()=>extractTextFromPdf
]);
// Client-side PDF text extraction using pdfjs-dist
// Runs entirely in the browser — no server round-trip for extraction.
let pdfjsLib = null;
async function getPdfjs() {
    if (pdfjsLib) return pdfjsLib;
    pdfjsLib = await __turbopack_context__.A("[project]/node_modules/.pnpm/pdfjs-dist@5.7.284/node_modules/pdfjs-dist/build/pdf.mjs [app-client] (ecmascript, async loader)");
    // Use the bundled legacy worker to avoid CORS issues
    pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
    return pdfjsLib;
}
async function extractTextFromPdf(file) {
    const pdfjs = await getPdfjs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
        data: arrayBuffer
    }).promise;
    const pageCount = pdf.numPages;
    const pageTexts = [];
    for(let i = 1; i <= pageCount; i++){
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const lines = [];
        let lastY = null;
        for (const item of content.items){
            if ("str" in item) {
                const y = item.transform[5];
                if (lastY !== null && Math.abs(y - lastY) > 5) {
                    lines.push("\n");
                }
                lines.push(item.str);
                lastY = y;
            }
        }
        pageTexts.push(lines.join(""));
    }
    return {
        text: pageTexts.join("\n\n--- Page break ---\n\n"),
        pageCount
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=lib_pdf-extract_ts_15_f5hl._.js.map