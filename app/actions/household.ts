'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function createHousehold(formData: FormData) {
  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Household name is required' }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (householdError) return { error: householdError.message }

  // Seed default budget groups (50/30/20)
  const { error: groupError } = await supabase
    .from('budget_groups')
    .insert([
      { name: 'House Expenses', target_pct: 50, sort_order: 0, household_id: household.id },
      { name: 'Personal', target_pct: 30, sort_order: 1, household_id: household.id },
      { name: 'Savings', target_pct: 20, sort_order: 2, household_id: household.id },
    ])

  if (groupError) return { error: groupError.message }

  // Store household_id in a cookie
  const cookieStore = await cookies()
  cookieStore.set('household_id', household.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
