import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function ellipsify(str = '', len = 4, delimiter = '..') {
  const strLen = str.length
  const limit = len * 2 + delimiter.length

  return strLen >= limit ? str.substring(0, len) + delimiter + str.substring(strLen - len, strLen) : str
}

// Known token mappings (for Token-2022 tokens that don't expose symbol in parsed data)
export const KNOWN_TOKENS: Record<string, string> = {
  'JjxRUwLTVgrdePm8QnfzEsbXVdTHS46LKJszEdD1zuV': 'TJT', // Tip Jar Token
}

// Helper function to get token display name
export function getTokenDisplayName(mint: string, symbol?: string): string {
  // If symbol exists from parsed data, use it
  if (symbol) return symbol
  
  // Check known token mappings (for Token-2022)
  if (KNOWN_TOKENS[mint]) {
    return KNOWN_TOKENS[mint]
  }
  
  // Otherwise, use a more readable format: first 4 + last 4 characters
  if (mint.length > 8) {
    return `${mint.slice(0, 4)}...${mint.slice(-4)}`
  }
  return mint
}
