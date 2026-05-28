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
  Calendar,
  ChevronDown,
  Edit,
  ExternalLink,
  Gamepad2,
  History,
  MoreVertical,
  Search,
  Trash2,
  Trophy,
  User,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  type LeagueStats,
  MatchesService,
  type MatchPlayerStats,
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
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import DeleteMatch from "./DeleteMatch"
import { PlayerStatsTable } from "./PlayerStatsTable"

const route = getRouteApi("/_layout/admin/players/$eaId")

const formatEST = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  return `${date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  })} ET`
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
  const [expandedMatchStats, setExpandedMatchStats] = useState<Set<string>>(
    new Set(),
  )

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
          limit: 20,
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

  // Also fetch player match history to get specific player stats for each match
  const { data: matchHistory } = useQuery({
    queryKey: ["player-match-history", playerEaId, leagueId, seasonId],
    queryFn: () =>
      PlayersService.readPlayerMatchHistory({
        eaId: playerEaId,
        leagueId,
        seasonId,
        limit: 100, // Load more to cover common season lengths
      }),
  })

  const historyMap = useMemo(() => {
    const map = new Map<string, MatchPlayerStats>()
    matchHistory?.forEach((h) => map.set(h.match_id, h))
    return map
  }, [matchHistory])

  const allMatches = useMemo(() => {
    const matches = data?.pages.flatMap((page) => page.data) ?? []
    if (!search) return matches
    return matches.filter((m) => {
      const display = getMatchDisplay(m)
      const searchLower = search.toLowerCase()
      return (
        display.club1.toLowerCase().includes(searchLower) ||
        display.club2.toLowerCase().includes(searchLower) ||
        display.score.toLowerCase().includes(searchLower) ||
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

  const toggleMatchStats = (id: string) => {
    setExpandedMatchStats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
    <div className="flex flex-col gap-3 mt-4">
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

      <div className="flex flex-col gap-2">
        {allMatches.length > 0 && (
          <div className="px-4 py-2 grid grid-cols-12 gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 border-b-2 mb-1">
            <div className="col-span-1"></div> {/* For Checkbox */}
            <div className="col-span-3">Match ID / Date</div>
            <div className="col-span-7 text-center">Score / Clubs</div>
            <div className="col-span-1 text-right"></div> {/* For Actions */}
          </div>
        )}
        {allMatches.map((match) => {
          const display = getMatchDisplay(match)
          const raw_data = match.raw_data as any
          const timestamp = Number(raw_data?.timestamp)
          const stats = historyMap.get(match.match_id)
          const isExpanded = expandedMatchStats.has(match.match_id)

          return (
            <div key={match.match_id} className="flex flex-col">
              <div
                className={cn(
                  "p-3 flex items-center gap-4 bg-muted/20 hover:bg-muted/40 transition-all border-2 rounded-xl overflow-hidden",
                  isExpanded && "border-primary/30 bg-muted/40 rounded-b-none",
                )}
              >
                <Checkbox
                  checked={selectedMatchIds.has(match.match_id)}
                  onCheckedChange={() => toggleSelect(match.match_id)}
                  aria-label={`Select match ${match.match_id}`}
                />
                <button
                  onClick={() => toggleMatchStats(match.match_id)}
                  className="flex-1 flex items-center gap-4 text-left"
                >
                  <div className="flex flex-col min-w-[120px]">
                    <span className="text-[9px] text-muted-foreground font-mono truncate opacity-60">
                      {match.match_id}
                    </span>
                    <span className="text-[11px] font-bold tracking-tight">
                      {Number.isFinite(timestamp) && timestamp > 0
                        ? formatEST(timestamp)
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-tighter">
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
                  <div
                    className={cn(
                      "transition-transform duration-200",
                      isExpanded && "rotate-180",
                    )}
                  >
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </div>
                </button>
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
                        Enter Match
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(match)}>
                        <Edit className="mr-2 size-4" />
                        Edit Raw Data
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(match.match_id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete Match
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {isExpanded && (
                <div className="border-2 border-t-0 rounded-b-xl overflow-hidden animate-in slide-in-from-top-1 duration-200">
                  {stats ? (
                    <PlayerStatsTable data={stats} />
                  ) : (
                    <div className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">
                      No player statistics recorded for this match
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {allMatches.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground font-bold italic opacity-60 border-2 border-dashed rounded-xl">
            No matches found in this season.
          </div>
        )}
        <div
          ref={loadMoreRef}
          className="p-3 text-center text-[10px] text-muted-foreground font-black uppercase tracking-widest bg-muted/10 border-2 border-dashed rounded-xl mt-2"
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
              <Label
                htmlFor="rawMatchData"
                className="text-xs font-black uppercase tracking-widest"
              >
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
  const [careerExpanded, setCareerExpanded] = useState(true)

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
          Error loading player details.
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
    <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-24 px-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/admin/players" })}
          className="rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-3xl font-black tracking-tighter uppercase">
          Player Profile
        </h1>
      </div>

      {/* Hero Section */}
      <Card className="overflow-hidden border-2 shadow-sm bg-gradient-to-br from-background to-muted/20">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row gap-10 items-start md:items-center">
            <div className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center overflow-hidden rounded-3xl border-4 bg-background shadow-lg flex-shrink-0">
              <User className="size-20 text-muted-foreground opacity-20" />
            </div>
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-5xl font-black tracking-tighter mb-1 uppercase text-primary">
                    {player.gamertag}
                  </h2>
                  <div className="flex gap-2 items-center">
                    <Badge className="bg-primary text-primary-foreground font-black border-none px-3 py-1 uppercase">
                      {player.most_frequent_position || "N/A"}
                    </Badge>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      ID: {player.ea_id}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-background/80 backdrop-blur-sm rounded-2xl p-4 border-2 shadow-sm flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-xl">
                    <Gamepad2 className="size-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase tracking-widest font-black">
                      Total Matches
                    </span>
                    <span className="text-2xl font-black">
                      {stats?.total_matches || 0}
                    </span>
                  </div>
                </div>
                <div className="bg-background/80 backdrop-blur-sm rounded-2xl p-4 border-2 shadow-sm flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-xl">
                    <Trophy className="size-6 text-primary" />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase tracking-widest font-black">
                      Leagues Played
                    </span>
                    <span className="text-2xl font-black">
                      {stats?.leagues.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Career Stats Section */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setCareerExpanded(!careerExpanded)}
          className="flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-sm">
              <Trophy className="size-5" />
            </div>
            <h3 className="text-2xl font-black tracking-tighter uppercase">
              Career Statistics
            </h3>
          </div>
          <div
            className={cn(
              "transition-transform duration-200 text-muted-foreground",
              careerExpanded && "rotate-180",
            )}
          >
            <ChevronDown className="size-6" />
          </div>
        </button>
        {careerExpanded && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <PlayerStatsTable playerEaId={player.ea_id} />
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="font-black uppercase tracking-widest text-[10px] h-8 border-2"
                onClick={() => setCareerExpanded(false)}
              >
                Hide Career Stats
              </Button>
            </div>
          </div>
        )}
      </div>

      <Separator className="my-2" />

      {/* Competition History Section */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-sm">
              <History className="size-5" />
            </div>
            <h3 className="text-2xl font-black tracking-tighter uppercase">
              League History
            </h3>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search opponent, score or match ID..."
              className="pl-10 h-10 border-2 transition-all focus:ring-primary shadow-sm bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {!stats?.leagues || stats.leagues.length === 0 ? (
          <div className="p-20 text-center border-4 border-dashed rounded-3xl bg-muted/5 text-muted-foreground">
            <Search className="size-12 mx-auto mb-4 opacity-20" />
            <p className="text-xl font-bold opacity-60">
              No league participation found.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {stats.leagues.map((league: LeagueStats) => {
              const isExpanded = expandedLeagues.includes(league.id)
              return (
                <div
                  key={league.id}
                  className={cn(
                    "border-2 rounded-2xl bg-card overflow-hidden shadow-sm transition-all",
                    isExpanded && "border-primary/40 ring-4 ring-primary/5",
                  )}
                >
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center justify-between p-6 hover:bg-muted/30 transition-all text-left",
                      isExpanded && "bg-muted/20",
                    )}
                    onClick={() => toggleLeague(league.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "transition-transform duration-200",
                          isExpanded
                            ? "text-primary rotate-180"
                            : "text-muted-foreground",
                        )}
                      >
                        <ChevronDown className="size-6" />
                      </div>
                      <div>
                        <span className="font-black text-2xl tracking-tighter uppercase text-primary">
                          {league.name}
                        </span>
                        <div className="text-[10px] text-muted-foreground font-black tracking-widest mt-0.5 uppercase opacity-60 flex gap-4">
                          <span>{league.count} Games</span>
                          <span>{league.seasons.length} Seasons</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-8 flex flex-col gap-6 animate-in fade-in duration-300">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 px-1">
                          League Aggregate Stats
                        </span>
                        <PlayerStatsTable
                          playerEaId={player.ea_id}
                          leagueId={league.id}
                        />
                      </div>

                      <div className="flex flex-col gap-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 px-1">
                          Seasons
                        </span>
                        <div className="grid grid-cols-1 gap-4">
                          {league.seasons.map((season: SeasonStats) => {
                            const isSeasonExpanded = expandedSeasons.includes(
                              season.id,
                            )
                            return (
                              <div key={season.id} className="flex flex-col">
                                <button
                                  type="button"
                                  className={cn(
                                    "w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 rounded-xl transition-all text-left border-2",
                                    isSeasonExpanded &&
                                      "border-primary/30 bg-muted/40 rounded-b-none",
                                  )}
                                  onClick={() => toggleSeason(season.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    <Calendar
                                      className={cn(
                                        "size-5",
                                        isSeasonExpanded
                                          ? "text-primary"
                                          : "text-muted-foreground",
                                      )}
                                    />
                                    <span className="font-black text-lg tracking-tight uppercase transition-colors">
                                      {season.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Badge
                                      variant="secondary"
                                      className="px-3 py-1 font-black text-[10px] uppercase border"
                                    >
                                      {season.count} GAMES
                                    </Badge>
                                    <div
                                      className={cn(
                                        "transition-transform duration-200",
                                        isSeasonExpanded && "rotate-180",
                                      )}
                                    >
                                      <ChevronDown className="size-5 text-muted-foreground" />
                                    </div>
                                  </div>
                                </button>

                                {isSeasonExpanded && (
                                  <div className="p-4 border-2 border-t-0 rounded-b-xl bg-background/50 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex flex-col gap-4">
                                      <div className="flex flex-col gap-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-1">
                                          Season Aggregate Stats
                                        </span>
                                        <PlayerStatsTable
                                          playerEaId={player.ea_id}
                                          leagueId={league.id}
                                          seasonId={season.id}
                                        />
                                      </div>

                                      <div className="flex flex-col gap-2">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-1">
                                          Match Log
                                        </span>
                                        <SeasonMatches
                                          playerEaId={player.ea_id}
                                          leagueId={league.id}
                                          seasonId={season.id}
                                          search={search}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default PlayerDetail
