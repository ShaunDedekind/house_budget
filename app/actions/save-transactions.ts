'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import type { UnifiedTransaction } from '@/lib/types'

export async function saveTransactions(params: {
  transactions: UnifiedTransaction[]
  bank: string
  rawText: string
  sourceName: string
}): Promise<{ success?: boolean; count?: number; error?: string; skipped?: boolean }> {
  const cookieStore = await cookies()
  const householdId = cookieStore.get('household_id')?.value
  if (!householdId) return { error: 'No household found' }

  const { transactions, bank, rawText, sourceName } = params
  const fileHash = createHash('sha256').update(rawText).digest('hex')
  const supabase = await createClient()

  // Soft-skip duplicates
  const { data: existing } = await supabase
    .from('import_batches')
    .select('id')
    .eq('household_id', householdId)
    .eq('file_hash', fileHash)
    .maybeSingle()

  if (existing) return { skipped: true, count: 0 }

  const validTransactions = transactions.filter(t => t.date !== null)

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      household_id: householdId,
      bank,
      file_name: sourceName,
      file_hash: fileHash,
      row_count: validTransactions.length,
      status: 'pending',
    })
    .select()
    .single()

  if (batchError) return { error: batchError.message }

  const { error: txError } = await supabase.from('transactions').insert(
    validTransactions.map(t => ({
      household_id: householdId,
      import_batch_id: batch.id,
      date: t.date!,
      amount: t.amount,
      description: t.description,
      payee: t.payee ?? t.description,
      memo: t.memo ?? null,
      bank,
      account: t.account ?? null,
      raw_data: t.raw_data ?? {},
    }))
  )

  if (txError) {
    await supabase.from('import_batches').update({ status: 'skipped' }).eq('id', batch.id)
    return { error: txError.message }
  }

  await supabase.from('import_batches').update({ status: 'complete' }).eq('id', batch.id)
  revalidatePath('/transactions')
  return { success: true, count: validTransactions.length }
}
