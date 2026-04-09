import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type ClubPublic, ClubsService, type ClubUpdate } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import useCustomToast from "@/hooks/useCustomToast"

const clubSchema = z.object({
  name: z.string().min(1, "Club name is mandatory"),
  logo: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  ea_id: z.string().optional(),
})

type ClubFormValues = z.infer<typeof clubSchema>

interface EditClubProps {
  club: ClubPublic
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EditClub = ({ club, open, onOpenChange }: EditClubProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<ClubFormValues>({
    resolver: zodResolver(clubSchema),
    defaultValues: {
      name: club.name,
      logo: club.logo || "",
      ea_id: club.ea_id || "",
    },
  })

  // Reset form whenever the dialog is opened or the club prop changes
  useEffect(() => {
    form.reset({
      name: club.name,
      logo: club.logo || "",
      ea_id: club.ea_id || "",
    })
  }, [club, form])

  const mutation = useMutation({
    mutationFn: (data: ClubUpdate) =>
      ClubsService.updateClub({ id: club.id, requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Club updated successfully")
      onOpenChange(false)
      // Invalidate ALL club queries (including filtered ones like ["clubs", search])
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "clubs",
      })
    },
    onError: (error) => {
      showErrorToast("Error updating club", error)
    },
  })

  const onSubmit = (data: ClubFormValues) => {
    mutation.mutate({
      name: data.name,
      logo: data.logo || null,
      ea_id: data.ea_id || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Club</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Club Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter club name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/logo.png"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ea_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EA ID (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter EA ID or leave blank to auto-fetch"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditClub
