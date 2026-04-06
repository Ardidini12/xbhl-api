import { MoreVertical, Edit, Trash, LogIn } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import type { LeaguePublic } from "@/client"
import EditLeague from "./EditLeague"
import DeleteLeague from "./DeleteLeague"

interface LeagueActionsProps {
  league: LeaguePublic
}

const LeagueActions = ({ league }: LeagueActionsProps) => {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open actions menu">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate({ to: "/xbhl/$leagueId", params: { leagueId: league.id } })}>
            <LogIn className="mr-2 size-4" />
            Enter League
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            <Trash className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditLeague
        league={league}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteLeague
        ids={[league.id]}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => setDeleteOpen(false)}
      />
    </>
  )
}

export default LeagueActions
