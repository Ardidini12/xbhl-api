import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { CalendarX, Edit, LogIn, MoreVertical, Trash } from "lucide-react"
import { useState } from "react"
import { type SeasonPublic, SeasonsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import DeleteSeason from "./DeleteSeason"
import EditSeason from "./EditSeason"

interface SeasonActionsProps {
  season: SeasonPublic
}

const SeasonActions = ({ season }: SeasonActionsProps) => {
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const endSeasonMutation = useMutation({
    mutationFn: () => SeasonsService.endSeason({ id: season.id }),
    onSuccess: () => {
      showSuccessToast("Season ended successfully")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", season.league_id] })
    },
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open actions menu">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: "/xbhl/$leagueId/$seasonId",
                params: {
                  leagueId: season.league_id,
                  seasonId: season.id,
                },
              })
            }
          >
            <LogIn className="mr-2 size-4" />
            Enter Season
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          {!season.end_date && (
            <DropdownMenuItem
              onClick={() => endSeasonMutation.mutate()}
              disabled={endSeasonMutation.isPending}
            >
              <CalendarX className="mr-2 size-4" />
              End Season
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            <Trash className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditSeason season={season} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteSeason
        ids={[season.id]}
        leagueId={season.league_id}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => setDeleteOpen(false)}
      />
    </>
  )
}

export default SeasonActions
