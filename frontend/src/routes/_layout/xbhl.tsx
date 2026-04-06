import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { UsersService } from "@/client"
import { z } from "zod"

const XbhlLayout = () => {
  return <Outlet />
}

const xbhlSearchSchema = z.object({
  search: z.string().optional(),
})

export const Route = createFileRoute("/_layout/xbhl")({
  component: XbhlLayout,
  validateSearch: (search) => xbhlSearchSchema.parse(search),
  beforeLoad: async () => {
    const user = await UsersService.readUserMe()
    if (!user.is_superuser) {
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: "XBHL",
      },
    ],
  }),
})
