import { useMutation, useQueryClient } from "@tanstack/react-query"

import { ClubsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"

interface DeleteClubProps {
  ids: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const DeleteClub = ({
  ids,
  open,
  onOpenChange,
  onSuccess,
}: DeleteClubProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const deleteSingleMutation = useMutation({
    mutationFn: (id: string) => ClubsService.deleteClub({ id }),
    onSuccess: () => {
      showSuccessToast("Club deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["clubs"] })
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error) => {
      showErrorToast("Error deleting club", error)
    },
  })

  const deleteBulkMutation = useMutation({
    mutationFn: (ids: string[]) =>
      ClubsService.bulkDeleteClubs({ requestBody: ids }),
    onSuccess: () => {
      showSuccessToast("Clubs deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["clubs"] })
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error) => {
      showErrorToast("Error deleting clubs", error)
    },
  })

  const handleDelete = () => {
    if (ids.length === 1) {
      deleteSingleMutation.mutate(ids[0])
    } else {
      deleteBulkMutation.mutate(ids)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            {ids.length === 1
              ? "This action cannot be undone. This will permanently delete the club."
              : `This action cannot be undone. This will permanently delete ${ids.length} clubs.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteSingleMutation.isPending || deleteBulkMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            variant="destructive"
            disabled={deleteSingleMutation.isPending || deleteBulkMutation.isPending}
          >
            {deleteSingleMutation.isPending || deleteBulkMutation.isPending
              ? "Deleting..."
              : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteClub
