import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { TopBar } from '@/components/nav/top-bar'
import { BottomNav } from '@/components/nav/bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  const householdId = user?.publicMetadata?.household_id as string | undefined

  if (!householdId) {
    redirect('/setup')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
