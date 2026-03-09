import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'

export default async function DashboardPage() {
  const { userId } = await auth()

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, household_id')
    .eq('id', userId ?? '')
    .single()

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Hey {profile?.display_name} 👋
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {new Date().toLocaleDateString('en-NZ', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Coming soon cards — filled in Step 4 */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Spent this month" value={formatCurrency(0)} sub="of budget" />
        <SummaryCard label="Remaining" value={formatCurrency(0)} sub="this month" />
      </div>

      <EmptyState
        title="No budget set up yet"
        description="Upload a screenshot of your budget spreadsheet to get started."
        href="/budget"
        cta="Set up budget"
      />
    </div>
  )
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4">
      <p className="text-xs text-zinc-500 font-medium">{label}</p>
      <p className="text-xl font-semibold text-zinc-900 mt-1">{value}</p>
      <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
    </div>
  )
}

function EmptyState({ title, description, href, cta }: {
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 border-dashed p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="text-xs text-zinc-500 mt-1 mb-4">{description}</p>
      <a
        href={href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        {cta}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
    </div>
  )
}
