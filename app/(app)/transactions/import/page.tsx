'use client'

import { useState } from 'react'
import { importTransactions } from '@/app/actions/transactions'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ImportPage() {
  const [bank, setBank] = useState<'ANZ' | 'BNZ'>('ANZ')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return setError('Please select a CSV file')

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.set('file', file)
    formData.set('bank', bank)

    const result = await importTransactions(formData)
    setLoading(false)

    if (result?.error) setError(result.error)
    // On success the server action redirects to /transactions
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/transactions" className="text-zinc-400 hover:text-zinc-600">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900">Import transactions</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Bank selector */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-zinc-700">Select your bank</p>
          <div className="grid grid-cols-2 gap-2">
            {(['ANZ', 'BNZ'] as const).map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBank(b)}
                className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                  bank === b
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-100 hover:bg-zinc-100'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* File upload */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-zinc-700">Upload CSV file</p>
          <p className="text-xs text-zinc-400">
            In {bank} internet banking, go to your account history and export as CSV.
          </p>
          <label
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${
              file ? 'border-indigo-300 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={e => {
                setFile(e.target.files?.[0] ?? null)
                setError(null)
              }}
            />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={file ? '#6366f1' : '#a1a1aa'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            {file ? (
              <span className="text-sm font-medium text-indigo-600">{file.name}</span>
            ) : (
              <span className="text-sm text-zinc-400">Tap to choose a CSV file</span>
            )}
          </label>
        </div>

        {error && (
          <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={!file} loading={loading}>
          {loading ? 'Importing…' : 'Import transactions'}
        </Button>
      </form>
    </div>
  )
}
