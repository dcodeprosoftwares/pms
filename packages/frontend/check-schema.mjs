import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const { data, error } = await supabase.from('bookings').select('guests_info').limit(1);
  if (error) {
    console.error('Error fetching:', error);
  } else {
    console.log('guests_info typeof:', typeof data[0]?.guests_info);
    console.log('guests_info value:', data[0]?.guests_info);
  }
}

checkSchema();
