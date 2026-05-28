import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

export const ESTClock = () => {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    const update = () => {
      setTime(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()),
      )
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full text-xs font-mono font-medium text-primary border border-primary/20">
      <Clock className="size-3 animate-pulse" />
      <span>NY Time: {time || "--:--:--"} ET</span>
    </div>
  )
}
