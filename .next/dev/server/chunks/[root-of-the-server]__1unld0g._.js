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
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[project]/lib/admin-auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createAdminToken",
    ()=>createAdminToken,
    "verifyAdminToken",
    ()=>verifyAdminToken
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
;
const SECRET = process.env.ADMIN_SECRET ?? "mednexus-tok-9x2km4p7wq";
function createAdminToken(password) {
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const sig = __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].createHmac("sha256", SECRET).update(`${password}:${exp}`).digest("hex");
    return Buffer.from(JSON.stringify({
        exp,
        sig
    })).toString("base64url");
}
function verifyAdminToken(token) {
    try {
        const { exp, sig } = JSON.parse(Buffer.from(token, "base64url").toString());
        if (!exp || !sig) return false;
        if (exp < Math.floor(Date.now() / 1000)) return false;
        const password = process.env.ADMIN_PASSWORD;
        if (!password) return false;
        const expected = __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].createHmac("sha256", SECRET).update(`${password}:${exp}`).digest("hex");
        return __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    } catch  {
        return false;
    }
}
}),
"[project]/app/api/assessments/[id]/analytics/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.2.9_@babel+core@7.29.7_@opentelemetry+api@1.9.1_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$admin$2d$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/admin-auth.ts [app-route] (ecmascript)");
;
;
async function getPool() {
    if (!process.env.DATABASE_URL) return null;
    try {
        const { default: pool, ensureSchema } = await __turbopack_context__.A("[project]/lib/db.ts [app-route] (ecmascript, async loader)");
        await ensureSchema();
        return pool;
    } catch  {
        return null;
    }
}
async function GET(req, { params }) {
    try {
        const token = req.headers.get("x-admin-token") ?? "";
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$admin$2d$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifyAdminToken"])(token)) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Unauthorized"
        }, {
            status: 401
        });
        const { id } = await params;
        const pool = await getPool();
        if (!pool) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "No database"
        }, {
            status: 503
        });
        // Get assessment to find pass_mark
        const asmtRes = await pool.query("SELECT pass_mark, tries_allowed FROM mednexus_assessments WHERE id = $1", [
            id
        ]);
        if (!asmtRes.rows[0]) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Not found"
        }, {
            status: 404
        });
        const { pass_mark, tries_allowed } = asmtRes.rows[0];
        // Get all submitted attempts
        const attRes = await pool.query("SELECT user_id, user_name, is_guest, score, total FROM mednexus_assessment_attempts WHERE assessment_id = $1 AND submitted_at IS NOT NULL", [
            id
        ]);
        const rows = attRes.rows;
        const totalSubmitted = rows.length;
        const guestCount = rows.filter((r)=>r.is_guest).length;
        const registeredCount = rows.filter((r)=>!r.is_guest).length;
        const scores = rows.map((r)=>r.total > 0 ? Math.round(r.score / r.total * 100) : 0);
        const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b)=>a + b, 0) / scores.length) : 0;
        const passCount = scores.filter((s)=>s >= pass_mark).length;
        // Unique participants (by user_id)
        const uniqueUsers = new Set(rows.map((r)=>r.user_id)).size;
        // Recent attempts (last 20)
        const recentRes = await pool.query(`SELECT user_name, is_guest, score, total, submitted_at
       FROM mednexus_assessment_attempts
       WHERE assessment_id = $1 AND submitted_at IS NOT NULL
       ORDER BY submitted_at DESC LIMIT 20`, [
            id
        ]);
        const recentAttempts = recentRes.rows.map((r)=>({
                userName: r.user_name,
                isGuest: r.is_guest,
                score: r.score,
                total: r.total,
                percentage: r.total > 0 ? Math.round(r.score / r.total * 100) : 0,
                submittedAt: r.submitted_at
            }));
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            analytics: {
                totalSubmitted,
                uniqueParticipants: uniqueUsers,
                averageScore,
                passCount,
                guestCount,
                registeredCount,
                passMark: pass_mark,
                triesAllowed: tries_allowed
            },
            recentAttempts
        });
    } catch (err) {
        console.error("[analytics GET]", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Server error"
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1unld0g._.js.map