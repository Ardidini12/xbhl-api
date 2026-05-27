import { useQuery } from "@tanstack/react-query"
import {
  type MatchPlayerStats,
  type PlayerDetailedStats,
  PlayersService,
} from "@/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface PlayerStatsTableProps {
  playerEaId?: string
  leagueId?: string
  seasonId?: string
  data?: PlayerDetailedStats | MatchPlayerStats
  isLoading?: boolean
  hideHeader?: boolean
}

export const CSV_COLUMNS = [
  { label: "PLAYER", key: "player_name" },
  { label: "TEAM", key: "team_name" },
  { label: "POSITION", key: "position" },
  { label: "RECORD", key: "record" },
  { label: "GAMES PLAYED", key: "games_played" },
  { label: "GOALS", key: "goals" },
  { label: "GOALS/GP", key: "goals_per_gp" },
  { label: "GAME WINNING GOALS", key: "game_winning_goals" },
  { label: "ASSISTS", key: "assists" },
  { label: "ASSISTS/GP", key: "assists_per_gp" },
  { label: "POINTS", key: "points" },
  { label: "POINTS/GP", key: "points_per_gp" },
  { label: "POSSESSION", key: "possession_min_per_gp" },
  { label: "+/-", key: "plus_minus" },
  { label: "SHOTS", key: "shots" },
  { label: "SHOT ATTEMPTS", key: "shot_attempts" },
  { label: "SCORING %", key: "scoring_pct" },
  { label: "MISSED SHOTS", key: "missed_shots" },
  { label: "SHOTS ON NET %", key: "shots_on_net_pct" },
  { label: "DEFLECTIONS", key: "deflections" },
  { label: "PASSES", key: "passes" },
  { label: "PASSES/GP", key: "passes_per_gp" },
  { label: "PASS ATTEMPTS", key: "pass_attempts" },
  { label: "PA/GP", key: "pa_per_gp" },
  { label: "PASSING %", key: "passing_pct" },
  { label: "SAUCER PASSES", key: "saucer_passes" },
  { label: "SP/GP", key: "sp_per_gp" },
  { label: "HITS", key: "hits" },
  { label: "HITS/GP", key: "hits_per_gp" },
  { label: "GIVEAWAYS", key: "giveaways" },
  { label: "GIVEAWAYS/GP", key: "giveaways_per_gp" },
  { label: "TAKEAWAYS", key: "takeaways" },
  { label: "TAKEAWAYS/GP", key: "takeaways_per_gp" },
  { label: "INTERCEPTIONS", key: "interceptions" },
  { label: "INTERCEPTIONS/GP", key: "interceptions_per_gp" },
  { label: "BLOCKED SHOTS", key: "blocked_shots" },
  { label: "BLOCKS/GP", key: "blocks_per_gp" },
  { label: "PENALTY MINUTES", key: "penalty_minutes" },
  { label: "PENALTIES DRAWN", key: "penalties_drawn" },
  { label: "PENALTY CLEARS", key: "penalty_clears" },
  { label: "FACEOFFS WON", key: "faceoffs_won" },
  { label: "FACEOFFS LOST", key: "faceoffs_lost" },
  { label: "FACEOFF WIN %", key: "faceoff_win_pct" },
]

