import { useInfiniteQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { AlertCircle, Plus, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { type SchedulerPublic, SchedulersService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLiveScheduler } from "@/hooks/useLiveScheduler"
import CreateScheduler from "./CreateScheduler"
import { ESTClock } from "./ESTClock"
import SchedulerActions from "./SchedulerActions"
import { SchedulerCountdown } from "./SchedulerCountdown"

const Schedulers = () => {
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState("")
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Listen for real-time WebSocket updates
  useLiveScheduler()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["schedulers", search],
      queryFn: ({ pageParam = 0 }) =>
        SchedulersService.readSchedulers({
          skip: pageParam as number,
          limit: 25,
        }),
      getNextPageParam: (lastPage, allPages) => {
        const currentCount = allPages.reduce(
          (acc, page) => acc + page.data.length,
          0,
        )
        return currentCount < lastPage.count ? currentCount : undefined
      },
      initialPageParam: 0,
      refetchInterval: (query) => {
        const anyRunning = (query.state.data as any)?.pages?.some((p: any) =>
          p.data.some((s: any) => s.is_running),
        )
        return anyRunning ? 2000 : 10000
      },
    })

  const allSchedulers = useMemo(() => {
    const schedulers = data?.pages.flatMap((page) => page.data) ?? []
    if (!search) return schedulers

    const searchLower = search.toLowerCase()
    return schedulers.filter((scheduler) => {
      const daysStr = ((scheduler.days as string[]) || [])
        .join(" ")
        .toLowerCase()
      return (
        (scheduler.league_name?.toLowerCase() || "").includes(searchLower) ||
        (scheduler.season_name?.toLowerCase() || "").includes(searchLower) ||
        daysStr.includes(searchLower)
      )
    })
  }, [data, search])

  const totalSchedulers = data?.pages[0]?.count ?? 0

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0 },
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const getStatus = (scheduler: SchedulerPublic) => {
    if (scheduler.is_running)
      return { label: "Processing...", variant: "secondary" as const }
    if (!scheduler.is_enabled)
      return { label: "Stopped", variant: "destructive" as const }

    // Get current date/time in America/New_York
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })

    const parts = formatter.formatToParts(now)
    const currentDay = parts.find((p) => p.type === "weekday")?.value || ""
    const currentHour = parts.find((p) => p.type === "hour")?.value || ""
    const currentMinute = parts.find((p) => p.type === "minute")?.value || ""
    const currentTimeStr = `${currentHour}:${currentMinute}`

    // Check day
    const schedulerDays = (scheduler.days as string[]) || []
    if (!schedulerDays.includes(currentDay))
      return { label: "Active - Idle", variant: "secondary" as const }

    // Check time
    if (
      currentTimeStr >= scheduler.start_time.slice(0, 5) &&
      currentTimeStr <= scheduler.end_time.slice(0, 5)
    ) {
      return { label: "Active - Running", variant: "default" as const }
    }

    return { label: "Active - Idle", variant: "secondary" as const }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Schedulers</h1>
          <ESTClock />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Create Scheduler
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search schedulers..."
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
            Error loading schedulers. Please try again or refresh the page.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <div className="divide-y">
          <div className="grid grid-cols-8 gap-4 px-4 py-3 bg-muted/50 text-sm font-medium">
            <div className="col-span-1">League/Season</div>
            <div className="col-span-1">Days</div>
            <div className="col-span-1">Timeframe (ET)</div>
            <div className="col-span-1 text-center">Interval</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1">Next Run</div>
            <div className="col-span-1">Last Run Result</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          {allSchedulers.map((scheduler: SchedulerPublic) => {
            const statusInfo = getStatus(scheduler)
            const schedulerDays = (scheduler.days as string[]) || []
            return (
              <div
                key={scheduler.id}
                className="grid grid-cols-8 gap-4 items-center px-4 py-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() =>
                  navigate({
                    to: "/admin/schedulers/$schedulerId",
                    params: { schedulerId: scheduler.id },
                  })
                }
              >
                <div className="col-span-1 truncate font-medium">
                  {scheduler.league_name} / {scheduler.season_name}
                </div>
                <div className="col-span-1 text-xs text-muted-foreground">
                  {schedulerDays.join(", ")}
                </div>
                <div className="col-span-1 text-sm text-muted-foreground">
                  {scheduler.start_time.slice(0, 5)} -{" "}
                  {scheduler.end_time.slice(0, 5)}
                </div>
                <div className="col-span-1 text-sm text-muted-foreground text-center">
                  {scheduler.interval_minutes} min
                </div>
                <div className="col-span-1 text-center">
                  <Badge
                    variant={statusInfo.variant}
                    className={scheduler.is_running ? "animate-pulse" : ""}
                  >
                    {statusInfo.label}
                  </Badge>
                </div>
                <div className="col-span-1">
                  <SchedulerCountdown
                    nextRunAt={scheduler.next_run_at}
                    isRunning={scheduler.is_running}
                  />
                </div>
                <div className="col-span-1 text-xs text-muted-foreground break-words italic">
                  {scheduler.last_run_status || "Never run"}
                </div>
                <div
                  className="col-span-1 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SchedulerActions scheduler={scheduler} />
                </div>
              </div>
            )
          })}

          {status === "pending" && (
            <div className="p-8 text-center text-muted-foreground">
              Loading schedulers...
            </div>
          )}

          {allSchedulers.length === 0 && status === "success" && (
            <div className="p-8 text-center text-muted-foreground">
              No schedulers found.
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
              ? "Scroll for more schedulers"
              : allSchedulers.length > 0
                ? `Total schedulers: ${totalSchedulers}`
                : null}
        </div>
      </div>

      <CreateScheduler open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

export default Schedulers
