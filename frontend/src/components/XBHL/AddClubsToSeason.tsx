import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { type ClubPublic, ClubsService, SeasonsService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import useCustomToast from "@/hooks/useCustomToast"

interface AddClubsToSeasonProps {
  seasonId: string
  existingClubIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AddClubsToSeason = ({
  seasonId,
  existingClubIds,
  open,
  onOpenChange,
}: AddClubsToSeasonProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["clubs", "all", search],
      queryFn: ({ pageParam = 0 }) =>
        ClubsService.readClubs({
          skip: pageParam as number,
          limit: 25,
          search: search || undefined,
        }),
      getNextPageParam: (lastPage, allPages) => {
        const currentCount = allPages.reduce(
          (acc, page) => acc + page.data.length,
          0,
        )
        return currentCount < lastPage.count ? currentCount : undefined
      },
      initialPageParam: 0,
      enabled: open,
    })

  const availableClubs = useMemo(() => {
    const all = data?.pages.flatMap((page) => page.data) ?? []
    return all.filter((club) => !existingClubIds.includes(club.id))
  }, [data, existingClubIds])

  useEffect(() => {
    if (!open) {
      setSelectedIds([])
      setSearch("")
    }
  }, [open])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const addClubsMutation = useMutation({
    mutationFn: (ids: string[]) =>
      SeasonsService.addClubsToSeason({
        id: seasonId,
        requestBody: ids,
      }),
    onSuccess: () => {
      showSuccessToast("Clubs added to season")
      queryClient.invalidateQueries({ queryKey: ["season-clubs", seasonId] })
      onOpenChange(false)
    },
    onError: (err) => {
      showErrorToast("Error adding clubs to season", err)
    },
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const handleAdd = () => {
    if (selectedIds.length > 0) {
      addClubsMutation.mutate(selectedIds)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Clubs to Season</DialogTitle>
          <DialogDescription>
            Select clubs to participate in this season.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search clubs..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto border rounded-md">
            <div className="divide-y">
              {availableClubs.map((club: ClubPublic) => (
                <div
                  key={club.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`club-${club.id}`}
                    checked={selectedIds.includes(club.id)}
                    onCheckedChange={() => toggleSelect(club.id)}
                  />
                  <div className="w-8 h-8 flex items-center justify-center overflow-hidden rounded border bg-muted/20 flex-shrink-0">
                    {club.logo ? (
                      <img
                        src={club.logo}
                        alt={club.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        No logo
                      </span>
                    )}
                  </div>
                  <label
                    htmlFor={`club-${club.id}`}
                    className="flex-1 text-sm font-medium leading-none cursor-pointer truncate"
                  >
                    {club.name}
                  </label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {club.ea_id}
                  </span>
                </div>
              ))}

              {status === "pending" && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              )}

              {availableClubs.length === 0 && status === "success" && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No more clubs found.
                </div>
              )}

              <div ref={loadMoreRef} className="h-1" />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.length === 0 || addClubsMutation.isPending}
          >
            Add {selectedIds.length} Club(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AddClubsToSeason
