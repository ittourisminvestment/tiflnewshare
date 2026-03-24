-- ============================================
-- MASTER CONTROLLER DATABASE SCHEMA
-- Run this in your Master Supabase Project's SQL Editor
-- ============================================

CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  database_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  license_key TEXT UNIQUE NOT NULL,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('Startup', 'Growth', 'Enterprise (Unlimited)', 'Enterprise')),
  is_active BOOLEAN DEFAULT true,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS to secure data
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Note: Since the dashboard interacts using the Service Role Key, 
-- explicit RLS policies for the dashboard are not strictly necessary 
-- but are best practice to prevent unauthorized public access.
