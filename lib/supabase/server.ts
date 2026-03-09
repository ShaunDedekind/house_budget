import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Uses service role to bypass RLS during prototyping (no auth)
export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
