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
  Check,
  Clock,
  Info,
  Play,
  Trash,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  type SchedulerActivityPublic,
  SchedulersService,
  type UnsavedMatchPublic,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const route = getRouteApi("/_layout/admin/schedulers/$schedulerId")

const SchedulerDetail = () => {
  const { schedulerId } = route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [selectedActivity, setSelectedActivity] =
    useState<SchedulerActivityPublic | null>(null)
  const [editingUnsavedMatch, setEditingUnsavedMatch] =
    useState<UnsavedMatchPublic | null>(null)
  const [editingData, setEditingData] = useState<string>("")
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([])

  const activitiesLoadMoreRef = useRef<HTMLDivElement>(null)
  const unsavedLoadMoreRef = useRef<HTMLDivElement>(null)

  const { data: scheduler, isLoading: isLoadingScheduler } = useQuery({
    queryKey: ["schedulers", schedulerId],
    queryFn: () => SchedulersService.readScheduler({ id: schedulerId }),
    enabled: !!schedulerId,
  })

  const {
    data: activitiesData,
    fetchNextPage: fetchNextActivities,
    hasNextPage: hasMoreActivities,
    isFetchingNextPage: isFetchingMoreActivities,
  } = useInfiniteQuery({
    queryKey: ["scheduler-activities", schedulerId],
    queryFn: ({ pageParam = 0 }) =>
      SchedulersService.readSchedulerActivities({
        id: schedulerId,
        skip: pageParam as number,
        limit: 20,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce(
        (acc, page) => acc + page.data.length,
        0,
      )
      return currentCount < lastPage.count ? currentCount : undefined
    },
    initialPageParam: 0,
    enabled: !!schedulerId,
  })

  const {
    data: unsavedData,
    fetchNextPage: fetchNextUnsaved,
    hasNextPage: hasMoreUnsaved,
    isFetchingNextPage: isFetchingMoreUnsaved,
  } = useInfiniteQuery({
    queryKey: ["scheduler-unsaved", schedulerId],
    queryFn: ({ pageParam = 0 }) =>
      SchedulersService.readUnsavedMatches({
        id: schedulerId,
        skip: pageParam as number,
        limit: 20,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce(
        (acc, page) => acc + page.data.length,
        0,
      )
      return currentCount < lastPage.count ? currentCount : undefined
    },
    initialPageParam: 0,
    enabled: !!schedulerId,
  })

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreActivities &&
          !isFetchingMoreActivities
        ) {
          fetchNextActivities()
        }
      },
      { threshold: 0.1 },
    )
    if (activitiesLoadMoreRef.current)
      observer.observe(activitiesLoadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMoreActivities, isFetchingMoreActivities, fetchNextActivities])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreUnsaved &&
          !isFetchingMoreUnsaved
        ) {
          fetchNextUnsaved()
        }
      },
      { threshold: 0.1 },
    )
    if (unsavedLoadMoreRef.current) observer.observe(unsavedLoadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMoreUnsaved, isFetchingMoreUnsaved, fetchNextUnsaved])

  const promoteMutation = useMutation({
    mutationFn: (matchId: string) =>
      SchedulersService.promoteUnsavedMatch({ matchId }),
    onSuccess: () => {
      showSuccessToast("Match promoted successfully")
      queryClient.invalidateQueries({
        queryKey: ["scheduler-unsaved", schedulerId],
      })
      queryClient.invalidateQueries({ queryKey: ["matches"] })
    },
    onError: (err: any) => showErrorToast("Error promoting match", err),
  })

  const deleteUnsavedMutation = useMutation({
    mutationFn: (matchId: string) =>
      SchedulersService.deleteUnsavedMatch({ matchId }),
    onSuccess: () => {
      showSuccessToast("Unsaved match deleted")
      queryClient.invalidateQueries({
        queryKey: ["scheduler-unsaved", schedulerId],
      })
    },
    onError: (err: any) => showErrorToast("Error deleting match", err),
  })

  const bulkDeleteUnsavedMutation = useMutation({
    mutationFn: () =>
      SchedulersService.bulkDeleteUnsavedMatches({
        requestBody: selectedMatchIds,
      }),
    onSuccess: () => {
      showSuccessToast("Pending matches deleted successfully")
      setSelectedMatchIds([])
      queryClient.invalidateQueries({
        queryKey: ["scheduler-unsaved", schedulerId],
      })
    },
    onError: (err: any) => handleError.call(showErrorToast, err),
  })

  const clearActivitiesMutation = useMutation({
    mutationFn: () =>
      SchedulersService.deleteSchedulerActivities({ id: schedulerId }),
    onSuccess: () => {
      showSuccessToast("Activity logs cleared")
      queryClient.invalidateQueries({
        queryKey: ["scheduler-activities", schedulerId],
      })
    },
    onError: (err: any) => handleError.call(showErrorToast, err),
  })

  const updateUnsavedMutation = useMutation({
    mutationFn: ({ matchId, rawData }: { matchId: string; rawData: any }) =>
      SchedulersService.updateUnsavedMatch({
        matchId,
        requestBody: { raw_data: rawData },
      }),
    onSuccess: () => {
      showSuccessToast("Unsaved match updated successfully")
      setEditingUnsavedMatch(null)
      queryClient.invalidateQueries({
        queryKey: ["scheduler-unsaved", schedulerId],
      })
    },
    onError: (err: any) => showErrorToast("Error updating match", err),
  })

  const runNowMutation = useMutation({
    mutationFn: () => SchedulersService.runSchedulerNow({ id: schedulerId }),
    onSuccess: () => {
      showSuccessToast("Scheduler triggered manually")
      queryClient.invalidateQueries({ queryKey: ["schedulers", schedulerId] })
      queryClient.invalidateQueries({
        queryKey: ["scheduler-activities", schedulerId],
      })
    },
    onError: (err: any) => showErrorToast("Error triggering scheduler", err),
  })

  const allActivities = useMemo(
    () => activitiesData?.pages.flatMap((p) => p.data) ?? [],
    [activitiesData],
  )
  const allUnsaved = useMemo(
    () => unsavedData?.pages.flatMap((p) => p.data) ?? [],
    [unsavedData],
  )

  const totalUnsaved = unsavedData?.pages[0]?.count ?? 0

  const toggleSelectMatch = (id: string) => {
    setSelectedMatchIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const toggleSelectAllMatches = async () => {
    const allVisibleIds = allUnsaved.map((m) => m.match_id)
    const allSelected =
      allVisibleIds.length > 0 &&
      allVisibleIds.every((id) => selectedMatchIds.includes(id))

    if (allSelected) {
      setSelectedMatchIds([])
    } else {
      try {
        const allIds = await SchedulersService.readUnsavedMatchIds({
          id: schedulerId,
        })
        setSelectedMatchIds(allIds)
      } catch (err: any) {
        handleError.call(showErrorToast, err)
      }
    }
  }

  if (isLoadingScheduler)
    return <div className="p-8 text-center">Loading scheduler details...</div>
  if (!scheduler)
    return (
      <div className="p-8 text-center text-destructive">
        Scheduler not found.
      </div>
    )

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      if (Number.isNaN(date.getTime())) return "Invalid Date"
      return `${new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date)} ET`
    } catch {
      return "Invalid Date"
    }
  }

  const handleEditUnsaved = (match: UnsavedMatchPublic) => {
    setEditingUnsavedMatch(match)
    setEditingData(JSON.stringify(match.raw_data, null, 2))
  }

  const handleSaveUnsavedRaw = (id: string) => {
    try {
      const parsed = JSON.parse(editingData)
      updateUnsavedMutation.mutate({ matchId: id, rawData: parsed })
    } catch (_e) {
      showErrorToast("Invalid JSON format")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/admin/schedulers" })}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {scheduler.league_name} / {scheduler.season_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Detailed activity and pending matches for this scheduler.
          </p>
        </div>
        <div className="flex gap-2">
          {selectedMatchIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => bulkDeleteUnsavedMutation.mutate()}
              disabled={bulkDeleteUnsavedMutation.isPending}
            >
              <Trash className="mr-2 size-4" />
              Delete {selectedMatchIds.length} selected
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending}
          >
            <Play className="mr-2 size-4" />
            Run Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scheduler.start_time.slice(0, 5)} -{" "}
              {scheduler.end_time.slice(0, 5)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Array.isArray(scheduler.days)
                ? (scheduler.days as string[]).join(", ")
                : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Interval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scheduler.interval_minutes} min
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Next run based on frequency
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={scheduler.is_enabled ? "default" : "destructive"}>
              {scheduler.is_enabled ? "Enabled" : "Disabled"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1 truncate italic">
              {scheduler.last_run_status || "Never run"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="activities" className="w-full">
        <TabsList>
          <TabsTrigger value="activities">Activity Logs</TabsTrigger>
          <TabsTrigger value="unsaved">
            Pending Matches ({totalUnsaved})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Runs</CardTitle>
                <CardDescription>
                  History of scheduler executions and their outcomes.
                </CardDescription>
              </div>
              {allActivities.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => clearActivitiesMutation.mutate()}
                  disabled={clearActivitiesMutation.isPending}
                >
                  <Trash className="mr-2 size-4" />
                  Clear Logs
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="divide-y border rounded-md">
                {allActivities.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No activities recorded yet.
                  </div>
                ) : (
                  <>
                    {allActivities.map((act: SchedulerActivityPublic) => (
                      <div
                        key={act.id}
                        className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedActivity(act)}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                act.status === "success"
                                  ? "default"
                                  : act.status === "running"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {act.status}
                            </Badge>
                            <span className="text-sm font-medium">
                              {formatDateTime(act.started_at)}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {act.summary || "Processing..."}
                          </span>
                        </div>
                        <Info className="size-4 text-muted-foreground" />
                      </div>
                    ))}
                    <div
                      ref={activitiesLoadMoreRef}
                      className="p-4 text-center text-sm text-muted-foreground border-t"
                    >
                      {isFetchingMoreActivities
                        ? "Loading more activities..."
                        : hasMoreActivities
                          ? "Scroll for more"
                          : `Total runs: ${allActivities.length}`}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unsaved" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Unsaved Matches</CardTitle>
              <CardDescription>
                Matches that were fetched but didn't meet strict validation
                (e.g. only one club in season). Click to view details or edit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <div className="border-b px-4 py-3 flex items-center gap-4 bg-muted/50">
                  <Checkbox
                    checked={
                      allUnsaved.length > 0 &&
                      allUnsaved.every((m) =>
                        selectedMatchIds.includes(m.match_id),
                      )
                    }
                    onCheckedChange={toggleSelectAllMatches}
                  />
                  <span className="text-sm font-medium">Select All</span>
                </div>
                <div className="divide-y">
                  {allUnsaved.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No pending matches.
                    </div>
                  ) : (
                    <>
                      {allUnsaved.map((match: UnsavedMatchPublic) => {
                        const raw = (match.raw_data || {}) as any
                        const clubs = Object.values(raw.clubs || {}) as any[]
                        const timestamp = Number(raw.timestamp)
                        const isValidTimestamp =
                          !Number.isNaN(timestamp) && timestamp > 0

                        return (
                          <div
                            key={match.match_id}
                            className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => handleEditUnsaved(match)}
                          >
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedMatchIds.includes(
                                  match.match_id,
                                )}
                                onCheckedChange={() =>
                                  toggleSelectMatch(match.match_id)
                                }
                              />
                            </div>
                            <div className="flex-1 flex flex-col gap-1">
                              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                                <Clock className="size-3" />
                                {isValidTimestamp
                                  ? `${new Intl.DateTimeFormat("en-US", {
                                      timeZone: "America/New_York",
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    }).format(new Date(timestamp * 1000))} ET`
                                  : "Unknown Date"}
                                <span className="ml-2 px-1 bg-muted rounded">
                                  ID: {match.match_id}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 font-semibold mt-1">
                                <span>
                                  {clubs[0]?.details?.name || "Unknown Club"}
                                </span>
                                <Badge variant="outline">
                                  {clubs.length >= 2
                                    ? `${clubs[0]?.score ?? "-"} - ${clubs[1]?.score ?? "-"}`
                                    : "N/A"}
                                </Badge>
                                <span>
                                  {clubs[1]?.details?.name ||
                                    (clubs.length >= 2 ? "Unknown Club" : "-")}
                                </span>
                              </div>
                              <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="size-3" />
                                Reason: {match.reason || "Unknown"}
                              </div>
                            </div>
                            <div
                              className="flex gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  match.match_id &&
                                  promoteMutation.mutate(match.match_id)
                                }
                                disabled={
                                  promoteMutation.isPending || !match.match_id
                                }
                              >
                                <Check className="mr-1 size-3" /> Promote
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  match.match_id &&
                                  deleteUnsavedMutation.mutate(match.match_id)
                                }
                                disabled={
                                  deleteUnsavedMutation.isPending ||
                                  !match.match_id
                                }
                              >
                                <Trash className="size-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                      <div
                        ref={unsavedLoadMoreRef}
                        className="p-4 text-center text-sm text-muted-foreground border-t"
                      >
                        {isFetchingMoreUnsaved
                          ? "Loading more matches..."
                          : hasMoreUnsaved
                            ? "Scroll for more"
                            : `Total pending: ${totalUnsaved}`}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Activity Details Modal */}
      {selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelectedActivity(null)}
        >
          <Card
            className="max-w-2xl w-full max-h-[80vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Run Details</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedActivity(null)}
                >
                  &times;
                </Button>
              </div>
              <CardDescription>
                Started: {formatDateTime(selectedActivity.started_at)}
                {selectedActivity.finished_at &&
                  ` | Finished: ${formatDateTime(selectedActivity.finished_at)}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-md font-mono text-[10px] whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(selectedActivity.details, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unsaved Match Edit Modal */}
      <Dialog
        open={!!editingUnsavedMatch}
        onOpenChange={(open) => !open && setEditingUnsavedMatch(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Unsaved Match Raw Data</DialogTitle>
            <DialogDescription>
              Update the JSON data for unsaved match{" "}
              {editingUnsavedMatch?.match_id}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label
                htmlFor="rawUnsavedMatchData"
                className="text-sm font-medium"
              >
                Raw Match Data (JSON){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rawUnsavedMatchData"
                className="h-96 font-mono text-xs"
                value={editingData}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEditingData(e.target.value)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingUnsavedMatch(null)}
            >
              Cancel
            </Button>
            <LoadingButton
              onClick={() =>
                editingUnsavedMatch &&
                handleSaveUnsavedRaw(editingUnsavedMatch.match_id)
              }
              loading={updateUnsavedMutation.isPending}
            >
              Save Changes
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SchedulerDetail
