$outputFile = "d:\shree bihani investment pvt ltd\SASS\init_schema.sql"

if (-not (Test-Path "d:\shree bihani investment pvt ltd\SASS")) {
    New-Item -ItemType Directory -Path "d:\shree bihani investment pvt ltd\SASS"
}

# Combine existing files
Get-Content "d:\shree bihani investment pvt ltd\supabase-migration.sql",
            "d:\shree bihani investment pvt ltd\add_columns.sql",
            "d:\shree bihani investment pvt ltd\supabase\migrations\20260317124000_add_nepali_names.sql" | Out-File $outputFile -Encoding utf8

# Add AGM tables
$agmSql = @"

-- ============================================
-- AGM MODULE TABLES AND POLICIES
-- ============================================

-- 15. AGM SESSIONS
CREATE TABLE public.agm_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  fiscal_year_id UUID NOT NULL REFERENCES public.fiscal_years(id),
  meeting_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. AGM ATTENDANCE
CREATE TABLE public.agm_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agm_id UUID NOT NULL REFERENCES public.agm_sessions(id) ON DELETE CASCADE,
  shareholder_id UUID NOT NULL REFERENCES public.shareholders(id),
  status TEXT NOT NULL DEFAULT 'physical',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. AGM PROXIES
CREATE TABLE public.agm_proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agm_id UUID NOT NULL REFERENCES public.agm_sessions(id) ON DELETE CASCADE,
  giver_shareholder_id UUID NOT NULL REFERENCES public.shareholders(id),
  proxy_holder_id UUID REFERENCES public.shareholders(id),
  proxy_holder_name TEXT,
  allocated_shares INT NOT NULL,
  proxy_document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. AGM RESOLUTIONS
CREATE TABLE public.agm_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agm_id UUID NOT NULL REFERENCES public.agm_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  resolution_type TEXT DEFAULT 'ordinary',
  order_num INT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. AGM VOTES
CREATE TABLE public.agm_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id UUID NOT NULL REFERENCES public.agm_resolutions(id) ON DELETE CASCADE,
  agm_id UUID NOT NULL REFERENCES public.agm_sessions(id) ON DELETE CASCADE,
  voter_shareholder_id UUID REFERENCES public.shareholders(id),
  voter_name TEXT,
  vote_kittas INT NOT NULL,
  vote TEXT NOT NULL,
  vote_mode TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add AGM Settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS agm_proxy_unit int DEFAULT 10000;

-- RLS for AGM Tables
ALTER TABLE public.agm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agm_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agm_proxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agm_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agm_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agm_sessions_select" ON public.agm_sessions FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "agm_sessions_all" ON public.agm_sessions FOR ALL TO authenticated USING (public.get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "agm_attendance_select" ON public.agm_attendance FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "agm_attendance_all" ON public.agm_attendance FOR ALL TO authenticated USING (public.get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "agm_proxies_select" ON public.agm_proxies FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "agm_proxies_all" ON public.agm_proxies FOR ALL TO authenticated USING (public.get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "agm_resolutions_select" ON public.agm_resolutions FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "agm_resolutions_all" ON public.agm_resolutions FOR ALL TO authenticated USING (public.get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "agm_votes_select" ON public.agm_votes FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "agm_votes_all" ON public.agm_votes FOR ALL TO authenticated USING (public.get_user_role() IN ('super_admin', 'admin'));
"@

$agmSql | Out-File $outputFile -Append -Encoding utf8

Write-Host "init_schema.sql generated successfully."
