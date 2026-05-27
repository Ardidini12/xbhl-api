import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

interface SchedulerCountdownProps {
  nextRunAt: string | null | undefined
  isRunning: boolean | undefined
}

export const SchedulerCountdown = ({
  nextRunAt,
  isRunning = false,
}: SchedulerCountdownProps) => {
  const [timeLeft, setTimeLeft] = useState<string>("")

  useEffect(() => {
    if (isRunning) {
      setTimeLeft("Running...")
      return
    }

    if (!nextRunAt) {
      setTimeLeft("Stopped")
      return
    }

    const targetDate = new Date(nextRunAt).getTime()

    const updateTimer = () => {
      const now = Date.now()
      const distance = targetDate - now

      if (distance < 0) {
        setTimeLeft("Soon...")
        return
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [nextRunAt, isRunning])

  if (isRunning) {
    return (
      <div className="flex items-center gap-2 text-primary font-bold animate-pulse">
        <Loader2 className="size-4 animate-spin" />
        <span>Running...</span>
      </div>
    )
  }

  return (
    <div className="font-mono text-sm font-medium">
      {timeLeft !== "Stopped" && timeLeft !== "Soon..." && (
        <span className="text-xs text-muted-foreground mr-1">Next in:</span>
      )}
      <span className={timeLeft === "Stopped" ? "text-destructive" : ""}>
        {timeLeft}
      </span>
    </div>
  )
}
