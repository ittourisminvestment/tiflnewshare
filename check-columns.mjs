import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://eykgtrxqtpteamzkovzy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5a2d0cnhxdHB0ZWFtemtvdnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDQxMjMsImV4cCI6MjA4ODc4MDEyM30.XNkSZFL_a-_F5yr1lT-r3oLEZWUxekr2a8YO6hkpBWo'
)

const { data, error } = await supabase.from('company_settings').select('*').limit(1);
if (error) {
  console.error(error);
} else {
  console.log("Columns:", Object.keys(data[0] || {}));
}
