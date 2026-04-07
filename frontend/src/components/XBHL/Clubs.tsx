import { useInfiniteQuery } from "@tanstack/react-query"
import { AlertCircle, Plus, Search, Trash } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { type ClubPublic, ClubsService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import ClubActions from "./ClubActions"
import CreateClub from "./CreateClub"
import DeleteClub from "./DeleteClub"

const Clubs = () => {
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [search, setSearch] = useState("")
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["clubs", search],
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
    })

  const allClubs = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? []
  }, [data])

  const totalClubs = data?.pages[0]?.count ?? 0

  useEffect(() => {
    setSelectedIds([])
  }, [search])

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
    const allVisibleIds = allClubs.map((c) => c.id)
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
        <h1 className="text-2xl font-bold tracking-tight">Clubs</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash className="mr-2 size-4" />
              Delete {selectedIds.length} selected
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Club
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search clubs..."
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
            Error loading clubs. Please try again or refresh the page.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_2fr_1fr_auto] gap-4 px-4 py-3 bg-muted/50 border-b items-center font-medium text-sm">
          <Checkbox
            checked={
              allClubs.length > 0 &&
              allClubs.every((c) => selectedIds.includes(c.id))
            }
            onCheckedChange={toggleSelectAll}
          />
          <div className="w-12 h-12 flex items-center justify-center">Logo</div>
          <div>Name</div>
          <div>EA ID</div>
          <div className="w-8" />
        </div>

        <div className="divide-y">
          {allClubs.map((club: ClubPublic) => (
            <div
              key={club.id}
              className="grid grid-cols-[auto_1fr_2fr_1fr_auto] gap-4 px-4 py-3 hover:bg-muted/50 transition-colors items-center"
            >
              <Checkbox
                checked={selectedIds.includes(club.id)}
                onCheckedChange={() => toggleSelect(club.id)}
              />
              <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded-md border bg-muted/20">
                {club.logo ? (
                  <img
                    src={club.logo}
                    alt={club.name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="font-semibold truncate">{club.name}</div>
              <div className="text-sm text-muted-foreground font-mono">
                {club.ea_id || "N/A"}
              </div>
              <ClubActions club={club} />
            </div>
          ))}

          {status === "pending" && (
            <div className="p-8 text-center text-muted-foreground">
              Loading clubs...
            </div>
          )}

          {allClubs.length === 0 && status === "success" && (
            <div className="p-8 text-center text-muted-foreground">
              No clubs found.
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
              : allClubs.length > 0
                ? `Total clubs: ${totalClubs}`
                : null}
        </div>
      </div>

      <CreateClub open={createOpen} onOpenChange={setCreateOpen} />
      {deleteOpen && (
        <DeleteClub
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

export default Clubs
