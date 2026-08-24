import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFile(path, "utf8")

describe("professional admin MCQ manager", () => {
  it("uses one compact manager header and retains the compatibility view", async () => {
    const [page, workspace] = await Promise.all([
      read("app/admin/mcq/page.tsx"),
      read("components/admin/mcq-bank-workspace.tsx"),
    ])
    expect(page).not.toContain("CONTENT MANAGEMENT")
    expect(page).not.toContain("Create, edit, import, and publish")
    expect(workspace).toContain(">MCQ Bank</h1>")
    expect(workspace).toContain("<LayoutGrid size={16}/>Manager")
    expect(workspace).toContain('title="Compatibility editor"')
    expect(workspace).toContain("<ListTree size={16}/>Legacy")
    expect(workspace).not.toContain("Choose your management workspace")
  })

  it("provides reliable filtering, saved views, layouts, refresh, and bulk workflows", async () => {
    const manager = await read("components/admin/mcq-modern-workspace.tsx")
    expect(manager).toContain("requestRef.current?.abort()")
    expect(manager).toContain("The server returned an unreadable response")
    expect(manager).toContain('params.set("issues", "with")')
    expect(manager).toContain("mednexus.admin.mcq-manager-preferences.v1")
    expect(manager).toContain("Save view")
    expect(manager).toContain('aria-label="Grid view"')
    expect(manager).toContain('aria-label="List view"')
    expect(manager).toContain("Recently updated")
    expect(manager).toContain("Refresh")
    expect(manager).toContain('bulk("move"')
    expect(manager).toContain('bulk("tags"')
    expect(manager).toContain("Export selected")
    expect(manager).toContain('role="alert"')
  })

  it("returns structured failures and supports global issues, safe sorting, and selected export", async () => {
    const [questionsRoute, exportRoute] = await Promise.all([
      read("app/api/admin/mcq/questions/route.ts"),
      read("app/api/admin/content/export/route.ts"),
    ])
    expect(questionsRoute).toContain('req.nextUrl.searchParams.get("issues") === "with"')
    expect(questionsRoute).toContain("sortExpressions")
    expect(questionsRoute).toContain("issueCount")
    expect(questionsRoute).toContain('NextResponse.json({ error: "Unable to load the MCQ bank." }, { status: 500 })')
    expect(questionsRoute).toContain("(question.value->'options')::text ILIKE")
    expect(questionsRoute).toContain("(question.value->'tags')::text ILIKE")
    expect(questionsRoute).toContain('body.status === "live"')
    expect(questionsRoute).toContain("incomplete and cannot be published")
    expect(questionsRoute).toContain("await auditAdmin")
    expect(questionsRoute).toContain("runtimePool()")
    expect(questionsRoute).not.toContain("ensureSchema")
    expect(exportRoute).toContain('searchParams.getAll("id")')
    expect(exportRoute).toContain("selectedIds: ids.length")
  })

  it("selects entire canonical categories and keeps archived questions restorable", async () => {
    const [manager, route, legacy, context, statusHelper] = await Promise.all([
      read("components/admin/mcq-modern-workspace.tsx"),
      read("app/api/admin/mcq/questions/route.ts"),
      read("components/question-editor.tsx"),
      read("contexts/questions-context.tsx"),
      read("lib/mcq-status.ts"),
    ])
    expect(manager).toContain("Select an entire module")
    expect(manager).toContain("All disciplines in module")
    expect(manager).toContain('scope: { module: scope.module, subject: scope.subject }')
    expect(manager).toContain('bulk("status", { status: "review" })')
    expect(manager).toContain('bulk("status", { status: "archived" })')
    expect(route).toContain("cardinality($1::text[])=0")
    expect(route).toContain("statusBreakdown: before")
    expect(route).toContain("statusExpression}<>'archived'")
    expect(context).toContain("fetchAdminQuestionBank")
    expect(context).toContain("status=all")
    for (const status of ["draft", "review", "live", "offline", "archived"]) {
      expect(legacy).toContain(`<option value="${status}">`)
      expect(statusHelper).toContain(`"${status}"`)
    }
  })

  it("uses a task-based sidebar, one access snapshot, and persistent professional identity", async () => {
    const [shell, layout, access] = await Promise.all([
      read("components/admin-shell.tsx"),
      read("app/admin/layout.tsx"),
      read("lib/admin-access.ts"),
    ])
    for (const group of ["Overview", "Content", "Assessments", "People & Communications", "Platform"]) expect(shell).toContain(`label: "${group}"`)
    expect(shell).not.toContain('label: "OSCE Simulator"')
    expect(shell).not.toContain("SidebarProfileFooter")
    expect(shell).toContain('identity={identity}')
    expect(shell).toContain("mednexus.admin.sidebar-collapsed")
    expect(shell).toContain("identity.role.replaceAll")
    expect(layout).toContain("getVerifiedAdminSnapshotFromCookie")
    expect(layout).not.toContain("Promise.all")
    expect(access).toContain("getVerifiedAdminSnapshotFromCookie")
    expect(access).toContain("capabilities:")
  })
})
