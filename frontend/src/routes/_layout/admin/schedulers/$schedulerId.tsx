import { createFileRoute } from "@tanstack/react-router"
import SchedulerDetail from "@/components/Admin/SchedulerDetail"

export const Route = createFileRoute("/_layout/admin/schedulers/$schedulerId")({
  component: SchedulerDetail,
})
