import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: settings, error: sError } = await supabase.from('company_settings').select('*').limit(1);
  console.log("--- company_settings keys ---");
  if (settings && settings[0]) {
    console.log(Object.keys(settings[0]));
    console.log("Full settings row:", settings[0]);
  } else {
    console.log("No settings row found or error:", sError);
  }

  const { data: installments, error: iError } = await supabase.from('loan_installments').select('*').limit(1);
  console.log("\n--- loan_installments keys ---");
  if (installments && installments[0]) {
    console.log(Object.keys(installments[0]));
  } else {
    console.log("No installments row found or error:", iError);
  }
}

inspect();
