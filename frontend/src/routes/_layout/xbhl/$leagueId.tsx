import { createFileRoute } from "@tanstack/react-router"
import Seasons from "@/components/XBHL/Seasons"

export const Route = createFileRoute("/_layout/xbhl/$leagueId")({
  component: Seasons,
})
