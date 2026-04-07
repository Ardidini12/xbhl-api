import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { UsersService } from "@/client"

const AdminLayout = () => {
  return <Outlet />
}

export const Route = createFileRoute("/_layout/admin")({
  component: AdminLayout,
  beforeLoad: async () => {
    try {
      const user = await UsersService.readUserMe()
      if (!user.is_superuser) {
        throw redirect({
          to: "/",
        })
      }
    } catch (e) {
      if (e instanceof Error && "status" in e && e.status === 307) throw e
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Admin",
      },
    ],
  }),
})
