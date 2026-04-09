import { useInfiniteQuery } from "@tanstack/react-query"
import { AlertCircle, Plus, Search, Trash } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { type LeaguePublic, LeaguesService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import CreateLeague from "./CreateLeague"
import DeleteLeague from "./DeleteLeague"
import LeagueActions from "./LeagueActions"

const Leagues = () => {
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [search, setSearch] = useState("")
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["leagues", search],
      queryFn: ({ pageParam = 0 }) =>
        LeaguesService.readLeagues({
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

  const allLeagues = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? []
  }, [data])

  const totalLeagues = data?.pages[0]?.count ?? 0

  useEffect(() => {
    setSelectedIds([])
  }, [])

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
    const allVisibleIds = allLeagues.map((l) => l.id)
    const allSelected =
      allVisibleIds.length > 0 &&
      allVisibleIds.every((id) => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leagues</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash className="mr-2 size-4" />
              Delete {selectedIds.length} selected
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create League
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search leagues..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {status === "error" && (
        <div className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <AlertCircle className="size-4" />
          <p className="text-sm font-medium">
            Error loading leagues. Please try again or refresh the page.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3 flex items-center gap-4 bg-muted/50">
          <Checkbox
            checked={
              allLeagues.length > 0 &&
              allLeagues.every((l) => selectedIds.includes(l.id))
            }
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">Select All</span>
        </div>

        <div className="divide-y">
          {allLeagues.map((league: LeaguePublic) => (
            <div
              key={league.id}
              className="flex items-center gap-4 px-4 py-4 hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selectedIds.includes(league.id)}
                onCheckedChange={() => toggleSelect(league.id)}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">
                  {league.name}
                </h3>
                {league.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {league.description}
                  </p>
                )}
              </div>
              <LeagueActions league={league} />
            </div>
          ))}

          {status === "pending" && (
            <div className="p-8 text-center text-muted-foreground">
              Loading leagues...
            </div>
          )}

          {allLeagues.length === 0 && status === "success" && (
            <div className="p-8 text-center text-muted-foreground">
              No leagues found.
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
              ? "Scroll for more leagues"
              : allLeagues.length > 0
                ? `Total leagues: ${totalLeagues}`
                : null}
        </div>
      </div>

      <CreateLeague open={createOpen} onOpenChange={setCreateOpen} />
      {deleteOpen && (
        <DeleteLeague
          ids={selectedIds}
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

export default Leagues
