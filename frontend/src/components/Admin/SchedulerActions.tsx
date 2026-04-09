import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MoreVertical, Play, Square, Trash, Edit } from "lucide-react"
import { useState } from "react"

import { type SchedulerPublic, SchedulersService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import DeleteScheduler from "./DeleteScheduler"
import EditScheduler from "./EditScheduler"

interface SchedulerActionsProps {
  scheduler: SchedulerPublic
}

const SchedulerActions = ({ scheduler }: SchedulerActionsProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const toggleMutation = useMutation({
    mutationFn: () => {
      if (scheduler.is_enabled) {
        return SchedulersService.stopScheduler({ id: scheduler.id })
      }
      return SchedulersService.startScheduler({ id: scheduler.id })
    },
    onSuccess: () => {
      showSuccessToast(`Scheduler ${scheduler.is_enabled ? "stopped" : "started"} successfully`)
    },
    onError: (err: any) => {
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["schedulers"] })
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
          <DropdownMenuItem onClick={() => toggleMutation.mutate()}>
            {scheduler.is_enabled ? (
              <>
                <Square className="mr-2 size-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" />
                Start
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            <Trash className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditScheduler
        scheduler={scheduler}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteScheduler
        id={scheduler.id}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

export default SchedulerActions
