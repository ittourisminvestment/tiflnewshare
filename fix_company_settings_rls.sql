-- ================================================
-- FIX: Company Settings Bugs
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/eykgtrxqtpteamzkovzy/sql
-- ================================================

-- 1. CRITICAL FIX: Allow 'admin' role (not just 'super_admin') to update company settings
--    The original policy only allowed 'super_admin', causing silent save failures for 'admin' users.
DROP POLICY IF EXISTS "settings_update" ON public.company_settings;

CREATE POLICY "settings_update" ON public.company_settings 
  FOR UPDATE TO authenticated 
  USING (public.get_user_role() IN ('super_admin', 'admin'));

-- 2. Allow unauthenticated (anon) users to read basic company branding info
--    This is needed because the login page loads before the user logs in.
DROP POLICY IF EXISTS "settings_anon_select" ON public.company_settings;

CREATE POLICY "settings_anon_select" ON public.company_settings 
  FOR SELECT TO anon 
  USING (true);

-- 3. FIX LOGO DISPLAY: Allow public read for company branding assets (logo, stamp, letter pad)
--    The documents bucket is private, but company logos need to be publicly readable
--    so they show correctly on the login page and sidebar.
DROP POLICY IF EXISTS "public_read_settings_assets" ON storage.objects;

CREATE POLICY "public_read_settings_assets" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'documents' AND (name LIKE 'settings/%' OR name LIKE 'signatures/%'));

-- 4. Verify the fix - check your current company settings:
SELECT id, company_name, address, logo_url, updated_at FROM company_settings ORDER BY updated_at DESC;

