import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Search,
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
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

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
  const loadMoreRef = useRef<HTMLDivElement>(null)

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

  if (status === "pending")
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Loading matches...
      </div>
    )
  if (status === "error")
    return (
      <div className="p-4 text-center text-destructive text-sm font-medium">
        Error loading matches
      </div>
    )

  return (
    <div className="flex flex-col divide-y bg-muted/20 rounded-md border mt-2">
      {allMatches.map((match) => {
        const display = getMatchDisplay(match)
        const raw_data = match.raw_data as any
        const timestamp = Number(raw_data?.timestamp)
        return (
          <div
            key={match.match_id}
            className="p-3 flex items-center gap-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex flex-col min-w-[140px]">
              <span className="text-[10px] text-muted-foreground font-mono truncate">
                {match.match_id}
              </span>
              <span className="text-xs font-medium">
                {Number.isFinite(timestamp) && timestamp > 0
                  ? formatEST(timestamp)
                  : "N/A"}
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 font-semibold text-sm">
              <span className="flex-1 text-right truncate">
                {display.club1}
              </span>
              <Badge
                variant="outline"
                className="px-2 py-0.5 text-xs font-bold whitespace-nowrap"
              >
                {display.score}
              </Badge>
              <span className="flex-1 text-left truncate">{display.club2}</span>
            </div>
          </div>
        )
      })}
      {allMatches.length === 0 && (
        <div className="p-4 text-center text-sm text-muted-foreground font-medium">
          No matches found matching your search.
        </div>
      )}
      <div
        ref={loadMoreRef}
        className="p-2 text-center text-[10px] text-muted-foreground italic"
      >
        {isFetchingNextPage
          ? "Loading more..."
          : hasNextPage
            ? "Scroll for more"
            : ""}
      </div>
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

  if (playerStatus === "error" || !player) {
    return (
      <div className="p-12 text-center">
        <AlertCircle className="mx-auto size-12 text-destructive mb-4" />
        <p className="text-lg font-semibold mb-4">
          Error loading player details. Player might not exist.
        </p>
        <Button
          variant="default"
          onClick={() => navigate({ to: "/admin/players" })}
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
