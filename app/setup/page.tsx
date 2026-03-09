'use client'

import { useState } from 'react'
import { createHousehold } from '@/app/actions/household'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SetupPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setLoading(true)
    const result = await createHousehold(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 5V15H10V10H6V15H2V5L8 1Z" fill="white"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-zinc-900">Home Base</span>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">Set up your household</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Give your household a name to get started. You can change this later.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8">
          <form action={handleSubmit} className="flex flex-col gap-6">
            <Input
              id="name"
              name="name"
              label="Household name"
              placeholder="e.g. Shaun & Rosie"
              required
              autoFocus
            />

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading}>
              Create household
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Your data is private and scoped to your household only.
        </p>
      </div>
    </div>
  )
}
