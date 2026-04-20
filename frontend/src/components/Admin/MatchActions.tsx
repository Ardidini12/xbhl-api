import { MoreVertical, Trash } from "lucide-react"
import { useState } from "react"

import type { MatchPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteMatch from "./DeleteMatch"

interface MatchActionsProps {
  match: MatchPublic
}

const MatchActions = ({ match }: MatchActionsProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            <Trash className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteMatch
        id={match.match_id}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

export default MatchActions
