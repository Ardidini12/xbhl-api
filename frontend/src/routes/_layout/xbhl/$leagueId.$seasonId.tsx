import { createFileRoute } from "@tanstack/react-router"
import SeasonDetail from "@/components/XBHL/SeasonDetail"

export const Route = createFileRoute("/_layout/xbhl/$leagueId/$seasonId")({
  component: SeasonDetail,
})
