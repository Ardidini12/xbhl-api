import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import {
  LeaguesService,
  type SchedulerCreate,
  SchedulersService,
  SeasonsService,
} from "@/client"
import { Button } from "@/components/ui/button"
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

const formSchema = z.object({
  league_id: z.string().uuid("Invalid league ID"),
  season_id: z.string().uuid("Invalid season ID"),
  days: z.array(z.string()).min(1, "Select at least one day"),
  start_time: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  end_time: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  interval_minutes: z.number().min(1, "Minimum 1 minute"),
})

type FormValues = z.infer<typeof formSchema>

interface CreateSchedulerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CreateScheduler = ({ open, onOpenChange }: CreateSchedulerProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      league_id: "",
      season_id: "",
      days: [],
      start_time: "21:00",
      end_time: "23:30",
      interval_minutes: 15,
    },
  })

  const { data: leagues } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => LeaguesService.readLeagues({ limit: 100 }),
  })

  const leagueId = form.watch("league_id")

  const { data: seasons } = useQuery({
    queryKey: ["seasons", leagueId],
    queryFn: () =>
      SeasonsService.readSeasons({ leagueId: leagueId, limit: 100 }),
    enabled: !!leagueId,
  })

  // Clear season_id when league_id changes
  useEffect(() => {
    form.setValue("season_id", "")
  }, [form.setValue])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      return SchedulersService.createScheduler({
        requestBody: data as SchedulerCreate,
      })
    },
    onSuccess: () => {
      showSuccessToast("Scheduler created successfully")
      onOpenChange(false)
      form.reset()
    },
    onError: (err: any) => {
      handleError.call(showErrorToast, err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["schedulers"] })
    },
  })

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Scheduler</DialogTitle>
          <DialogDescription>
            Configure a new background puller for league data.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="league_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>League</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a league" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leagues?.data.map((league) => (
                        <SelectItem key={league.id} value={league.id}>
                          {league.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="season_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!leagueId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a season" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {seasons?.data.map((season) => (
                        <SelectItem key={season.id} value={season.id}>
                          {season.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="days"
              render={() => (
                <FormItem>
                  <FormLabel>Days</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {daysOfWeek.map((day) => (
                      <FormField
                        key={day}
                        control={form.control}
                        name="days"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={day}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(day)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, day])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== day,
                                          ),
                                        )
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {day}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="interval_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interval (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Create
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateScheduler
