import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function computeMonthlyEquivalent(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':      return amount * (52 / 12)
    case 'fortnightly': return amount * (26 / 12)
    case 'monthly':     return amount
    case 'quarterly':   return amount / 3
    case 'annual':      return amount / 12
    default:            return amount
  }
}
