import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { licenseKey } = await req.json()

    if (!licenseKey) {
      return new Response(JSON.stringify({ valid: false, reason: "No license key provided" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Initialize Supabase Client with SERVICE ROLE to bypass RLS
    // MASTER_DB_URL and MASTER_DB_SERVICE_KEY must be stored in Edge Function secrets
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validate License
    const { data: license, error } = await supabaseClient
      .from('licenses')
      .select('*, tenants(company_name, status)')
      .eq('license_key', licenseKey)
      .single()

    if (error || !license) {
      return new Response(JSON.stringify({ valid: false, reason: "Invalid license key" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (!license.is_active || license.tenants.status !== 'active') {
      return new Response(JSON.stringify({ valid: false, reason: "License is suspended or inactive" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (new Date(license.valid_until) < new Date()) {
      return new Response(JSON.stringify({ valid: false, reason: "License has expired" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({
      valid: true,
      company: license.tenants.company_name,
      tier: license.plan_tier,
      expiresAt: license.valid_until
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
