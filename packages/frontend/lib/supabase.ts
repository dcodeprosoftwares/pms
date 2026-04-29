import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your_supabase_project_url') {
  console.error('❌ Supabase credentials missing or invalid in .env.local. Please add your actual Supabase URL and Anon Key.');
}

export const supabase = createClient(
  supabaseUrl === 'your_supabase_project_url' ? 'https://placeholder.supabase.co' : supabaseUrl, 
  supabaseAnonKey === 'your_supabase_anon_key' ? 'placeholder' : supabaseAnonKey
);
