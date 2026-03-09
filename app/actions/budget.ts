'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { computeMonthlyEquivalent } from '@/lib/utils'

async function getHouseholdId() {
  const cookieStore = await cookies()
  const householdId = cookieStore.get('household_id')?.value
  if (!householdId) {
    throw new Error('No household found')
  }
  return householdId
}

export async function createCategory(formData: FormData) {
  const householdId = await getHouseholdId()
  const name = (formData.get('name') as string | null)?.trim()
  const groupId = formData.get('group_id') as string | null
  const owner = formData.get('owner') as string | null
  const isSavings = formData.get('is_savings') === 'on'
  const isPersonal = formData.get('is_personal_allowance') === 'on'

  if (!name) {
    return { error: 'Category name is required' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('budget_categories').insert({
    household_id: householdId,
    name,
    group_id: groupId || null,
    owner,
    is_savings: isSavings,
    is_personal_allowance: isPersonal,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/budget')
  return { success: true }
}

export async function upsertBudgetItem(formData: FormData) {
  const householdId = await getHouseholdId()
  const categoryId = formData.get('category_id') as string | null
  const rawAmount = (formData.get('amount') as string | null) ?? ''
  const frequency = (formData.get('frequency') as string | null) ?? 'monthly'

  if (!categoryId) {
    return { error: 'Missing category' }
  }

  const amount = parseFloat(rawAmount.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter a positive amount' }
  }

  const monthlyEquivalent = computeMonthlyEquivalent(amount, frequency)

  const supabase = await createClient()

  // Find existing active budget item for this category
  const { data: existing } = await supabase
    .from('budget_items')
    .select('id')
    .eq('household_id', householdId)
    .eq('category_id', categoryId)
    .is('effective_to', null)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('budget_items')
      .update({
        amount,
        frequency,
        monthly_equivalent: monthlyEquivalent,
      })
      .eq('id', existing.id)

    if (error) {
      return { error: error.message }
    }
  } else {
    const { error } = await supabase
      .from('budget_items')
      .insert({
        household_id: householdId,
        category_id: categoryId,
        amount,
        frequency,
        monthly_equivalent: monthlyEquivalent,
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath('/budget')
  return { success: true }
}

