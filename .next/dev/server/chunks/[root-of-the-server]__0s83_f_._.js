module.exports = [
"[project]/lib/db.ts [app-route] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/[root-of-the-server]__0blzg-0._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/lib/db.ts [app-route] (ecmascript)");
    });
});
}),
"[project]/lib/firebase-admin.ts [app-route] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/[root-of-the-server]__0txlnhc._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/lib/firebase-admin.ts [app-route] (ecmascript)");
    });
});
}),
"[externals]/firebase-admin/firestore [external] (firebase-admin/firestore, esm_import, [project]/node_modules/.pnpm/firebase-admin@14.1.0/node_modules/firebase-admin, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/[externals]_firebase-admin_firestore_1cv9lkl._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[externals]/firebase-admin/firestore [external] (firebase-admin/firestore, esm_import, [project]/node_modules/.pnpm/firebase-admin@14.1.0/node_modules/firebase-admin)");
    });
});
}),
"[project]/app/api/sync/route.ts [app-route] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.resolve().then(() => {
        return parentImport("[project]/app/api/sync/route.ts [app-route] (ecmascript)");
    });
});
}),
];