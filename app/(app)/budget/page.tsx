import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createCategory, upsertBudgetItem } from '@/app/actions/budget'

type BudgetGroup = {
  id: string
  name: string
  target_pct: number | null
  sort_order: number | null
}

type BudgetCategory = {
  id: string
  name: string
  owner: string | null
  is_savings: boolean | null
  is_personal_allowance: boolean | null
  group_id: string | null
}

type BudgetItem = {
  id: string
  category_id: string
  amount: number
  frequency: string
  monthly_equivalent: number
}

export default async function BudgetPage() {
  const supabase = await createClient()

  const [{ data: groups }, { data: categories }, { data: items }] = await Promise.all([
    supabase
      .from('budget_groups')
      .select('id, name, target_pct, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('budget_categories')
      .select('id, name, owner, is_savings, is_personal_allowance, group_id')
      .order('sort_order', { ascending: true }),
    supabase
      .from('budget_items')
      .select('id, category_id, amount, frequency, monthly_equivalent')
      .is('effective_to', null),
  ])

  const itemsByCategory = new Map<string, BudgetItem>()
  for (const item of items ?? []) {
    itemsByCategory.set(item.category_id, item)
  }

  const groupsWithCategories: Array<{
    group: BudgetGroup
    categories: Array<BudgetCategory & { item: BudgetItem | null }>
    monthlyTotal: number
  }> = (groups ?? []).map(group => {
    const cats = (categories ?? [])
      .filter(c => c.group_id === group.id)
      .map(c => {
        const item = itemsByCategory.get(c.id) ?? null
        return { ...c, item }
      })

    const monthlyTotal = cats.reduce(
      (sum, c) => sum + (c.item?.monthly_equivalent ?? 0),
      0
    )

    return { group, categories: cats, monthlyTotal }
  })

  const overallMonthly = groupsWithCategories.reduce(
    (sum, g) => sum + g.monthlyTotal,
    0
  )

  const owners = ['joint', 'shaun', 'rosie'] as const
  const frequencies = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'fortnightly', label: 'Fortnightly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annual', label: 'Annual' },
  ]

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Budget</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          50 / 30 / 20 style buckets with simple monthly amounts.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">Total monthly budget</p>
          <p className="text-xl font-semibold text-zinc-900 mt-1">
            {overallMonthly > 0 ? formatCurrency(overallMonthly) : '—'}
          </p>
        </div>
        <p className="text-xs text-zinc-400 max-w-[180px] text-right">
          Based on the active amount for each category. You can tweak categories below.
        </p>
      </div>

      {/* Groups and categories */}
      <div className="flex flex-col gap-4">
        {groupsWithCategories.map(({ group, categories, monthlyTotal }) => (
          <section
            key={group.id}
            className="bg-white rounded-2xl border border-zinc-100 p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{group.name}</p>
                {group.target_pct != null && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Target {group.target_pct}% · {monthlyTotal > 0 ? formatCurrency(monthlyTotal) : 'no budget yet'}
                  </p>
                )}
              </div>
              {group.target_pct != null && overallMonthly > 0 && (
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                  {Math.round((monthlyTotal / overallMonthly) * 100)}% of total
                </span>
              )}
            </div>

            <div className="divide-y divide-zinc-50">
              {categories.length === 0 && (
                <p className="text-xs text-zinc-400 py-2">
                  No categories yet — add one below.
                </p>
              )}
              {categories.map(category => (
                <div
                  key={category.id}
                  className="py-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {category.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {category.owner && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                            {category.owner}
                          </span>
                        )}
                        {category.is_savings && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            Savings
                          </span>
                        )}
                        {category.is_personal_allowance && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                            Personal
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-zinc-900">
                        {category.item ? formatCurrency(category.item.monthly_equivalent) : '—'}
                      </p>
                      {category.item && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {formatCurrency(category.item.amount)} · {category.item.frequency}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Inline budget editor */}
                  <form
                    action={upsertBudgetItem}
                    className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_auto] gap-2 items-center"
                  >
                    <input type="hidden" name="category_id" value={category.id} />
                    <Input
                      id={`amount-${category.id}`}
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Amount"
                      defaultValue={category.item?.amount ?? ''}
                    />
                    <div className="flex items-center">
                      <select
                        name="frequency"
                        defaultValue={category.item?.frequency ?? 'monthly'}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        {frequencies.map(f => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" size="sm" variant="secondary">
                      Save
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Add category */}
      <section className="bg-white rounded-2xl border border-zinc-100 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Add category</h2>
        <form action={createCategory} className="flex flex-col gap-3">
          <Input
            id="name"
            name="name"
            label="Category name"
            placeholder="e.g. Groceries, Rent, Fuel"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Bucket</label>
              <select
                name="group_id"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {groups?.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Owner</label>
              <select
                name="owner"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Shared</option>
                {owners.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="is_savings"
                className="w-4 h-4 rounded border border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              Savings
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="is_personal_allowance"
                className="w-4 h-4 rounded border border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              Personal allowance
            </label>
          </div>

          <Button type="submit" size="md">
            Add category
          </Button>
        </form>
      </section>
    </div>
  )
}

