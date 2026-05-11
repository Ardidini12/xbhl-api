import { Edit, MoreVertical, Trash } from "lucide-react"
import { useState } from "react"
import type { LeaguePublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteLeague from "./DeleteLeague"
import EditLeague from "./EditLeague"

interface LeagueActionsProps {
  league: LeaguePublic
}

const LeagueActions = ({ league }: LeagueActionsProps) => {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open actions menu">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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

      <EditLeague league={league} open={editOpen} onOpenChange={setEditOpen} />
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
