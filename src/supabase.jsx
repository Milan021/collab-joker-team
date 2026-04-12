import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yvksbqwjryaraueydufw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2a3NicXdqcnlhcmF1ZXlkdWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzMTQ2NTMsImV4cCI6MjA1OTg5MDY1M30.bGCbrY-sHBsUGDjC6oMnPbhBCbYSi4L4MX1JYP6m-YE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
