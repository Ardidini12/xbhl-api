import { useInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import PendingUsers from "@/components/Pending/PendingUsers"
import { Input } from "@/components/ui/input"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/admin/")({
  component: Admin,
} as any)

const PAGE_SIZE = 100

function UsersTableContent() {
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState("")
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["users", search],
      queryFn: ({ pageParam = 0 }) =>
        UsersService.readUsers({
          skip: pageParam as number,
          limit: PAGE_SIZE,
          ...(search ? { q: search } : {}),
        }),
      getNextPageParam: (lastPage, allPages) => {
        const loaded = allPages.reduce((acc, p) => acc + p.data.length, 0)
        return loaded < lastPage.count ? loaded : undefined
      },
      initialPageParam: 0,
    })

  // Reset to first page when search changes
  const [, setReset] = useState(0)
  useEffect(() => {
    setReset((n) => n + 1)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const allUsers = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  )

  const tableData: UserTableData[] = allUsers.map((user: UserPublic) => ({
    ...user,
    isCurrentUser: currentUser?.id === user.id,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <DataTable columns={columns} data={tableData} />
      <div
        ref={loadMoreRef}
        className="p-4 text-center text-sm text-muted-foreground"
      >
        {isFetchingNextPage
          ? "Loading more..."
          : hasNextPage
            ? "Scroll for more"
            : allUsers.length > 0
              ? `Total users: ${data?.pages[0]?.count ?? 0}`
              : null}
      </div>
    </div>
  )
}

function UsersTable() {
  return (
    <Suspense fallback={<PendingUsers />}>
      <UsersTableContent />
    </Suspense>
  )
}

function Admin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <AddUser />
      </div>
      <UsersTable />
    </div>
  )
}
