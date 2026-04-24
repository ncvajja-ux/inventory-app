import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check client/.env')
}

export const supabase = createClient(url, key)

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
