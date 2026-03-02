import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'

export async function TopBar() {
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, households(name)')
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single()

  const raw = profile?.households
  const householdName = (Array.isArray(raw) ? raw[0]?.name : (raw as { name: string } | null | undefined)?.name) ?? 'Home Base'

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
          <span className="text-sm text-zinc-500">{profile?.display_name}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
