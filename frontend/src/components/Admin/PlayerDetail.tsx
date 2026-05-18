import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, User } from "lucide-react"

import { PlayersService } from "@/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            {player.gamertag}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Player details can be added here in the future */}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PlayerDetail
