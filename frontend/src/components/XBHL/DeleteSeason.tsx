import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SeasonsService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { LoadingButton } from "@/components/ui/loading-button"

interface DeleteSeasonProps {
  ids: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const DeleteSeason = ({ ids, open, onOpenChange, onSuccess }: DeleteSeasonProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () => {
      if (ids.length === 1) {
        return SeasonsService.deleteSeason({ id: ids[0] })
      }
      return SeasonsService.bulkDeleteSeasons({ requestBody: ids })
    },
    onSuccess: () => {
      showSuccessToast(
        ids.length === 1
          ? "Season deleted successfully"
          : `${ids.length} seasons deleted successfully`
      )
      onOpenChange(false)
      onSuccess?.()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons"] })
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
              ? "This season will be permanently deleted. This action cannot be undone."
              : `These ${ids.length} seasons will be permanently deleted. This action cannot be undone.`}
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

export default DeleteSeason
