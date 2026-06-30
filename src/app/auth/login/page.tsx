'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BusinessLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API delay
    setTimeout(() => {
      setLoading(false);
      router.push('/dashboard');
    }, 800);
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push('/dashboard');
    }, 600);
  };

  return (
    <div className="gateway-container" style={{ background: '#f8fafc' }}>
      <Link href="/" className="back-link" style={{ position: 'absolute', top: '24px', left: '24px' }}>
        <ArrowLeft style={{ width: '16px', height: '16px' }} />
        <span>Back to Gateway</span>
      </Link>

      <div className="gateway-card" style={{ maxWidth: '400px', padding: '40px 32px' }}>
        <div className="gateway-header" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg
              className="brand-icon"
              style={{ width: '40px', height: '40px', color: '#2563eb' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <h1 className="gateway-title" style={{ fontSize: '22px', fontWeight: 800, marginTop: '16px' }}>Business Sign In</h1>
          <p className="gateway-subtitle" style={{ fontSize: '13px', color: '#64748b' }}>Log in to access your queues and workspace dashboard</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px' }}>Email Address</label>
            <div className="form-input-wrapper">
              <Mail className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="email" 
                className="form-input" 
                placeholder="you@company.com" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px' }}>Password</label>
            <div className="form-input-wrapper">
              <Lock className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ padding: '11px', borderRadius: '8px', marginTop: '4px' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#cbd5e1' }}>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          <span style={{ padding: '0 10px', fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
        </div>

        <button 
          type="button" 
          onClick={handleGoogleLogin}
          className="btn-secondary" 
          style={{ 
            width: '100%', 
            padding: '11px', 
            borderRadius: '8px', 
            background: 'white', 
            border: '1px solid #cbd5e1', 
            color: '#334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          disabled={loading}
        >
          <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.555 0-6.437-2.882-6.437-6.437 0-3.555 2.882-6.437 6.437-6.437 1.543 0 2.97.545 4.076 1.48l3.057-3.057C19.12 2.19 15.895 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.898 0 10.978-4.249 10.978-11.24 0-.693-.059-1.396-.178-1.955H12.24z"
            />
          </svg>
          Continue with Google
        </button>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
          Don't have a business account?{' '}
          <Link href="/auth/signup" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
