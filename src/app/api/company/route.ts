import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Public endpoint - returns basic company branding info (name, logo, address)
// Uses service role to bypass RLS so the login page can fetch before auth
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json({ error: 'Missing SUPABASE_URL' }, { status: 500 });
    }

    // If no service role key, fall back to anon key (will be blocked by RLS if not set up)
    const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, key);

    const { data, error } = await supabase
      .from('company_settings')
      .select('company_name, address, logo_url, email, phone')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, {
      headers: {
        // Cache for 30 seconds - balances freshness with performance
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
