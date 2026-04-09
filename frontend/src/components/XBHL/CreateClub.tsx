import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type React from "react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type ClubCreate, ClubsService } from "@/client"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"

const clubSchema = z.object({
  name: z.string().min(1, "Club name is mandatory"),
  logo: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  ea_id: z.string().optional(),
})

type ClubFormValues = z.infer<typeof clubSchema>

interface CreateClubProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CreateClub = ({ open, onOpenChange }: CreateClubProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single")
  const [bulkText, setBulkText] = useState("")

  const form = useForm<ClubFormValues>({
    resolver: zodResolver(clubSchema),
    defaultValues: {
      name: "",
      logo: "",
      ea_id: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ClubCreate) =>
      ClubsService.createClub({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Club created successfully")
      onOpenChange(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: ["clubs"] })
    },
    onError: (error) => {
      showErrorToast("Error creating club", error)
    },
  })

  const bulkMutation = useMutation({
    mutationFn: (data: ClubCreate[]) =>
      ClubsService.bulkCreateClubs({ requestBody: data }),
    onSuccess: (res) => {
      showSuccessToast(res.message)
      onOpenChange(false)
      setBulkText("")
      queryClient.invalidateQueries({ queryKey: ["clubs"] })
    },
    onError: (error) => {
      showErrorToast("Error creating clubs", error)
    },
  })

  const onSubmit = (data: ClubFormValues) => {
    mutation.mutate({
      name: data.name,
      logo: data.logo || undefined,
      ea_id: data.ea_id || undefined,
    })
  }

  const handleBulkSubmit = () => {
    const lines = bulkText.split("\n").filter((line) => line.trim() !== "")
    const clubs: ClubCreate[] = lines.map((line) => {
      const parts = line.split(/[,|]/)
      const name = parts[0].trim().replace(/\s+/g, " ")
      const logo = parts[1]?.trim()
      return {
        name,
        logo: logo || undefined,
      }
    })

    if (clubs.length === 0) {
      showErrorToast(
        "No valid clubs found in bulk text",
        new Error("Invalid input"),
      )
      return
    }

    bulkMutation.mutate(clubs)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Club</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "single" | "bulk")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single Club</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Add</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4 py-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
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
                          placeholder="Fetch automatically if left blank"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Creating..." : "Create Club"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4 py-4">
            <div className="space-y-2 flex flex-col">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Clubs (One per line: Name, LogoURL)
              </label>
              <textarea
                placeholder={
                  "Club 1, http://logo.url/1\nClub 2\nClub 3, http://logo.url/3"
                }
                className={cn(
                  "flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                )}
                value={bulkText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setBulkText(e.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                Logo is optional. Names will be cleaned of extra spaces
                automatically.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={handleBulkSubmit}
                disabled={bulkMutation.isPending || bulkText.trim() === ""}
              >
                {bulkMutation.isPending
                  ? "Creating..."
                  : `Create ${bulkText.split("\n").filter((l) => l.trim() !== "").length} Clubs`}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default CreateClub
