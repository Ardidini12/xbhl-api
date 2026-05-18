import { useInfiniteQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Search, User } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { PlayersService } from "@/client"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const Players = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, error } =
    useInfiniteQuery({
      queryKey: ["players", search],
      queryFn: ({ pageParam = 0 }) =>
        PlayersService.readPlayers({
          skip: pageParam as number,
          limit: 20,
          search: search || undefined,
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

  const allPlayers = data?.pages.flatMap((page) => page.data) ?? []
  const totalCount = data?.pages[0]?.count ?? 0

  const handleNavigate = (eaId: string) => {
    navigate({
      to: "/admin/players/$eaId",
      params: { eaId },
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Players</h1>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search gamertag..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gamertag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status === "pending" ? (
              <TableRow>
                <TableCell className="text-center py-10 text-muted-foreground">
                  Loading players...
                </TableCell>
              </TableRow>
            ) : status === "error" ? (
              <TableRow>
                <TableCell className="text-center py-10 text-destructive">
                  Error: {(error as any)?.message || "Failed to load players"}
                </TableCell>
              </TableRow>
            ) : allPlayers.length > 0 ? (
              allPlayers.map((player) => (
                <TableRow
                  key={player.ea_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleNavigate(player.ea_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleNavigate(player.ea_id)
                    } else if (e.key === " ") {
                      e.preventDefault()
                      handleNavigate(player.ea_id)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <TableCell className="font-medium flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" />
                    {player.gamertag}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="text-center py-10 text-muted-foreground">
                  No players found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div
          ref={loadMoreRef}
          className="p-4 text-center text-sm text-muted-foreground"
        >
          {isFetchingNextPage
            ? "Loading more..."
            : hasNextPage
              ? "Scroll for more"
              : allPlayers.length > 0
                ? `Total players: ${totalCount}`
                : ""}
        </div>
      </div>
    </div>
  )
}

export default Players
