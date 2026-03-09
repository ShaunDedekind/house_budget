import Anthropic from '@anthropic-ai/sdk'

export interface LLMTransaction {
  date: string | null       // ISO YYYY-MM-DD or null if not parseable
  amount: number            // negative = debit/expense, positive = credit/income
  description: string       // cleaned merchant/payee name
  account: string           // account number or label this tx belongs to
  type: 'debit' | 'credit' | 'transfer' | 'unknown'
}

export interface ParseResult {
  bank_detected: string | null
  accounts: string[]
  date_range: { from: string | null; to: string | null }
  warnings: string[]
  transactions: LLMTransaction[]
}

const SYSTEM_PROMPT = `You are a bank statement parser. Extract all transactions from raw bank statement text.
Respond with ONLY valid JSON — no markdown fences, no explanation, nothing else.`

const buildUserPrompt = (rawText: string) => `Parse every transaction from this bank statement.

STATEMENT:
${rawText}

Return exactly this JSON structure:
{
  "bank_detected": "ANZ" | "BNZ" | "ASB" | "Westpac" | "other" | null,
  "accounts": ["list of unique account identifiers found in the statement"],
  "date_range": { "from": "YYYY-MM-DD" | null, "to": "YYYY-MM-DD" | null },
  "warnings": ["any issues e.g. missing dates, ambiguous data"],
  "transactions": [
    {
      "date": "YYYY-MM-DD" | null,
      "amount": -50.00,
      "description": "cleaned merchant or payee name",
      "account": "account identifier this transaction belongs to",
      "type": "debit" | "credit" | "transfer" | "unknown"
    }
  ]
}

Parsing rules:
- ANZ credit card: a "Type" column of "D" = debit → negative amount; "C" = credit/payment → positive amount
- BNZ: amounts are already signed (negative = expense, positive = income/transfer in)
- Ignore serial/reference columns — especially scientific notation like 4.34667E+11 or 2.51126E+11
- Strip trailing location from descriptions: remove "Auckland Nz", "Glenfield Nz", "Sydney Au", "Christchurch Nz" etc.
- Missing or blank dates → set date to null and add a warning
- Include EVERY transaction — do not skip small ones
- For BNZ: account identifier comes from the section header (e.g. "Flexi Joint - 02-1244-0241366-000")
- For ANZ CC: account identifier is the card number shown in the Card column
- dates MUST be in YYYY-MM-DD format
- "Online Payment - Thank You" type entries are transfers/payments → type "transfer", positive amount`

function parseClaudeResponse(text: string): ParseResult {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    return JSON.parse(cleaned) as ParseResult
  } catch {
    throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 200)}`)
  }
}

export async function parseStatementText(rawText: string): Promise<ParseResult> {
  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(rawText) }],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')
  return parseClaudeResponse(content.text)
}

const PDF_USER_PROMPT = `Parse every transaction from this bank statement PDF.

Return exactly this JSON structure:
{
  "bank_detected": "ANZ" | "BNZ" | "ASB" | "Westpac" | "other" | null,
  "accounts": ["list of unique account identifiers found in the statement"],
  "date_range": { "from": "YYYY-MM-DD" | null, "to": "YYYY-MM-DD" | null },
  "warnings": ["any issues e.g. missing dates, ambiguous data"],
  "transactions": [
    {
      "date": "YYYY-MM-DD" | null,
      "amount": -50.00,
      "description": "cleaned merchant or payee name",
      "account": "account identifier this transaction belongs to",
      "type": "debit" | "credit" | "transfer" | "unknown"
    }
  ]
}

Parsing rules:
- ANZ credit card: a "Type" column of "D" = debit → negative amount; "C" = credit/payment → positive amount
- BNZ: amounts are already signed (negative = expense, positive = income/transfer in)
- Strip trailing location from descriptions: remove "Auckland Nz", "Glenfield Nz", "Sydney Au", "Christchurch Nz" etc.
- Missing or blank dates → set date to null and add a warning
- Include EVERY transaction — do not skip small ones
- For BNZ: account identifier comes from the section header (e.g. "Flexi Joint - 02-1244-0241366-000")
- For ANZ CC: account identifier is the card number shown in the Card column
- dates MUST be in YYYY-MM-DD format
- "Online Payment - Thank You" type entries are transfers/payments → type "transfer", positive amount`

export async function parseStatementPdf(base64: string): Promise<ParseResult> {
  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          } as any,
          { type: 'text', text: PDF_USER_PROMPT },
        ],
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')
  return parseClaudeResponse(content.text)
}
