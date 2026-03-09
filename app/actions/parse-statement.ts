'use server'

import { parseStatementText, type ParseResult } from '@/lib/llm-parser'

export async function parseStatementAction(
  rawText: string
): Promise<{ result?: ParseResult; error?: string }> {
  if (!rawText.trim()) return { error: 'No text provided' }

  try {
    const result = await parseStatementText(rawText)
    return { result }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
