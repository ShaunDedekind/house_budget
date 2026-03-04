import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  searchParams: { month?: string }
}

export default async function TransactionsPage({ searchParams }: Props) {
  const supabase = createClient()

  const now = new Date()
  const monthStr =
    searchParams.month ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = monthStr.split('-').map(Number)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, budget_categories(name)')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  // Group by date
  const grouped: Record<string, NonNullable<typeof transactions>> = {}
  for (const tx of transactions ?? []) {
    if (!grouped[tx.date]) grouped[tx.date] = []
    grouped[tx.date].push(tx)
  }
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-NZ', {
    month: 'long',
    year: 'numeric',
  })

  const prevDate = new Date(year, month - 2)
  const nextDate = new Date(year, month)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonth = monthStr === currentMonth

  const totalSpent = (transactions ?? [])
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Transactions</h1>
        <Link
          href="/transactions/import"
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Import
        </Link>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-zinc-100 px-4 py-3">
        <Link href={`/transactions?month=${prevMonth}`} className="p-1 text-zinc-400 hover:text-zinc-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold text-zinc-900">{monthLabel}</p>
          {totalSpent > 0 && (
            <p className="text-xs text-zinc-400">{formatCurrency(totalSpent)} spent</p>
          )}
        </div>
        <Link
          href={`/transactions?month=${nextMonth}`}
          aria-disabled={isCurrentMonth}
          className={isCurrentMonth ? 'p-1 text-zinc-200 pointer-events-none' : 'p-1 text-zinc-400 hover:text-zinc-600'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>

      {/* List */}
      {dates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {dates.map(date => (
            <div key={date}>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2 px-1">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-NZ', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
              <div className="bg-white rounded-2xl border border-zinc-100 divide-y divide-zinc-50">
                {grouped[date].map(tx => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface TxRow {
  id: string
  amount: number
  payee: string | null
  description: string | null
  date: string
  budget_categories: { name: string } | null
}

function TransactionRow({ tx }: { tx: TxRow }) {
  const isCredit = tx.amount > 0
  const label = tx.payee || tx.description || 'Unknown'
  const categoryName = tx.budget_categories?.name

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 truncate">{label}</p>
        {categoryName ? (
          <p className="text-xs text-indigo-500 mt-0.5">{categoryName}</p>
        ) : (
          <p className="text-xs text-zinc-400 mt-0.5">Uncategorised</p>
        )}
      </div>
      <p className={`text-sm font-semibold tabular-nums shrink-0 ${isCredit ? 'text-emerald-600' : 'text-zinc-900'}`}>
        {isCredit ? '+' : ''}{formatCurrency(tx.amount)}
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 border-dashed p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-zinc-900">No transactions yet</h3>
      <p className="text-xs text-zinc-500 mt-1 mb-4">
        Import a CSV from your ANZ or BNZ internet banking to get started.
      </p>
      <Link
        href="/transactions/import"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        Import transactions
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}
