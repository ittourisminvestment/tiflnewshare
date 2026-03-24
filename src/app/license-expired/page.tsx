import { AlertTriangle, Home } from 'lucide-react';
import Link from 'next/link';

export default function LicenseExpiredPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary, #0f1115)',
      color: 'var(--text-primary, #f3f4f6)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        padding: '40px',
        background: 'var(--bg-secondary, #1a1d24)',
        borderRadius: '16px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        textAlign: 'center',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <AlertTriangle size={40} color="#ef4444" />
        </div>
        
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>Subscription Inactive</h1>
        <p style={{ color: 'var(--text-secondary, #9ca3af)', marginBottom: '32px', lineHeight: 1.6 }}>
          Your company's license for the Promoter Management SaaS has expired or is currently suspended. Please contact the administrator or support to renew your license and restore access.
        </p>
        
        <Link href="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--primary, #6366f1)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
          transition: 'all 0.2s'
        }}>
          <Home size={18} />
          Return to Portal
        </Link>
      </div>
    </div>
  );
}
