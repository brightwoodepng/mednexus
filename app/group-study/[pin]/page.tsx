import { GroupStudyRoom } from "@/components/group-study/group-study-room"
import { GroupStudyWorkspaceShell } from "@/components/group-study/group-study-workspace-shell"

export default async function GroupStudyRoomPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params
  return <GroupStudyWorkspaceShell><GroupStudyRoom pin={pin} /></GroupStudyWorkspaceShell>
}
