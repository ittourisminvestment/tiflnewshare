import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { licenseKey } = await req.json();

    if (!licenseKey) {
      return NextResponse.json({ valid: false, message: 'License key is missing.' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ valid: false, message: 'Master configuration error.' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch license and associated tenant status
    const { data: license, error } = await supabase
      .from('licenses')
      .select(`
        *,
        tenants (status)
      `)
      .eq('license_key', licenseKey)
      .single();

    if (error || !license) {
      return NextResponse.json({ valid: false, message: 'Invalid license key.' });
    }

    const now = new Date();
    const expiry = new Date(license.valid_until);

    if (!license.is_active) {
      return NextResponse.json({ valid: false, message: 'License has been deactivated.' });
    }

    if (expiry < now) {
      return NextResponse.json({ valid: false, message: 'License has expired.', expiry: license.valid_until });
    }

    if (license.tenants?.status !== 'active') {
      return NextResponse.json({ valid: false, message: `Tenant account is ${license.tenants?.status || 'inactive'}.` });
    }

    return NextResponse.json({ 
      valid: true, 
      plan: license.plan_tier,
      expiresAt: license.valid_until 
    });

  } catch (error: any) {
    console.error('License Validation Error:', error);
    return NextResponse.json({ valid: false, message: 'Internal server error during validation.' }, { status: 500 });
  }
}
