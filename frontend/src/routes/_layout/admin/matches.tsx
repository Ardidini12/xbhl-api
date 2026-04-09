import { createFileRoute } from "@tanstack/react-router"
import Matches from "@/components/Admin/Matches"

export const Route = createFileRoute("/_layout/admin/matches")({
  component: Matches,
})
