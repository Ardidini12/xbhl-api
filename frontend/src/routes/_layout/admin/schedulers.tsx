import { createFileRoute } from "@tanstack/react-router"
import Schedulers from "@/components/Admin/Schedulers"

export const Route = createFileRoute("/_layout/admin/schedulers")({
  component: Schedulers,
})
