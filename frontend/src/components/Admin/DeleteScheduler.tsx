import { useMutation, useQueryClient } from "@tanstack/react-query"
import { SchedulersService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface DeleteSchedulerProps {
  id: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DeleteScheduler = ({ id, open, onOpenChange }: DeleteSchedulerProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => SchedulersService.deleteScheduler({ id }),
    onSuccess: () => {
      showSuccessToast("Scheduler deleted successfully")
      onOpenChange(false)
    },
    onError: (err: any) => {
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["schedulers"] })
    },
  })

  const onDelete = () => {
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Scheduler</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this scheduler? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            variant="destructive"
            onClick={onDelete}
            loading={mutation.isPending}
          >
            Delete
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteScheduler
