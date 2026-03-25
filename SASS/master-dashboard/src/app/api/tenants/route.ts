import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Master database environment variables are missing.' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch tenants with their associated licenses
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select(`
        *,
        licenses (*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(tenants);
  } catch (error: any) {
    console.error('Fetch Tenants Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Support for toggling tenant status (Active/Suspended) or Extending License
export async function PATCH(req: Request) {
  try {
    const { id, status, extendDays, licenseId } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Update Status
    if (status) {
      const { error } = await supabase
        .from('tenants')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    }

    // 2. Extend License
    if (extendDays && licenseId) {
       // Fetch current license to add days
       const { data: license } = await supabase.from('licenses').select('valid_until').eq('id', licenseId).single();
       if (license) {
          const newDate = new Date(license.valid_until);
          newDate.setDate(newDate.getDate() + extendDays);
          
          const { error } = await supabase
            .from('licenses')
            .update({ valid_until: newDate.toISOString() })
            .eq('id', licenseId);
          if (error) throw error;
       }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Support for deleting a tenant environment from the master list
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) throw new Error("ID required");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
