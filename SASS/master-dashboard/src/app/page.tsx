'use client';

import { useState } from 'react';
import { Database, ShieldCheck, Mail, Building, Key, Loader2, ArrowRight } from 'lucide-react';

export default function SetupWizard() {
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    companyName: '',
    contactEmail: '',
    databaseUrl: '',
    planTier: 'standard'
  });

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to provision tenant');
      
      setSuccessData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-green-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} className="text-green-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Tenant Provisioned!</h2>
          <p className="text-gray-500 mb-8 border-b pb-8">
            The database for {formData.companyName} has been initialized with all tables, functions, and RLS policies.
          </p>

          <div className="bg-gray-50 rounded-xl p-6 text-left border mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Tenant Credentials</h3>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-gray-400 mb-1">Company</span>
                <span className="font-semibold text-gray-800">{successData.tenant.company_name}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-1">Generated License Key (Save this!)</span>
                <code className="text-sm bg-indigo-50 text-indigo-700 px-3 py-2 rounded border border-indigo-100 block break-all font-mono">
                  {successData.license.license_key}
                </code>
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-1">Tier</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                  {successData.license.plan_tier}
                </span>
              </div>
            </div>
          </div>

          <button onClick={() => setSuccessData(null)} className="btn w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl shadow transition-colors flex items-center justify-center gap-2">
            Finish & Add Another
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900 border-b pb-4 mb-2">Master Controller</h2>
          <p className="text-center text-sm text-gray-500">
            SaaS Setup Wizard — Provision a new customer tenant automatically.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleProvision}>
          <div className="space-y-4">
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="text-gray-400" size={18} />
                </div>
                <input
                  id="companyName"
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                  placeholder="Everest Investments Pvt Ltd"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="text-gray-400" size={18} />
                </div>
                <input
                  id="contactEmail"
                  type="email"
                  required
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                  placeholder="admin@everest.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="databaseUrl" className="block text-sm font-medium text-gray-700 mb-1">Tenant Target Database (Supabase Postgres URL)</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Database className="text-gray-400" size={18} />
                </div>
                <input
                  id="databaseUrl"
                  type="password"
                  required
                  value={formData.databaseUrl}
                  onChange={(e) => setFormData({ ...formData, databaseUrl: e.target.value })}
                  className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                  placeholder="postgresql://postgres:password@db.supabase.co:5432/postgres"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400 italic">This must be a completely blank, new Supabase database.</p>
            </div>

            <div>
              <label htmlFor="planTier" className="block text-sm font-medium text-gray-700 mb-1">Subscription Plan</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="text-gray-400" size={18} />
                </div>
                <select
                  id="planTier"
                  value={formData.planTier}
                  onChange={(e) => setFormData({ ...formData, planTier: e.target.value })}
                  className="pl-10 block w-full outline-none sm:text-sm border-gray-300 rounded-xl border p-3 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-transparent"
                >
                  <option value="standard">Standard Level</option>
                  <option value="premium">Premium Level</option>
                  <option value="enterprise">Enterprise (Unlimited)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-md
                ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 transform hover:-translate-y-0.5'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  Building Database Blueprint...
                </>
              ) : (
                'Run Setup Wizard & Provision'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
