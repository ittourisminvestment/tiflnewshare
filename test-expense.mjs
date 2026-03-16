import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Testing expense creation...');
    const { data: cat } = await supabase.from('expense_categories').select('id').limit(1);
    const payload = {
      category_id: cat[0].id,
      amount: 100,
      description: 'test',
      expense_date: '2026-03-12',
      payment_method: 'bank',
      created_by: null,
    };
    let res = await supabase.from('expenses').insert(payload).select().single();
    if (res.error) console.error('Expenses Insert Error:', res.error);
    else console.log('Expenses Insert Success:', res.data);
}

check();
