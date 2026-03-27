'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();
  const [companyLoading, setCompanyLoading] = useState(true);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        // Use the server-side API route to bypass RLS (login page has no auth token yet)
        const res = await fetch('/api/company');
        if (res.ok) {
          const data = await res.json();
          setCompany(data);
        }
      } catch (err) {
        console.warn('Could not fetch company info:', err);
      } finally {
        setCompanyLoading(false);
      }
    };
    fetchCompany();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'GB';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success('Welcome back!');
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="mesh-gradient" />
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      <div className="login-card glass-card">
        <div className="login-header">
          <div className="login-logo">
            {company?.logo_url ? (
              <div className="sidebar-logo-icon has-logo" style={{ width: 56, height: 56 }}>
                <img src={company.logo_url} alt={company.company_name + ' Logo'} />
              </div>
            ) : (
              <div className="sidebar-logo-icon" style={{ width: 56, height: 56, fontSize: 22 }}>
                {companyLoading ? '' : (company ? getInitials(company.company_name) : 'GB')}
              </div>
            )}
          </div>
          <h1 className="login-title">
            {companyLoading ? '\u00A0' : (company?.company_name || 'Investment Management System')}
          </h1>
          <p className="login-subtitle">Admin Management System</p>
        </div>


        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="admin@globalbihani.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password">Password</label>
              <Link href="/login/forgot-password" style={{ color: '#8b5cf6', fontSize: '13px', textDecoration: 'none' }}>
                Forgot Password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            id="login-button"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="login-footer">
          {company?.address || 'Secure Admin Portal'} &bull; Secure Admin Portal
        </p>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #050508;
        }
        .login-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .mesh-gradient {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
            radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), 
            radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%);
          opacity: 0.5;
        }
        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.3;
        }
        .login-orb-1 {
          width: 500px;
          height: 500px;
          background: #4f46e5;
          top: -10%;
          right: -10%;
          animation: float 12s ease-in-out infinite;
        }
        .login-orb-2 {
          width: 400px;
          height: 400px;
          background: #8b5cf6;
          bottom: -10%;
          left: -10%;
          animation: float 15s ease-in-out infinite reverse;
        }
        .login-orb-3 {
          width: 300px;
          height: 300px;
          background: #e11d48;
          top: 40%;
          left: 50%;
          animation: float 18s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          33% { transform: translateY(-40px) rotate(10deg) scale(1.1); }
          66% { transform: translateY(20px) rotate(-10deg) scale(0.9); }
        }
        .login-card {
          padding: 56px 48px;
          width: 100%;
          max-width: 440px;
          position: relative;
          z-index: 10;
          border-radius: 28px;
          animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .login-logo {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }
        .login-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -1px;
          margin-bottom: 8px;
          color: #ffffff;
        }
        .login-subtitle {
          font-size: 15px;
          color: #94a3b8;
          font-weight: 500;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .input-group label {
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 8px;
          display: block;
        }
        .input {
          height: 48px !important;
          background: rgba(15, 23, 42, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 12px !important;
          color: #fff !important;
          font-size: 15px !important;
          padding: 0 16px !important;
          transition: all 0.3s ease !important;
        }
        .input:focus {
          border-color: #4f46e5 !important;
          background: rgba(15, 23, 42, 0.8) !important;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.2) !important;
        }
        .login-footer {
          text-align: center;
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 40px;
          line-height: 1.6;
        }
        @media (max-width: 480px) {
          .login-card {
            margin: 20px;
            padding: 40px 24px;
          }
        }
      `}</style>
    </div>
  );
}
