import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import useCustomToast from "./useCustomToast"

export const useLiveScheduler = (schedulerId?: string) => {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Construct WebSocket URL based on current window location
    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    const host = window.location.host
    const wsUrl = `${protocol}://${host}/api/v1/schedulers/live`

    const connect = () => {
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        // Only process if it's for our specific scheduler (if ID is provided)
        if (schedulerId && data.scheduler_id !== schedulerId) return

        switch (data.type) {
          case "status_update":
            // Instantly refresh the scheduler status and activities
            queryClient.invalidateQueries({ queryKey: ["schedulers"] })
            queryClient.invalidateQueries({ queryKey: ["scheduler-activities"] })
            if (data.status === "error") {
              showErrorToast(data.summary)
            }
            break
          
          case "match_saved":
            // Instantly refresh matches and status
            queryClient.invalidateQueries({ queryKey: ["matches"] })
            queryClient.invalidateQueries({ queryKey: ["schedulers"] })
            break

          case "match_unsaved":
            // Instantly refresh pending matches list
            queryClient.invalidateQueries({ queryKey: ["scheduler-unsaved"] })
            break
        }
      }

      socket.onclose = () => {
        // Simple reconnect logic
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [schedulerId, queryClient, showErrorToast])
}
