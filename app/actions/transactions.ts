'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createHash } from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { parseCSV } from '@/lib/csv-parsers'

export async function importTransactions(formData: FormData) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .single()

  if (!profile?.household_id) return { error: 'No household found' }

  const file = formData.get('file') as File | null
  const bank = formData.get('bank') as 'ANZ' | 'BNZ' | null

  if (!file || !bank) return { error: 'File and bank are required' }

  const content = await file.text()
  const fileHash = createHash('sha256').update(content).digest('hex')

  // Duplicate import check
  const { data: existing } = await supabase
    .from('import_batches')
    .select('id')
    .eq('household_id', profile.household_id)
    .eq('file_hash', fileHash)
    .maybeSingle()

  if (existing) return { error: 'This file has already been imported' }

  let parsed
  try {
    parsed = parseCSV(content, bank)
  } catch (e) {
    return { error: `Could not parse CSV: ${(e as Error).message}` }
  }

  if (parsed.length === 0) return { error: 'No transactions found in the file' }

  // Create import batch
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      household_id: profile.household_id,
      bank,
      file_name: file.name,
      file_hash: fileHash,
      row_count: parsed.length,
      status: 'pending',
    })
    .select()
    .single()

  if (batchError) return { error: batchError.message }

  const { error: txError } = await supabase
    .from('transactions')
    .insert(
      parsed.map(t => ({
        household_id: profile.household_id,
        import_batch_id: batch.id,
        date: t.date,
        amount: t.amount,
        description: t.description,
        payee: t.payee,
        memo: t.memo,
        bank,
        account: t.account,
        raw_data: t.raw_data,
      }))
    )

  if (txError) {
    await supabase.from('import_batches').update({ status: 'skipped' }).eq('id', batch.id)
    return { error: txError.message }
  }

  await supabase.from('import_batches').update({ status: 'complete' }).eq('id', batch.id)

  revalidatePath('/transactions')
  redirect('/transactions')
}

export async function updateTransactionCategory(id: string, categoryId: string | null) {
  const { userId } = await auth()
  if (!userId) return { error: 'Not authenticated' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('transactions')
    .update({ category_id: categoryId, categorised_by: 'user' })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/transactions')
  return { success: true }
}
