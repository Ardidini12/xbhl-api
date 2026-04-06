import { createFileRoute } from "@tanstack/react-router"
import Leagues from "@/components/XBHL/Leagues"

export const Route = createFileRoute("/_layout/xbhl/")({
  component: Leagues,
})
