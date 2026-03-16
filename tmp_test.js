const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eykgtrxqtpteamzkovzy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5a2d0cnhxdHB0ZWFtemtvdnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDQxMjMsImV4cCI6MjA4ODc4MDEyM30.XNkSZFL_a-_F5yr1lT-r3oLEZWUxekr2a8YO6hkpBWo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('loan_repayments')
    .select('id, amount, remarks, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Fetch Error:", error);
  } else {
    console.log("Last 5 Payments:", JSON.stringify(data, null, 2));
  }
}

run();
