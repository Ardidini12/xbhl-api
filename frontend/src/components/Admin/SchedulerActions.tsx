import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Edit, MoreVertical, Play, PlayCircle, Square, Trash } from "lucide-react"
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
      showSuccessToast(
        `Scheduler ${scheduler.is_enabled ? "stopped" : "started"} successfully`,
      )
    },
    onError: (err: any) => {
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["schedulers"] })
    },
  })

  const runNowMutation = useMutation({
    mutationFn: () => SchedulersService.runSchedulerNow({ id: scheduler.id }),
    onSuccess: (data) => {
      showSuccessToast(
        `Manual pull completed: ${data.last_run_status || "Success"}`,
      )
    },
    onError: (err: any) => {
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["schedulers"] })
      queryClient.invalidateQueries({ queryKey: ["matches"] })
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
          <DropdownMenuItem
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending}
          >
            <Play className="mr-2 size-4 text-green-500" />
            Run Now
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          >
            {scheduler.is_enabled ? (
              <>
                <Square className="mr-2 size-4" />
                Stop
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 size-4" />
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
