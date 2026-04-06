import { MoreVertical, Edit, Trash, LogIn, CalendarX } from "lucide-react"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { SeasonsService, type SeasonPublic } from "@/client"
import EditSeason from "./EditSeason"
import DeleteSeason from "./DeleteSeason"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface SeasonActionsProps {
  season: SeasonPublic
}

const SeasonActions = ({ season }: SeasonActionsProps) => {
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
          <Button variant="ghost" size="icon">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => {}} disabled>
            <LogIn className="mr-2 size-4" />
            Enter Season
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          {!season.end_date && (
            <DropdownMenuItem onClick={() => endSeasonMutation.mutate()}>
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

      <EditSeason
        season={season}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteSeason
        ids={[season.id]}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => setDeleteOpen(false)}
      />
    </>
  )
}

export default SeasonActions
