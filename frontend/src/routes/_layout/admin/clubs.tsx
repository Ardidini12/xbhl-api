import { createFileRoute } from "@tanstack/react-router"
import Clubs from "@/components/XBHL/Clubs"

export const Route = createFileRoute("/_layout/admin/clubs")({
  component: Clubs,
})
