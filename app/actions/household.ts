'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createHousehold(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const name = formData.get('name') as string
  if (!name?.trim()) return { error: 'Household name is required' }

  // Create household
  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (householdError) return { error: householdError.message }

  // Link profile to household
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ household_id: household.id })
    .eq('id', user.id)

  if (profileError) return { error: profileError.message }

  // Seed default budget groups (50/30/20)
  const groups = [
    { name: 'House Expenses', target_pct: 50, sort_order: 0 },
    { name: 'Personal', target_pct: 30, sort_order: 1 },
    { name: 'Savings', target_pct: 20, sort_order: 2 },
  ]

  const { error: groupError } = await supabase
    .from('budget_groups')
    .insert(groups.map(g => ({ ...g, household_id: household.id })))

  if (groupError) return { error: groupError.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
