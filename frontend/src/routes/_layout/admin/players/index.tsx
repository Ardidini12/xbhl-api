import { createFileRoute } from "@tanstack/react-router"
import Players from "@/components/Admin/Players"

export const Route = createFileRoute("/_layout/admin/players/")({
  component: Players,
})
