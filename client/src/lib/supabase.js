import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check client/.env')
}

// PostgREST uses RFC 3986 percent-encoding — spaces must be %20, not +.
// URLSearchParams (used internally) encodes spaces as + (form-encoding),
// which PostgREST treats as a literal + character and fails with 400.
// Override fetch to rewrite + → %20 in query strings before every request.
const supaFetch = (input, init) => {
  if (typeof input === 'string' && input.includes('+')) {
    const [base, qs] = input.split('?')
    if (qs) input = base + '?' + qs.replace(/\+/g, '%20')
  }
  return fetch(input, init)
}

export const supabase = createClient(url, key, { global: { fetch: supaFetch } })

// Schema-scoped helpers — mirror the original 7 SQLite databases
export const db = {
  customers:    () => supabase.schema('customers'),
  inventory:    () => supabase.schema('inventory'),
  transactions: () => supabase.schema('transactions'),
  pricing:      () => supabase.schema('pricing'),
  buyers:       () => supabase.schema('buyers'),
  hr:           () => supabase.schema('hr'),
  groups:       () => supabase.schema('groups'),
}
