import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zqteoqnxgcgduevlkqrj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxdGVvcW54Z2NnZHVldmxrcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NTM2NDgsImV4cCI6MjA3NTAyOTY0OH0.9I5CyDviX0sXWNh66ypyqUfqzWo5Vr9m8yn3Q_YXUE8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
