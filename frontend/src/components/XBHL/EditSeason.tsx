import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useEffect } from "react"
import { format } from "date-fns"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SeasonsService, type SeasonPublic, type SeasonUpdate } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { LoadingButton } from "@/components/ui/loading-button"

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(255).optional(),
  start_date: z.string().optional(),
})

interface EditSeasonProps {
  season: SeasonPublic
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EditSeason = ({ season, open, onOpenChange }: EditSeasonProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: season.name,
      description: season.description || "",
      start_date: season.start_date ? format(new Date(season.start_date), "yyyy-MM-dd'T'HH:mm") : "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: season.name,
        description: season.description || "",
        start_date: season.start_date ? format(new Date(season.start_date), "yyyy-MM-dd'T'HH:mm") : "",
      })
    }
  }, [open, season, form])

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) =>
      SeasonsService.updateSeason({
        id: season.id,
        requestBody: {
          ...data,
          start_date: data.start_date ? new Date(data.start_date).toISOString() : null,
        } as SeasonUpdate,
      }),
    onSuccess: () => {
      showSuccessToast("Season updated successfully")
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", season.league_id] })
    },
  })

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Season</DialogTitle>
          <DialogDescription>Update the season details below.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter season name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Save Changes
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditSeason
