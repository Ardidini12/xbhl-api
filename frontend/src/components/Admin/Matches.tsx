import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Search, Trash, ChevronDown, ChevronUp } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { type MatchPublic, MatchesService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import MatchActions from "./MatchActions"

const Matches = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<string>("")
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["matches", search],
      queryFn: ({ pageParam = 0 }) =>
        MatchesService.readMatches({
          skip: pageParam as number,
          limit: 25,
          clubName: search || undefined,
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

  const allMatches = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? []
  }, [data])

  const totalMatches = data?.pages[0]?.count ?? 0

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
    const allVisibleIds = allMatches.map((m) => m.match_id)
    const allSelected =
      allVisibleIds.length > 0 &&
      allVisibleIds.every((id) => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])))
    }
  }

  const bulkDeleteMutation = useMutation({
    mutationFn: () => MatchesService.bulkDeleteMatches({ requestBody: selectedIds }),
    onSuccess: () => {
      showSuccessToast("Matches deleted successfully")
      setSelectedIds([])
    },
    onError: (err: any) => {
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] })
    },
  })

  const updateMatchMutation = useMutation({
    mutationFn: ({ id, raw_data }: { id: string, raw_data: any }) => 
        MatchesService.updateMatch({ matchId: id, requestBody: { raw_data } }),
    onSuccess: () => {
      showSuccessToast("Match updated successfully")
      setExpandedId(null)
    },
    onError: (err: any) => {
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] })
    },
  })

  const formatEST = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    })
  }

  const getMatchDisplay = (match: MatchPublic) => {
    const raw_data = match.raw_data as any
    const clubs = Object.values(raw_data?.clubs || {}) as any[]
    const club1 = clubs[0]
    const club2 = clubs[1]
    
    if (!club1 || !club2) return { club1: "N/A", club2: "N/A", score: "N/A" }
    
    return {
        club1: club1.details?.name || "Unknown",
        club2: club2.details?.name || "Unknown",
        score: `${club1.score} - ${club2.score}`
    }
  }

  const handleExpand = (match: MatchPublic) => {
    if (expandedId === match.match_id) {
        setExpandedId(null)
    } else {
        setExpandedId(match.match_id)
        setEditingData(JSON.stringify(match.raw_data, null, 2))
    }
  }

  const handleSaveRaw = (id: string) => {
    try {
        const parsed = JSON.parse(editingData)
        updateMatchMutation.mutate({ id, raw_data: parsed })
    } catch (e) {
        showErrorToast("Invalid JSON format")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button 
                variant="destructive" 
                onClick={() => bulkDeleteMutation.mutate()}
                disabled={bulkDeleteMutation.isPending}
            >
              <Trash className="mr-2 size-4" />
              Delete {selectedIds.length} selected
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by club name..."
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
            Error loading matches. Please try again or refresh the page.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3 flex items-center gap-4 bg-muted/50">
          <Checkbox
            checked={
              allMatches.length > 0 &&
              allMatches.every((m) => selectedIds.includes(m.match_id))
            }
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium">Select All</span>
        </div>

        <div className="divide-y">
          {allMatches.map((match: MatchPublic) => {
            const display = getMatchDisplay(match)
            const isExpanded = expandedId === match.match_id
            const raw_data = match.raw_data as any
            
            return (
              <div key={match.match_id} className="flex flex-col">
                <div
                  className="flex items-center gap-4 px-4 py-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleExpand(match)}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={selectedIds.includes(match.match_id)}
                        onCheckedChange={() => toggleSelect(match.match_id)}
                    />
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-mono">{match.match_id}</span>
                        <span className="text-sm font-medium">{formatEST(Number(raw_data?.timestamp || 0))}</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-center gap-4 font-semibold">
                        <span className="flex-1 text-right">{display.club1}</span>
                        <Badge variant="outline" className="px-3 py-1 text-lg font-bold">
                            {display.score}
                        </Badge>
                        <span className="flex-1 text-left">{display.club2}</span>
                    </div>
                    <div className="flex justify-end items-center gap-2">
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        <MatchActions match={match} />
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                    <div className="px-4 pb-4 flex flex-col gap-4 bg-muted/30">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raw Match Data (JSON)</label>
                            <textarea
                                className="w-full h-96 p-4 font-mono text-xs bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                value={editingData}
                                onChange={(e) => setEditingData(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setExpandedId(null)}>Cancel</Button>
                            <LoadingButton 
                                size="sm" 
                                onClick={() => handleSaveRaw(match.match_id)}
                                loading={updateMatchMutation.isPending}
                            >
                                Save Changes
                            </LoadingButton>
                        </div>
                    </div>
                )}
              </div>
            )
          })}

          {status === "pending" && (
            <div className="p-8 text-center text-muted-foreground">
              Loading matches...
            </div>
          )}

          {allMatches.length === 0 && status === "success" && (
            <div className="p-8 text-center text-muted-foreground">
              No matches found.
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
              ? "Scroll for more matches"
              : allMatches.length > 0
                ? `Total matches: ${totalMatches}`
                : null}
        </div>
      </div>
    </div>
  )
}

export default Matches
