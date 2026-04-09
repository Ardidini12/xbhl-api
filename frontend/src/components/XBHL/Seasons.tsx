import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { format } from "date-fns"
import { AlertCircle, ArrowLeft, Plus, Search, Trash } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { LeaguesService, type SeasonPublic, SeasonsService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import CreateSeason from "./CreateSeason"
import DeleteSeason from "./DeleteSeason"
import SeasonActions from "./SeasonActions"

const route = getRouteApi("/_layout/xbhl/$leagueId")

const Seasons = () => {
  const { leagueId } = route.useParams()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [search, setSearch] = useState("")
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!leagueId || leagueId === "undefined") {
      navigate({ to: "/xbhl" })
    }
  }, [leagueId, navigate])

  useEffect(() => {
    setSelectedIds([])
  }, [leagueId])

  const { data: league, isError: isLeagueError } = useQuery({
    queryKey: ["leagues", leagueId],
    queryFn: () => LeaguesService.readLeague({ id: leagueId }),
    enabled: !!leagueId && leagueId !== "undefined",
  })

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    isError: isSeasonsError,
  } = useInfiniteQuery({
    queryKey: ["seasons", leagueId, search],
    queryFn: ({ pageParam = 0 }) =>
      SeasonsService.readSeasons({
        leagueId: leagueId!,
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
    enabled: !!leagueId && leagueId !== "undefined",
  })

  const allSeasons = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? []
  }, [data])

  const totalSeasons = data?.pages[0]?.count ?? 0

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === allSeasons.length && allSeasons.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(allSeasons.map((s) => s.id))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/xbhl" })}
          aria-label="Back to leagues"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {league ? `${league.name} Seasons` : "Seasons"}
          </h1>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash className="mr-2 size-4" />
              Delete {selectedIds.length} selected
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Season
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search seasons..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Format: "YYYY-MM-DD", "Month YYYY", or just "YYYY" to filter by date.
        </p>
      </div>

      {(isLeagueError || isSeasonsError) && (
        <div className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <AlertCircle className="size-4" />
          <p className="text-sm font-medium">
            Error loading data. Please try again or refresh the page.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3 flex items-center gap-4 bg-muted/50">
          <Checkbox
            checked={
              allSeasons.length > 0 && selectedIds.length === allSeasons.length
            }
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">Select All</span>
        </div>

        <div className="divide-y">
          {allSeasons.map((season: SeasonPublic) => (
            <div
              key={season.id}
              className="flex items-center gap-4 px-4 py-4 hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selectedIds.includes(season.id)}
                onCheckedChange={() => toggleSelect(season.id)}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">
                  {season.name}
                </h3>
                <p className="text-xs text-muted-foreground mb-1">
                  {season.start_date &&
                    format(new Date(season.start_date), "PP")}
                  {season.end_date
                    ? ` - ${format(new Date(season.end_date), "PP")}`
                    : " - Present"}
                </p>
                {season.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {season.description}
                  </p>
                )}
              </div>
              <SeasonActions season={season} />
            </div>
          ))}

          {status === "pending" && (
            <div className="p-8 text-center text-muted-foreground">
              Loading seasons...
            </div>
          )}

          {allSeasons.length === 0 && status === "success" && (
            <div className="p-8 text-center text-muted-foreground">
              No seasons found.
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
              ? "Scroll for more seasons"
              : allSeasons.length > 0
                ? `Total seasons: ${totalSeasons}`
                : null}
        </div>
      </div>

      <CreateSeason
        open={createOpen}
        onOpenChange={setCreateOpen}
        leagueId={leagueId}
      />
      {deleteOpen && (
        <DeleteSeason
          ids={selectedIds}
          leagueId={leagueId}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onSuccess={() => {
            setSelectedIds([])
            setDeleteOpen(false)
          }}
        />
      )}
    </div>
  )
}

export default Seasons