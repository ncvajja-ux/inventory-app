import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

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
