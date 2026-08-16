import { GroupStudyRoom } from "@/components/group-study/group-study-room"

export default async function GroupStudyRoomPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params
  return <GroupStudyRoom pin={pin} />
}
