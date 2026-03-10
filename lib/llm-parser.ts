import { GoogleGenerativeAI } from '@google/generative-ai'

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set. Add it to .env.local and to your Vercel project environment variables. Get a free key at https://aistudio.google.com/apikey')
  return new GoogleGenerativeAI(apiKey)
}

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

const JSON_SCHEMA = `{
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
}`

const PARSING_RULES = `Parsing rules:
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

function parseGeminiResponse(text: string): ParseResult {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    return JSON.parse(cleaned) as ParseResult
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${cleaned.slice(0, 200)}`)
  }
}

export async function parseStatementText(rawText: string): Promise<ParseResult> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  const prompt = `Parse every transaction from this bank statement.

STATEMENT:
${rawText}

Return exactly this JSON structure:
${JSON_SCHEMA}

${PARSING_RULES}`

  const result = await model.generateContent(prompt)
  return parseGeminiResponse(result.response.text())
}

export async function parseStatementPdf(base64: string): Promise<ParseResult> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  })

  const prompt = `Parse every transaction from this bank statement PDF.

Return exactly this JSON structure:
${JSON_SCHEMA}

${PARSING_RULES}`

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64,
      },
    },
  ])

  return parseGeminiResponse(result.response.text())
}
