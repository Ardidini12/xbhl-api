import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, User } from "lucide-react"

import { PlayersService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

const route = getRouteApi("/_layout/admin/players/$eaId")

const PlayerDetail = () => {
  const { eaId } = route.useParams()
  const navigate = useNavigate()

  const { data: player, status } = useQuery({
    queryKey: ["player", eaId],
    queryFn: () => PlayersService.readPlayer({ eaId }),
  })

  if (status === "pending") {
    return <div className="p-8 text-center">Loading player details...</div>
  }

  if (status === "error" || !player) {
    return (
      <div className="p-8 text-center text-destructive">
        Error loading player details.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/admin/players" })}
          aria-label="Back to players"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold">Player Details</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              {player.gamertag}
            </CardTitle>
            <Badge
              variant="outline"
              className="w-fit bg-white text-black font-bold border-none"
            >
              {player.most_frequent_position || "N/A"}
            </Badge>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}

export default PlayerDetail
