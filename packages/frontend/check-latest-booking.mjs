import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLatestBooking() {
  const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error('Error fetching:', error);
  } else {
    for (const b of data) {
      console.log(`Booking ${b.custom_id} | Status: ${b.status} | Checked-in count: ${b.checked_in_count} | Total guests: ${b.total_guests}`);
      console.log(`Guests Info:`, b.guests_info);
      console.log('---');
    }
  }
}

checkLatestBooking();