const mapMatchStatsToDetailed = (
  stats: MatchPlayerStats,
): Partial<PlayerDetailedStats> => {
  return {
    player_name: "N/A",
    team_name: "N/A",
    position: stats.position,
    record: `${stats.win}-${stats.loss}-${stats.otl}`,
    games_played: 1,
    goals: stats.skgoals,
    goals_per_gp: stats.skgoals,
    game_winning_goals: stats.skgwg,
    assists: stats.skassists,
    assists_per_gp: stats.skassists,
    points: (stats.skgoals || 0) + (stats.skassists || 0),
    points_per_gp: (stats.skgoals || 0) + (stats.skassists || 0),
    possession_min_per_gp: stats.skpossession,
    plus_minus: stats.skplusmin,
    shots: stats.skshots,
    shot_attempts: stats.skshotattempts,
    scoring_pct: stats.skshotpct,
    missed_shots: (stats.skshotattempts || 0) - (stats.skshots || 0),
    shots_on_net_pct: stats.skshotonnetpct,
    deflections: stats.skdeflections,
    passes: stats.skpasses,
    passes_per_gp: stats.skpasses,
    pass_attempts: stats.skpassattempts,
    pa_per_gp: stats.skpassattempts,
    passing_pct: stats.skpasspct,
    saucer_passes: stats.sksaucerpasses,
    sp_per_gp: stats.sksaucerpasses,
    hits: stats.skhits,
    hits_per_gp: stats.skhits,
    giveaways: stats.skgiveaways,
    giveaways_per_gp: stats.skgiveaways,
    takeaways: stats.sktakeaways,
    takeaways_per_gp: stats.sktakeaways,
    interceptions: stats.skinterceptions,
    interceptions_per_gp: stats.skinterceptions,
    blocked_shots: stats.skbs,
    blocks_per_gp: stats.skbs,
    penalty_minutes: stats.skpim,
    penalties_drawn: stats.skpenaltiesdrawn,
    penalty_clears: stats.skpkclearzone,
    faceoffs_won: stats.skfow,
    faceoffs_lost: stats.skfol,
    faceoff_win_pct: stats.skfopct,
  }
}

export const PlayerStatsTable = ({
  playerEaId,
  leagueId,
  seasonId,
  data: providedData,
  isLoading: providedLoading,
  hideHeader = false,
}: PlayerStatsTableProps) => {
  const {
    data: fetchedData,
    isLoading: fetchLoading,
    error,
  } = useQuery({
    queryKey: ["player-detailed-stats", playerEaId, leagueId, seasonId],
    queryFn: () =>
      PlayersService.readPlayerDetailedStats({
        eaId: playerEaId!,
        leagueId,
        seasonId,
      }),
    enabled: !!playerEaId && !providedData,
  })

  const isLoading = providedLoading || fetchLoading
  const data = providedData || fetchedData

  if (isLoading) {
    return (
      <div className="p-4 text-center animate-pulse font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
        Loading Stats...
      </div>
    )
  }

  if (error || !data) {
    if (providedData) {
      // If data is provided manually, we use it even if query fails or wasn't run
    } else {
      return (
        <div className="p-4 text-center text-destructive font-bold uppercase tracking-widest text-[10px]">
          No Stats
        </div>
      )
    }
  }

  if (!data) return null

  // Determine if it's MatchPlayerStats or PlayerDetailedStats
  const isMatchStats = "match_id" in data
  const stats = isMatchStats
    ? mapMatchStatsToDetailed(data as MatchPlayerStats)
    : (data as PlayerDetailedStats)

  return (
    <div className="rounded-xl border-2 overflow-hidden bg-background shadow-sm">
      <div className="overflow-x-auto">
        <Table className="border-collapse">
          {!hideHeader && (
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-b-2">
                {CSV_COLUMNS.map((col) => (
                  <TableHead
                    key={col.key}
                    className="text-[9px] font-black uppercase tracking-tighter whitespace-nowrap px-3 h-10 border-r last:border-0 text-primary/80 text-center"
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
          )}
          <TableBody>
            <TableRow className="hover:bg-muted/20 border-0 h-11">
              {CSV_COLUMNS.map((col) => {
                const value = (stats as any)[col.key]
                const isNumeric = typeof value === "number"
                const displayValue = isNumeric
                  ? Number.isInteger(value)
                    ? value
                    : value.toFixed(2)
                  : value || "0"

                return (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "text-xs font-bold text-center border-r last:border-0 px-3 whitespace-nowrap",
                      col.key === "plus_minus" && value > 0
                        ? "text-green-600"
                        : "",
                      col.key === "plus_minus" && value < 0
                        ? "text-red-600"
                        : "",
                      col.key === "points" ? "text-primary font-black" : "",
                    )}
                  >
                    {displayValue}
                    {col.key.includes("pct") ||
                    col.key === "passing_pct" ||
                    col.key === "scoring_pct" ||
                    col.key === "faceoff_win_pct" ||
                    col.key === "shots_on_net_pct"
                      ? "%"
                      : ""}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default PlayerStatsTable
