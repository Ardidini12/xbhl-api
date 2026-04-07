import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LeaguesService } from "@/client"
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

interface DeleteLeagueProps {
  ids: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const DeleteLeague = ({
  ids,
  open,
  onOpenChange,
  onSuccess,
}: DeleteLeagueProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => {
      if (ids.length === 1) {
        return LeaguesService.deleteLeague({ id: ids[0] })
      }
      return LeaguesService.bulkDeleteLeagues({ requestBody: ids })
    },
    onSuccess: () => {
      showSuccessToast(
        ids.length === 1
          ? "League deleted successfully"
          : `${ids.length} leagues deleted successfully`,
      )
      onOpenChange(false)
      onSuccess?.()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues"] })
    },
  })

  const handleDelete = () => {
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            {ids.length === 1
              ? "This league will be permanently deleted. This action cannot be undone."
              : `These ${ids.length} leagues will be permanently deleted. This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <LoadingButton
            variant="destructive"
            onClick={handleDelete}
            loading={mutation.isPending}
          >
            Delete
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteLeague
