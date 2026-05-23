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
  ChevronDown,
  ChevronRight,
  Edit,
  ExternalLink,
  MoreVertical,
  Search,
  Trash2,
  User,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  type LeagueStats,
  MatchesService,
  type MatchPublic,
  PlayersService,
  type SeasonStats,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import DeleteMatch from "./DeleteMatch"

const route = getRouteApi("/_layout/admin/players/$eaId")

const formatEST = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  })
}

interface ClubDetails {
  name: string
  [key: string]: unknown
}

interface ClubData {
  score: number
  details?: ClubDetails
  [key: string]: unknown
}

interface MatchRawData {
  clubs?: {
    [key: string]: ClubData
  }
  timestamp?: string | number
  [key: string]: unknown
}

const getMatchDisplay = (match: MatchPublic) => {
  const raw_data = match.raw_data as unknown as MatchRawData
  const clubs = Object.values(raw_data?.clubs || {})
  const club1 = clubs[0]
  const club2 = clubs[1]

  if (!club1 || !club2) return { club1: "N/A", club2: "N/A", score: "N/A" }

  return {
    club1: club1.details?.name || "Unknown",
    club2: club2.details?.name || "Unknown",
    score: `${club1.score} - ${club2.score}`,
  }
}

interface SeasonMatchesProps {
  playerEaId: string
  leagueId: string
  seasonId: string
  search: string
}

const SeasonMatches = ({
  playerEaId,
  leagueId,
  seasonId,
  search,
}: SeasonMatchesProps) => {
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(
    new Set(),
  )
  const [editingMatch, setEditingMatch] = useState<MatchPublic | null>(null)
  const [editingData, setEditingData] = useState<string>("")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadMoreRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["player-matches", playerEaId, leagueId, seasonId],
      queryFn: ({ pageParam = 0 }) =>
        MatchesService.readMatches({
          skip: pageParam as number,
          limit: 10,
          playerEaId: playerEaId,
          leagueId: leagueId,
          seasonId: seasonId,
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
    const matches = data?.pages.flatMap((page) => page.data) ?? []
    if (!search) return matches
    return matches.filter((m) => {
      const display = getMatchDisplay(m)
      const searchLower = search.toLowerCase()
      return (
        display.club1.toLowerCase().includes(searchLower) ||
        display.club2.toLowerCase().includes(searchLower) ||
        m.match_id.toLowerCase().includes(searchLower)
      )
    })
  }, [data, search])

  const totalMatchesCount = data?.pages[0]?.count ?? 0
  const loadedCount = useMemo(
    () => data?.pages.reduce((acc, p) => acc + (p.data?.length || 0), 0) || 0,
    [data],
  )

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
    setSelectedMatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedMatchIds.size === allMatches.length && allMatches.length > 0) {
      setSelectedMatchIds(new Set())
    } else {
      setSelectedMatchIds(new Set(allMatches.map((m) => m.match_id)))
    }
  }

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      MatchesService.bulkDeleteMatches({ requestBody: ids }),
    onSuccess: () => {
      showSuccessToast("Matches deleted successfully")
      setSelectedMatchIds(new Set())
    },
    onError: (err: any) => {
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["player-matches"] })
      queryClient.invalidateQueries({ queryKey: ["player-stats"] })
    },
  })

  const updateMatchMutation = useMutation({
    mutationFn: ({ id, raw_data }: { id: string; raw_data: any }) =>
      MatchesService.updateMatch({ matchId: id, requestBody: { raw_data } }),
    onSuccess: () => {
      showSuccessToast("Match updated successfully")
      setEditingMatch(null)
    },
    onError: (err: any) => {
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["player-matches"] })
    },
  })

  const handleEdit = (match: MatchPublic) => {
    setEditingMatch(match)
    setEditingData(JSON.stringify(match.raw_data, null, 2))
  }

  const handleSaveRaw = (id: string) => {
    try {
      const parsed = JSON.parse(editingData)
      updateMatchMutation.mutate({ id, raw_data: parsed })
    } catch (_e) {
      showErrorToast("Invalid JSON format")
    }
  }

  if (status === "pending")
    return (
      <div className="p-4 text-center text-sm text-muted-foreground font-medium">
        Loading matches...
      </div>
    )
  if (status === "error")
    return (
      <div className="p-4 text-center text-destructive text-sm font-bold">
        Error loading matches
      </div>
    )

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={
              allMatches.length > 0 &&
              selectedMatchIds.size === allMatches.length
            }
            onCheckedChange={toggleSelectAll}
            aria-label="Select all matches"
          />
          <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">
            Select All
          </span>
        </div>
        {selectedMatchIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="h-7 px-3 text-[10px] font-black uppercase tracking-widest"
            onClick={() =>
              bulkDeleteMutation.mutate(Array.from(selectedMatchIds))
            }
            disabled={bulkDeleteMutation.isPending}
          >
            <Trash2 className="mr-1.5 size-3" />
            Delete {selectedMatchIds.size}
          </Button>
        )}
      </div>

      <div className="flex flex-col divide-y bg-muted/20 rounded-xl border-2 overflow-hidden">
        {allMatches.map((match) => {
          const display = getMatchDisplay(match)
          const raw_data = match.raw_data as any
          const timestamp = Number(raw_data?.timestamp)
          return (
            <div
              key={match.match_id}
              className="p-3 flex items-center gap-4 hover:bg-muted/50 transition-all group"
            >
              <Checkbox
                checked={selectedMatchIds.has(match.match_id)}
                onCheckedChange={() => toggleSelect(match.match_id)}
                aria-label={`Select match ${match.match_id}`}
              />
              <div className="flex flex-col min-w-[140px]">
                <span className="text-[10px] text-muted-foreground font-mono truncate opacity-60">
                  {match.match_id}
                </span>
                <span className="text-xs font-bold tracking-tight">
                  {Number.isFinite(timestamp) && timestamp > 0
                    ? formatEST(timestamp)
                    : "N/A"}
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-tighter">
                <span className="flex-1 text-right truncate">
                  {display.club1}
                </span>
                <Badge
                  variant="outline"
                  className="px-2 py-0.5 text-[10px] font-black border-2 bg-background whitespace-nowrap"
                >
                  {display.score}
                </Badge>
                <span className="flex-1 text-left truncate">
                  {display.club2}
                </span>
              </div>
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full hover:bg-primary/10 hover:text-primary transition-all"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 font-bold">
                    <DropdownMenuItem
                      onClick={() =>
                        navigate({
                          to: "/admin/matches",
                          search: { clubName: display.club1 },
                        })
                      }
                    >
                      <ExternalLink className="mr-2 size-4" />
                      Enter
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEdit(match)}>
                      <Edit className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteId(match.match_id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
        {allMatches.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground font-bold italic opacity-60">
            No matches found.
          </div>
        )}
        <div
          ref={loadMoreRef}
          className="p-3 text-center text-[10px] text-muted-foreground font-black uppercase tracking-widest bg-muted/10 border-t-2"
        >
          {isFetchingNextPage ? (
            <span className="animate-pulse">Loading more matches...</span>
          ) : hasNextPage ? (
            "Scroll for more matches"
          ) : (
            `Total: ${loadedCount} / ${totalMatchesCount} matches`
          )}
        </div>
      </div>

      <DeleteMatch
        id={deleteId || ""}
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      />

      <Dialog
        open={!!editingMatch}
        onOpenChange={(open) => !open && setEditingMatch(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-2xl uppercase tracking-tighter">
              Edit Raw Data
            </DialogTitle>
            <DialogDescription className="font-bold">
              Update the JSON data for match {editingMatch?.match_id}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rawMatchData" className="text-xs font-black uppercase tracking-widest">
                Raw JSON <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rawMatchData"
                className="h-96 font-mono text-xs border-2 focus:ring-primary transition-all"
                value={editingData}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEditingData(e.target.value)
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditingMatch(null)}
              className="font-bold uppercase tracking-widest text-xs h-10 px-6 border-2"
            >
              Cancel
            </Button>
            <LoadingButton
              onClick={() =>
                editingMatch && handleSaveRaw(editingMatch.match_id)
              }
              loading={updateMatchMutation.isPending}
              className="font-black uppercase tracking-widest text-xs h-10 px-6"
            >
              Save Changes
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const PlayerDetail = () => {
  const { eaId } = route.useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [expandedLeagues, setExpandedLeagues] = useState<string[]>([])
  const [expandedSeasons, setExpandedSeasons] = useState<string[]>([])

  const { data: player, status: playerStatus } = useQuery({
    queryKey: ["player", eaId],
    queryFn: () => PlayersService.readPlayer({ eaId }),
  })

  const { data: stats, status: statsStatus } = useQuery({
    queryKey: ["player-stats", eaId],
    queryFn: () => PlayersService.readPlayerStats({ eaId }),
  })

  const toggleLeague = (id: string) => {
    setExpandedLeagues((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const toggleSeason = (id: string) => {
    setExpandedSeasons((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  if (playerStatus === "pending" || statsStatus === "pending") {
    return (
      <div className="p-12 text-center text-muted-foreground animate-pulse font-medium">
        Loading player details...
      </div>
    )
  }

  if (playerStatus === "error" || statsStatus === "error" || !player) {
    return (
      <div className="p-12 text-center">
        <AlertCircle className="mx-auto size-12 text-destructive mb-4" />
        <p className="text-lg font-semibold mb-4">
          Error loading player details. Player might not exist or data fetch failed.
        </p>
        <Button
          variant="default"
          onClick={() => navigate({ to: "/admin/players" })}
          className="font-black uppercase tracking-widest"
        >
          Back to Players
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/admin/players" })}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Player Profile
        </h1>
      </div>

      <Card className="overflow-hidden border-2 shadow-sm">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row gap-10 items-start md:items-center">
            <div className="w-40 h-40 md:w-56 md:h-50 flex items-center justify-center overflow-hidden rounded-2xl border-4 bg-muted/10 shadow-inner flex-shrink-0">
              <User className="size-24 text-muted-foreground opacity-20" />
            </div>
            <div className="flex-1 flex flex-col gap-6">
              <div>
                <h2 className="text-5xl font-black tracking-tighter mb-1">
                  {player.gamertag}
                </h2>
                <Badge
                  variant="outline"
                  className="bg-primary text-primary-foreground font-black border-none px-3 py-1"
                >
                  {player.most_frequent_position || "N/A"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-primary/10 rounded-xl p-4 border border-primary/20 shadow-sm transition-all hover:bg-primary/15">
                  <span className="text-[10px] text-muted-foreground block uppercase tracking-widest font-black mb-1">
                    Total Matches
                  </span>
                  <span className="text-3xl font-black">
                    {stats?.total_matches || 0}
                  </span>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 border shadow-sm transition-all hover:bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block uppercase tracking-widest font-black mb-1">
                    Leagues
                  </span>
                  <span className="text-3xl font-black">
                    {stats?.leagues.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6 mt-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-2xl font-black tracking-tight">
            Competition History
          </h3>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search opponent or ID..."
              className="pl-10 h-10 border-2 transition-all focus:ring-primary shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {!stats?.leagues || stats.leagues.length === 0 ? (
          <div className="p-20 text-center border-4 border-dashed rounded-3xl bg-muted/5 text-muted-foreground">
            <Search className="size-12 mx-auto mb-4 opacity-20" />
            <p className="text-xl font-bold opacity-60">
              No competition history found.
            </p>
            <p className="text-sm opacity-40 mt-1">
              This player hasn't played any tracked league matches yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {stats.leagues.map((league: LeagueStats) => (
              <div
                key={league.id}
                className="border-2 rounded-2xl bg-card overflow-hidden shadow-sm transition-all hover:border-muted-foreground/20"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-6 hover:bg-muted/30 transition-all text-left group"
                  onClick={() => toggleLeague(league.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={
                        expandedLeagues.includes(league.id)
                          ? "text-primary"
                          : "text-muted-foreground"
                      }
                    >
                      {expandedLeagues.includes(league.id) ? (
                        <ChevronDown className="size-6" />
                      ) : (
                        <ChevronRight className="size-6" />
                      )}
                    </div>
                    <div>
                      <span className="font-black text-xl tracking-tight uppercase">
                        {league.name}
                      </span>
                      <div className="text-xs text-muted-foreground font-bold tracking-widest mt-0.5 uppercase opacity-60">
                        {league.count} Games in total
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-8 px-4 font-black border-2"
                  >
                    {league.seasons.length} Seasons
                  </Badge>
                </button>

                {expandedLeagues.includes(league.id) && (
                  <div className="px-6 pb-6 flex flex-col gap-4">
                    <Separator className="opacity-50" />
                    <div className="grid grid-cols-1 gap-3">
                      {league.seasons.map((season: SeasonStats) => (
                        <div key={season.id} className="flex flex-col">
                          <button
                            type="button"
                            className="flex items-center justify-between p-4 bg-muted/10 hover:bg-muted/30 rounded-xl transition-all text-left group border border-transparent hover:border-muted-foreground/10"
                            onClick={() => toggleSeason(season.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={
                                  expandedSeasons.includes(season.id)
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                }
                              >
                                {expandedSeasons.includes(season.id) ? (
                                  <ChevronDown className="size-5" />
                                ) : (
                                  <ChevronRight className="size-5" />
                                )}
                              </div>
                              <span className="font-bold text-base tracking-tight transition-colors">
                                {season.name}
                              </span>
                            </div>
                            <Badge
                              variant="secondary"
                              className="px-3 py-1 font-bold"
                            >
                              {season.count} GAMES
                            </Badge>
                          </button>

                          {expandedSeasons.includes(season.id) && (
                            <div className="pl-8 mt-2 transition-all">
                              <SeasonMatches
                                playerEaId={player.ea_id}
                                leagueId={league.id}
                                seasonId={season.id}
                                search={search}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default PlayerDetail
