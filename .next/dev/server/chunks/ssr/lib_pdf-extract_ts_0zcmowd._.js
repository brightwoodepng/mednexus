module.exports = [
"[project]/lib/pdf-extract.ts [app-ssr] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/ssr/node_modules_pdfjs-dist_build_pdf_mjs_0~35h.1._.js",
  "server/chunks/ssr/lib_pdf-extract_ts_0gzc7se._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/lib/pdf-extract.ts [app-ssr] (ecmascript)");
    });
});
}),
];