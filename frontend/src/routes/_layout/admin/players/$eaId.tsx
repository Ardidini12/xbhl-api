import { createFileRoute } from "@tanstack/react-router"
import PlayerDetail from "@/components/Admin/PlayerDetail"

export const Route = createFileRoute("/_layout/admin/players/$eaId")({
  component: PlayerDetail,
})
