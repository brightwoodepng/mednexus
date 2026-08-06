import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { EconomySeasonsWorkspace } from "@/components/admin/economy-seasons-workspace"

export default async function EconomySeasonsPage(){
  const admin=await getVerifiedAdminFromCookie("manage_system")
  if(!admin)redirect("/admin")
  return <EconomySeasonsWorkspace canReset={admin.role==="SUPER_ADMIN"}/>
}
