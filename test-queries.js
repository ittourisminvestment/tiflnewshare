import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log('Testing returns fetch...');
    let res = await supabase.from('investment_returns').select('*, company_investments(title), company_banks(bank_name)').is('deleted_at', null).order('return_date', { ascending: false });
    if (res.error) console.error('Returns Error:', res.error);
    else console.log('Returns Success, count:', res.data?.length);

    console.log('Testing board_meetings fetch...');
    let res2 = await supabase.from('board_meetings').select('id').is('deleted_at', null).limit(1);
    if (res2.error) console.error('Meetings Error:', res2.error);
    else console.log('Meetings Success, count:', res2.data?.length);
}

check();
