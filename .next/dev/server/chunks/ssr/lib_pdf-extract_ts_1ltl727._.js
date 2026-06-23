module.exports = [
"[project]/lib/pdf-extract.ts [app-ssr] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/ssr/0s7y_pdfjs-dist_build_pdf_mjs_0q1abgo._.js",
  "server/chunks/ssr/lib_pdf-extract_ts_0tpxk3m._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/lib/pdf-extract.ts [app-ssr] (ecmascript)");
    });
});
}),
];