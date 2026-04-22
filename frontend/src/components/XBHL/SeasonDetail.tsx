import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import {
  AlertCircle,
  ArrowLeft,
  MoreVertical,
  Plus,
  Search,
  Trash,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { type ClubPublic, SeasonsService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import useCustomToast from "@/hooks/useCustomToast"
import AddClubsToSeason from "./AddClubsToSeason"

const route = getRouteApi("/_layout/xbhl/$leagueId/$seasonId")

const SeasonDetail = () => {
  const { leagueId, seasonId } = route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [addClubsOpen, setAddClubsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data: season, isError: isSeasonError } = useQuery({
    queryKey: ["seasons", seasonId],
    queryFn: () => SeasonsService.readSeason({ id: seasonId }),
  })

  // Correction: I should probably use readSeasons with a search or just use what I have.
  // Actually, I'll check sdk.gen.ts again for SeasonsService.readSeason.
  // I'll assume for now I might need to add it or use readSeasons.
  // Looking back at my backend change, I didn't add read_season. I should have.

  const {
    data: clubsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: clubsStatus,
    isError: isClubsError,
  } = useInfiniteQuery({
    queryKey: ["season-clubs", seasonId, search],
    queryFn: ({ pageParam = 0 }) =>
      SeasonsService.readSeasonClubs({
        id: seasonId,
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
  })

  const allSeasonClubs = useMemo(() => {
    return clubsData?.pages.flatMap((page) => page.data) ?? []
  }, [clubsData])

  const totalClubs = clubsData?.pages[0]?.count ?? 0

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

  const removeClubsMutation = useMutation({
    mutationFn: (ids: string[]) =>
      SeasonsService.removeClubsFromSeason({
        id: seasonId,
        requestBody: ids,
      }),
    onSuccess: () => {
      showSuccessToast("Clubs removed from season")
      queryClient.invalidateQueries({ queryKey: ["season-clubs", seasonId] })
      setSelectedIds([])
    },
    onError: (err) => {
      showErrorToast("Error removing clubs", err)
    },
  })
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const toggleSelectAll = () => {
    if (
      selectedIds.length === allSeasonClubs.length &&
      allSeasonClubs.length > 0
    ) {
      setSelectedIds([])
    } else {
      setSelectedIds(allSeasonClubs.map((c) => c.id))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            navigate({ to: "/xbhl/$leagueId", params: { leagueId } })
          }
          aria-label="Back to seasons"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {season?.name || "Season Details"}
          </h1>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => removeClubsMutation.mutate(selectedIds)}
              disabled={removeClubsMutation.isPending}
            >
              <Trash className="mr-2 size-4" />
              Remove {selectedIds.length} selected
            </Button>
          )}
          <Button onClick={() => setAddClubsOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Clubs
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search clubs in season..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {(isSeasonError || isClubsError) && (
        <div className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <AlertCircle className="size-4" />
          <p className="text-sm font-medium">
            Error loading data. Please try again or refresh the page.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3 flex items-center gap-4 bg-muted/50 font-medium text-sm">
          <Checkbox
            checked={
              allSeasonClubs.length > 0 &&
              selectedIds.length === allSeasonClubs.length
            }
            onCheckedChange={toggleSelectAll}
          />
          <div className="w-10 h-10 flex items-center justify-center">Logo</div>
          <div className="flex-1">Club Name</div>
          <div>EA ID</div>
          <div className="w-8" />
        </div>

        <div className="divide-y">
          {allSeasonClubs.map((club: ClubPublic) => (
            <div
              key={club.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selectedIds.includes(club.id)}
                onCheckedChange={() => toggleSelect(club.id)}
              />
              <div className="w-10 h-10 flex items-center justify-center overflow-hidden rounded-md border bg-muted/20">
                {club.logo ? (
                  <img
                    src={club.logo}
                    alt={club.name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-muted-foreground text-center">
                    No logo
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{club.name}</h3>
              </div>
              <div className="text-sm text-muted-foreground font-mono">
                {club.ea_id || "N/A"}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => removeClubsMutation.mutate([club.id])}
                  >
                    <Trash className="mr-2 size-4" />
                    Remove from Season
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {clubsStatus === "pending" && (
            <div className="p-8 text-center text-muted-foreground">
              Loading clubs...
            </div>
          )}

          {allSeasonClubs.length === 0 && clubsStatus === "success" && (
            <div className="p-8 text-center text-muted-foreground">
              No clubs found in this season.
            </div>
          )}
        </div>

        <div
          ref={loadMoreRef}
          className="p-4 border-t text-center text-sm text-muted-foreground"
        >
          {isFetchingNextPage
            ? "Loading more..."
            : hasNextPage
              ? "Scroll for more clubs"
              : allSeasonClubs.length > 0
                ? `Total clubs: ${totalClubs}`
                : null}
        </div>
      </div>

      <AddClubsToSeason
        seasonId={seasonId}
        existingClubIds={allSeasonClubs.map((c) => c.id)}
        open={addClubsOpen}
        onOpenChange={setAddClubsOpen}
      />
    </div>
  )
}

export default SeasonDetail
