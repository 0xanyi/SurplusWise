import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { DEFAULT_CURRENCY, getStoredWorkspaceCurrency } from "@/lib/currency"

const currencyFormatters = new Map<string, Intl.NumberFormat>()
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "long",
  day: "numeric",
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function getCurrencyFormatter(currency: string) {
  const cached = currencyFormatters.get(currency)
  if (cached) return cached

  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  })
  currencyFormatters.set(currency, formatter)
  return formatter
}

export function formatCurrency(amount: number, currency?: string): string {
  const resolvedCurrency = currency ?? getStoredWorkspaceCurrency() ?? DEFAULT_CURRENCY
  try {
    return getCurrencyFormatter(resolvedCurrency).format(amount)
  } catch {
    return getCurrencyFormatter(DEFAULT_CURRENCY).format(amount)
  }
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return dateFormatter.format(d)
}
