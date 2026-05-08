import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pwrldrngqxbvwfztxxrd.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cmxkcm5ncXhidndmenR4eHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTc5NTUsImV4cCI6MjA5MDA5Mzk1NX0.vQi6N4s5Y_iwU1eIi4g8q_T8bW4j8mBH7BFDamAhB0Y'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
