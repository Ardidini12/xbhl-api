import { Edit, MoreVertical, Trash } from "lucide-react"
import { useState } from "react"

import type { ClubPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteClub from "./DeleteClub"
import EditClub from "./EditClub"

interface ClubActionsProps {
  club: ClubPublic
}

const ClubActions = ({ club }: ClubActionsProps) => {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 p-0">
            <MoreVertical className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">

          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditClub club={club} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteClub
        ids={[club.id]}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

export default ClubActions
