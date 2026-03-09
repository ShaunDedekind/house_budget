import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// For client components. Auth is handled server-side via Clerk JWT.
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
