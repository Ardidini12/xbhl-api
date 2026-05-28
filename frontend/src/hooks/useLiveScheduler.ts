import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import useCustomToast from "./useCustomToast"

export const useLiveScheduler = (schedulerId?: string) => {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    // Construct WebSocket URL based on current window location
    const protocol = window.location.protocol === "https:" ? "wss" : "ws"
    const host = window.location.host
    const token = localStorage.getItem("access_token")
    const wsUrl = `${protocol}://${host}/api/v1/schedulers/live${token ? `?token=${token}` : ""}`

    const connect = () => {
      if (!isMountedRef.current) return

      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onmessage = (event) => {
        try {
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
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e)
        }
      }

      socket.onclose = () => {
        if (isMountedRef.current) {
          // Simple reconnect logic
          reconnectTimerRef.current = setTimeout(connect, 3000)
        }
      }

      socket.onerror = (e) => {
        console.error("WebSocket error:", e)
      }
    }

    connect()

    return () => {
      isMountedRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (socketRef.current) {
        // Prevent onclose from scheduling a reconnect during cleanup
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.onmessage = null
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [schedulerId, queryClient, showErrorToast])
}
