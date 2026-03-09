import { currentUser } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'
import { createClient } from '@/lib/supabase/server'

export async function TopBar() {
  const clerkUser = await currentUser()
  const displayName = clerkUser?.fullName || clerkUser?.firstName || ''
  const householdId = clerkUser?.publicMetadata?.household_id as string | undefined

  let householdName = 'Home Base'
  if (householdId) {
    const supabase = await createClient()
    const { data: household } = await supabase
      .from('households')
      .select('name')
      .eq('id', householdId)
      .single()
    householdName = household?.name ?? 'Home Base'
  }

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-100">
      <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14 5V15H10V10H6V15H2V5L8 1Z" fill="white"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-900">{householdName}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{displayName}</span>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  )
}
