// lib/saas/validateLicense.ts
// This utility will validate the tenant's license key against the Master Controller API

export type LicenseStatus = {
  valid: boolean;
  company?: string;
  tier?: string;
  expiresAt?: string;
  reason?: string;
};

export async function validateTenantLicense(): Promise<LicenseStatus> {
  const isSaaSMode = process.env.NEXT_PUBLIC_SAAS_MODE === 'true';
  const masterApiUrl = process.env.NEXT_PUBLIC_MASTER_API_URL;
  const licenseKey = process.env.TENANT_LICENSE_KEY;

  // If we are not in SaaS mode, instantly return valid (doesn't affect your original project)
  if (!isSaaSMode) {
    return { valid: true, company: "Local Single Tenant" };
  }

  // If SaaS mode is enabled but we lack credentials, consider invalid
  if (!masterApiUrl || !licenseKey) {
    return { valid: false, reason: "Missing license configuration" };
  }

  try {
    const response = await fetch(`${masterApiUrl}/functions/v1/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
      // Optional: Add caching if you want to avoid hitting the API on every request
      next: { revalidate: 3600 } // cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Master API returned ${response.status}`);
    }

    const data: LicenseStatus = await response.json();
    return data;

  } catch (error) {
    console.error("License validation error:", error);
    // Fail closed (or open depending on your risk tolerance)
    return { valid: false, reason: "Failed to validate license with Master Control" };
  }
}
