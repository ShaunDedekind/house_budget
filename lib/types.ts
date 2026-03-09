// Shared transaction shape — both CSV and LLM parsers map to this.
export interface UnifiedTransaction {
  date: string | null       // ISO YYYY-MM-DD, or null if unparseable
  amount: number            // negative = expense, positive = income/credit
  description: string
  payee: string | null
  memo: string | null
  account: string | null
  raw_data: Record<string, string>
}

// Result shape returned from both parse paths before saving.
export interface BatchResult {
  bank: string | null
  accounts: string[]        // unique account identifiers found
  warnings: string[]
  transactions: UnifiedTransaction[]
}
