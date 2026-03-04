export interface ParsedTransaction {
  date: string        // ISO date YYYY-MM-DD
  amount: number
  description: string
  payee: string
  memo: string | null
  account: string | null
  raw_data: Record<string, string>
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function toISODate(raw: string): string {
  const trimmed = raw.trim()
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // DD/MM/YYYY or D/M/YYYY
  const parts = trimmed.split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  throw new Error(`Unrecognised date format: ${raw}`)
}

export function parseCSV(content: string, bank: 'ANZ' | 'BNZ'): ParsedTransaction[] {
  const lines = content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  // Find the header row (first row containing "date")
  const headerIdx = lines.findIndex(l => l.toLowerCase().includes('date'))
  if (headerIdx === -1) throw new Error('Could not find header row — make sure you exported the correct CSV format')

  const headers = parseCSVLine(lines[headerIdx]).map(h => h.toLowerCase().trim())

  const rows = lines.slice(headerIdx + 1)

  return rows
    .map(line => {
      const vals = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = vals[i] ?? '' })

      let date: string
      try {
        date = toISODate(row['date'] ?? '')
      } catch {
        return null
      }

      const amount = parseFloat(row['amount'] ?? '')
      if (isNaN(amount)) return null

      if (bank === 'ANZ') {
        const description = [row['particulars'], row['code'], row['reference']]
          .filter(Boolean)
          .join(' ')
          .trim()

        return {
          date,
          amount,
          description: description || row['payee'] || '',
          payee: row['payee'] || '',
          memo: row['particulars'] || null,
          account: null,
          raw_data: row,
        }
      } else {
        // BNZ
        return {
          date,
          amount,
          description: row['memo'] || row['payee'] || '',
          payee: row['payee'] || '',
          memo: row['memo'] || null,
          account: row['account number'] || null,
          raw_data: row,
        }
      }
    })
    .filter((t): t is ParsedTransaction => t !== null)
}
