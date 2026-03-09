'use server'

import { parseCSV } from '@/lib/csv-parsers'
import type { BatchResult } from '@/lib/types'

export async function parseCsvAction(params: {
  content: string
  bank: 'ANZ' | 'BNZ'
}): Promise<{ result?: BatchResult; error?: string }> {
  const { content, bank } = params

  let parsed
  try {
    parsed = parseCSV(content, bank)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to parse CSV' }
  }

  if (parsed.length === 0) {
    return { error: 'No valid transactions found in this CSV.' }
  }

  const accounts = [...new Set(parsed.map(t => t.account).filter((a): a is string => !!a))]

  const result: BatchResult = {
    bank,
    accounts,
    warnings: [],
    transactions: parsed.map(t => ({
      date: t.date,
      amount: t.amount,
      description: t.description,
      payee: t.payee || null,
      memo: t.memo,
      account: t.account,
      raw_data: t.raw_data,
    })),
  }

  return { result }
}
