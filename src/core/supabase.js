import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hiqaqdfhopuakaydfkgb.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcWFxZGZob3B1YWtheWRma2diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Mzc4MzMsImV4cCI6MjA5MDExMzgzM30.kJ7dL57alviRjOLc0BsEk9eS_90wwQahvQfYD2GLZ68'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
