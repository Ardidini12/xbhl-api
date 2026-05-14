import { createFileRoute } from "@tanstack/react-router"
import ClubDetail from "@/components/XBHL/ClubDetail"

export const Route = createFileRoute("/_layout/admin/clubs/$clubId")({
  component: ClubDetail,
})
