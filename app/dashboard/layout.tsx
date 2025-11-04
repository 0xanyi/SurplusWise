import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import DashboardNav from "@/components/dashboard/dashboard-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav user={user} />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </main>
    </div>
  )
}
