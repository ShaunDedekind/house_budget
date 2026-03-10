'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { parseStatementAction } from '@/app/actions/parse-statement'
import { parseCsvAction } from '@/app/actions/parse-csv-action'
import { parsePdfAction } from '@/app/actions/parse-pdf-action'
import { saveTransactions } from '@/app/actions/save-transactions'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { BatchResult, UnifiedTransaction } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatementBatch {
  id: string
  sourceName: string
  rawText: string
  /** Pre-computed SHA-256 hex hash for PDF imports (avoids resending large base64) */
  fileHash?: string
  result: BatchResult
  expanded: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCoverageWeeks(batches: StatementBatch[]): number {
  const timestamps = batches.flatMap(b =>
    b.result.transactions
      .filter(t => t.date)
      .map(t => new Date(t.date!).getTime())
  )
  if (timestamps.length < 2) return 0
  const span = Math.max(...timestamps) - Math.min(...timestamps)
  return Math.max(1, Math.round(span / (7 * 24 * 60 * 60 * 1000)))
}

function getDateRange(batches: StatementBatch[]): { from: string | null; to: string | null } {
  const dates = batches
    .flatMap(b => b.result.transactions.filter(t => t.date).map(t => t.date!))
    .sort()
  if (dates.length === 0) return { from: null, to: null }
  return { from: dates[0], to: dates[dates.length - 1] }
}

function getUniqueAccounts(batches: StatementBatch[]): string[] {
  const set = new Set<string>()
  batches.forEach(b => b.result.accounts.forEach(a => set.add(a)))
  return [...set]
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function coverageColor(weeks: number): string {
  if (weeks >= 26) return 'bg-emerald-500'
  if (weeks >= 12) return 'bg-indigo-500'
  if (weeks >= 4) return 'bg-amber-400'
  return 'bg-red-400'
}

function coverageLabel(weeks: number): string {
  if (weeks >= 26) return 'Excellent coverage'
  if (weeks >= 12) return 'Good — aim for 26 weeks'
  if (weeks >= 4) return 'Getting there — add more statements'
  return 'Add at least 3 months for accurate budgeting'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CoverageBar({ batches }: { batches: StatementBatch[] }) {
  const weeks = getCoverageWeeks(batches)
  const range = getDateRange(batches)
  const accounts = getUniqueAccounts(batches)
  const totalTx = batches.reduce(
    (sum, b) => sum + b.result.transactions.filter(t => t.date).length,
    0
  )
  const pct = Math.min(100, (weeks / 26) * 100)

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-700">Data coverage</p>
        <span className="text-xs font-medium text-zinc-500">{weeks} / 26 weeks</span>
      </div>

      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${coverageColor(weeks)}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-zinc-500">{coverageLabel(weeks)}</p>

      <div className="flex gap-4 pt-1 border-t border-zinc-50">
        <div>
          <p className="text-xs text-zinc-400">Transactions</p>
          <p className="text-sm font-semibold text-zinc-900">{totalTx.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400">Accounts</p>
          <p className="text-sm font-semibold text-zinc-900">{accounts.length}</p>
        </div>
        {range.from && range.to && (
          <div>
            <p className="text-xs text-zinc-400">Period</p>
            <p className="text-sm font-semibold text-zinc-900">
              {formatShortDate(range.from)} – {formatShortDate(range.to)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function TransactionRow({ tx }: { tx: UnifiedTransaction }) {
  const isCredit = tx.amount > 0
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-zinc-800 truncate">{tx.description || '—'}</span>
        {tx.date && (
          <span className="text-xs text-zinc-400">{formatShortDate(tx.date)}</span>
        )}
      </div>
      <span className={`text-sm font-medium ml-3 shrink-0 ${isCredit ? 'text-emerald-600' : 'text-zinc-900'}`}>
        {isCredit ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
      </span>
    </div>
  )
}

function BatchCard({
  batch,
  onToggle,
  onRemove,
}: {
  batch: StatementBatch
  onToggle: () => void
  onRemove: () => void
}) {
  const { result } = batch
  const validTx = result.transactions.filter(t => t.date)
  const missingDates = result.transactions.length - validTx.length
  const dateRange = getDateRange([batch])
  const totalSpend = validTx
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const byAccount: Record<string, UnifiedTransaction[]> = {}
  validTx.forEach(t => {
    const key = t.account || 'Unknown account'
    if (!byAccount[key]) byAccount[key] = []
    byAccount[key].push(t)
  })

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
      <div className="flex items-start justify-between p-4 gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {result.bank && (
              <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                {result.bank}
              </span>
            )}
            {result.accounts.map(acc => (
              <span
                key={acc}
                className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full truncate max-w-[180px]"
              >
                {acc}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {validTx.length} transactions
            {dateRange.from && dateRange.to
              ? ` · ${formatShortDate(dateRange.from)} – ${formatShortDate(dateRange.to)}`
              : ''}
            {totalSpend > 0 ? ` · ${formatCurrency(totalSpend)} spent` : ''}
          </p>
          {missingDates > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">
              ⚠ {missingDates} transaction{missingDates > 1 ? 's' : ''} skipped (no date)
            </p>
          )}
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600 mt-0.5">⚠ {w}</p>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRemove}
            className="text-zinc-300 hover:text-red-400 transition-colors p-1"
            aria-label="Remove batch"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button
            onClick={onToggle}
            className="text-zinc-400 hover:text-zinc-600 transition-colors p-1"
            aria-label={batch.expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${batch.expanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {batch.expanded && (
        <div className="border-t border-zinc-50">
          {Object.entries(byAccount).map(([account, txs]) => (
            <div key={account}>
              {Object.keys(byAccount).length > 1 && (
                <p className="text-xs font-semibold text-zinc-500 px-4 pt-3 pb-1 font-mono">
                  {account}
                </p>
              )}
              <div className="px-4 divide-y divide-zinc-50">
                {txs.slice(0, 8).map((tx, i) => (
                  <TransactionRow key={i} tx={tx} />
                ))}
                {txs.length > 8 && (
                  <p className="text-xs text-zinc-400 py-2">+ {txs.length - 8} more transactions</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function ImportWizard() {
  const [batches, setBatches] = useState<StatementBatch[]>([])
  const [inputMode, setInputMode] = useState<'pdf' | 'paste' | 'csv'>('pdf')
  const [pasteText, setPasteText] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvBank, setCsvBank] = useState<'ANZ' | 'BNZ'>('ANZ')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const totalTransactions = batches.reduce(
    (sum, b) => sum + b.result.transactions.filter(t => t.date).length,
    0
  )

  async function handleParse() {
    setParseError(null)
    setParsing(true)

    let result: BatchResult | undefined
    let rawText = ''
    let fileHash: string | undefined
    let sourceName = ''

    if (inputMode === 'pdf') {
      if (!pdfFile) { setParsing(false); return }
      sourceName = pdfFile.name

      // Read binary → base64 for Claude document API; hash binary for dedup
      const buffer = await pdfFile.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      fileHash = hashHex

      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      const res = await parsePdfAction({ base64, fileName: pdfFile.name })
      if (res.error || !res.result) {
        setParseError(res.error ?? 'Failed to parse PDF')
        setParsing(false)
        return
      }
      result = res.result

    } else if (inputMode === 'paste') {
      rawText = pasteText.trim()
      sourceName = `Pasted statement ${batches.length + 1}`
      if (!rawText) { setParsing(false); return }

      const res = await parseStatementAction(rawText)
      if (res.error || !res.result) {
        setParseError(res.error ?? 'Unknown error from Claude')
        setParsing(false)
        return
      }
      result = {
        bank: res.result.bank_detected,
        accounts: res.result.accounts,
        warnings: res.result.warnings,
        transactions: res.result.transactions.map(t => ({
          date: t.date,
          amount: t.amount,
          description: t.description,
          payee: null,
          memo: null,
          account: t.account || null,
          raw_data: {},
        })),
      }

    } else {
      if (!csvFile) { setParsing(false); return }
      rawText = await csvFile.text()
      sourceName = csvFile.name

      const res = await parseCsvAction({ content: rawText, bank: csvBank })
      if (res.error || !res.result) {
        setParseError(res.error ?? 'Failed to parse CSV')
        setParsing(false)
        return
      }
      result = res.result
    }

    setParsing(false)

    if (result.transactions.length === 0) {
      setParseError('No transactions found. Try a different file or paste the statement text.')
      return
    }

    setBatches(prev => [
      ...prev,
      { id: crypto.randomUUID(), sourceName, rawText, fileHash, result, expanded: true },
    ])
    setPasteText('')
    setPdfFile(null)
    setCsvFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (pdfInputRef.current) pdfInputRef.current.value = ''
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    let count = 0

    for (const batch of batches) {
      const res = await saveTransactions({
        transactions: batch.result.transactions,
        bank: batch.result.bank ?? 'unknown',
        ...(batch.fileHash ? { fileHash: batch.fileHash } : { rawText: batch.rawText }),
        sourceName: batch.sourceName,
      })
      if (res.error) {
        setSaveError(res.error)
        setSaving(false)
        return
      }
      count += res.count ?? 0
    }

    setSaving(false)
    setSavedCount(count)
  }

  function toggleBatch(id: string) {
    setBatches(prev => prev.map(b => (b.id === id ? { ...b, expanded: !b.expanded } : b)))
  }

  function removeBatch(id: string) {
    setBatches(prev => prev.filter(b => b.id !== id))
  }

  const canParse =
    inputMode === 'paste' ? pasteText.trim().length > 0
    : inputMode === 'pdf' ? pdfFile !== null
    : csvFile !== null

  // ── Success state ──────────────────────────────────────────────────────────
  if (savedCount !== null) {
    const weeks = getCoverageWeeks(batches)
    const accounts = getUniqueAccounts(batches)
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link href="/transactions" className="text-zinc-400 hover:text-zinc-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold text-zinc-900">Import complete</h1>
        </div>

        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-emerald-900">
              {savedCount.toLocaleString()} transactions saved
            </p>
            <p className="text-sm text-emerald-700 mt-1">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} · {weeks} weeks of data
            </p>
          </div>
          <Link
            href="/transactions"
            className="mt-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
          >
            View transactions
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  // ── Main wizard ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/transactions" className="text-zinc-400 hover:text-zinc-600">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Import statements</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Upload a PDF, paste text, or import a CSV
          </p>
        </div>
      </div>

      {batches.length > 0 && <CoverageBar batches={batches} />}

      {batches.map(batch => (
        <BatchCard
          key={batch.id}
          batch={batch}
          onToggle={() => toggleBatch(batch.id)}
          onRemove={() => removeBatch(batch.id)}
        />
      ))}

      {/* Input card */}
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-700">
            {batches.length > 0 ? 'Add another statement' : 'Add a statement'}
          </p>

          {/* Mode toggle */}
          <div className="flex bg-zinc-100 rounded-lg p-1 gap-1">
            {([
              { mode: 'pdf', label: 'PDF' },
              { mode: 'paste', label: 'Paste' },
              { mode: 'csv', label: 'CSV' },
            ] as const).map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setInputMode(mode); setParseError(null) }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  inputMode === mode
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {inputMode === 'pdf' ? (
          <div className="flex flex-col gap-3">
            <label
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${
                pdfFile ? 'border-indigo-300 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={e => {
                  setPdfFile(e.target.files?.[0] ?? null)
                  setParseError(null)
                }}
              />
              <svg
                width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke={pdfFile ? '#6366f1' : '#a1a1aa'}
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="9" y1="17" x2="15" y2="17" />
                <polyline points="9 9 10 9" />
              </svg>
              {pdfFile ? (
                <span className="text-sm font-medium text-indigo-600">{pdfFile.name}</span>
              ) : (
                <div className="text-center">
                  <span className="text-sm font-medium text-zinc-600">Choose a PDF statement</span>
                  <p className="text-xs text-zinc-400 mt-0.5">or drag and drop</p>
                </div>
              )}
            </label>
            <p className="text-xs text-zinc-400">
              Claude reads the PDF directly · ANZ, BNZ, ASB, Westpac · any format
            </p>
          </div>
        ) : inputMode === 'paste' ? (
          <>
            <textarea
              value={pasteText}
              onChange={e => { setPasteText(e.target.value); setParseError(null) }}
              placeholder={
                'Paste your bank statement here.\n\n' +
                'ANZ: Credit Card → View statement → select page → copy all text\n' +
                'BNZ: Account → Export → copy the text, or upload the CSV below'
              }
              rows={10}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800 placeholder-zinc-400 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
            />
            <p className="text-xs text-zinc-400 -mt-2">
              Works with any bank · ANZ, BNZ, ASB, Westpac · Claude auto-detects the format
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Bank selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600">Bank</label>
              <select
                value={csvBank}
                onChange={e => setCsvBank(e.target.value as 'ANZ' | 'BNZ')}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="ANZ">ANZ</option>
                <option value="BNZ">BNZ</option>
              </select>
            </div>

            <label
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${
                csvFile ? 'border-indigo-300 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.txt"
                className="sr-only"
                onChange={e => {
                  setCsvFile(e.target.files?.[0] ?? null)
                  setParseError(null)
                }}
              />
              <svg
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke={csvFile ? '#6366f1' : '#a1a1aa'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              {csvFile ? (
                <span className="text-sm font-medium text-indigo-600">{csvFile.name}</span>
              ) : (
                <span className="text-sm text-zinc-400">Tap to choose a CSV file</span>
              )}
            </label>
            <p className="text-xs text-zinc-400">
              Parsed directly — no AI needed for CSVs
            </p>
          </div>
        )}

        {parseError && (
          <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">
            {parseError}
          </div>
        )}

        <Button onClick={handleParse} loading={parsing} disabled={!canParse}>
          {parsing
            ? inputMode === 'csv' ? 'Parsing CSV…' : 'Parsing with Claude…'
            : inputMode === 'csv' ? 'Parse CSV'
            : inputMode === 'pdf' ? 'Parse PDF with Claude'
            : 'Parse with Claude'}
        </Button>

        {parsing && inputMode !== 'csv' && (
          <p className="text-xs text-zinc-400 text-center -mt-2">
            Claude is reading your statement — usually takes a few seconds
          </p>
        )}
      </div>

      {/* Sticky save button */}
      {batches.length > 0 && (
        <div className="fixed bottom-20 inset-x-0 px-4 z-10">
          <div className="max-w-2xl mx-auto flex flex-col gap-2">
            {saveError && (
              <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600 shadow">
                {saveError}
              </div>
            )}
            <Button
              onClick={handleSave}
              loading={saving}
              size="lg"
              className="w-full shadow-lg shadow-indigo-200"
            >
              {saving
                ? 'Saving…'
                : `Save ${totalTransactions.toLocaleString()} transaction${totalTransactions !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
