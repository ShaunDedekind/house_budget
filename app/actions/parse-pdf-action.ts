'use server'

import { parseStatementPdf } from '@/lib/llm-parser'
import type { BatchResult } from '@/lib/types'

export async function parsePdfAction(params: {
  base64: string
  fileName: string
}): Promise<{ result?: BatchResult; error?: string }> {
  const { base64 } = params

  let parsed
  try {
    parsed = await parseStatementPdf(base64)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to parse PDF' }
  }

  if (parsed.transactions.length === 0) {
    return { error: 'No transactions found in this PDF.' }
  }

  const result: BatchResult = {
    bank: parsed.bank_detected,
    accounts: parsed.accounts,
    warnings: parsed.warnings,
    transactions: parsed.transactions.map(t => ({
      date: t.date,
      amount: t.amount,
      description: t.description,
      payee: null,
      memo: null,
      account: t.account || null,
      raw_data: {},
    })),
  }

  return { result }
}
