'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BusinessSignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);

    // Validate email formatting
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    // Validate password complexity
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setPasswordError('Password must be at least 8 characters long, contain at least one number, and at least one special character.');
      return;
    }

    setLoading(true);
    // Simulate API delay
    setTimeout(() => {
      setLoading(false);
      router.push('/onboarding');
    }, 800);
  };

  const handleGoogleSignup = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push('/onboarding');
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
          <h1 className="gateway-title" style={{ fontSize: '22px', fontWeight: 800, marginTop: '16px' }}>Create Account</h1>
          <p className="gateway-subtitle" style={{ fontSize: '13px', color: '#64748b' }}>Start managing virtual queues for your clients today</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px' }}>Full Name</label>
            <div className="form-input-wrapper">
              <User className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Jane Doe" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Business Category *</label>
            <select
              className="form-input"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#0f172a',
                outline: 'none',
                background: 'white',
                height: '38px',
                cursor: 'pointer'
              }}
              value={businessCategory}
              onChange={(e) => setBusinessCategory(e.target.value)}
              required
              disabled={loading}
            >
              <option value="" disabled>Select your business category</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Salon & Spa">Salon & Spa</option>
              <option value="Retail">Retail</option>
              <option value="Food & Beverage">Food & Beverage</option>
              <option value="Government/DMV">Government/DMV</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px' }}>Work Email</label>
            <div className="form-input-wrapper">
              <Mail className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="email" 
                className="form-input" 
                placeholder="you@company.com" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                required
                disabled={loading}
              />
            </div>
            {emailError && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>{emailError}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px' }}>Password</label>
            <div className="form-input-wrapper">
              <Lock className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="Min 8 chars, 1 number, 1 special" 
                style={{ paddingLeft: '38px', borderRadius: '8px' }}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                required
                disabled={loading}
              />
            </div>
            {passwordError && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>{passwordError}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Terms & Conditions</label>
            <div 
              onScroll={(e) => {
                const target = e.currentTarget;
                const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 24;
                if (isAtBottom) {
                  setHasReadTerms(true);
                }
              }}
              style={{
                height: '110px',
                overflowY: 'scroll',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '11px',
                color: '#64748b',
                lineHeight: '16px',
                background: '#f8fafc',
                textAlign: 'left'
              }}
            >
              <p style={{ margin: '0 0 8px 0' }}><strong>1. Acceptance of Terms:</strong> By creating an account on QueueTag, you agree to comply with and be bound by these Terms of Service.</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>2. Intellectual Property Protection:</strong> All content, source code, visual designs, workflows, interfaces, and underlying ideas of the QueueTag platform are the exclusive property of QueueTag. You are strictly prohibited from copying, modifying, reverse-engineering, or creating derivative works or clones of this platform.</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>3. Account Security:</strong> Business users are entirely responsible for maintaining the confidentiality of their login credentials and all activities performed under their workspace.</p>
              <p style={{ margin: '0' }}><strong>4. Limitation of Liability:</strong> QueueTag provides real-time tracking services 'as-is'. We are not liable for operational disruptions, internet outages, or loss of business data due to third-party infrastructure failures.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
              <input 
                type="checkbox"
                id="agree-checkbox"
                checked={hasAcceptedTerms}
                onChange={(e) => setHasAcceptedTerms(e.target.checked)}
                disabled={!hasReadTerms || loading}
                style={{ marginTop: '2px', cursor: hasReadTerms ? 'pointer' : 'not-allowed' }}
              />
              <label 
                htmlFor="agree-checkbox" 
                style={{ 
                  fontSize: '11px', 
                  color: hasReadTerms ? '#475569' : '#94a3b8', 
                  lineHeight: '16px', 
                  cursor: hasReadTerms ? 'pointer' : 'not-allowed',
                  userSelect: 'none'
                }}
              >
                I agree to the Terms of Service.
                {!hasReadTerms && (
                  <span style={{ display: 'block', color: '#2563eb', fontSize: '10px', marginTop: '2px' }}>
                    (Please scroll to the bottom of the terms box to enable checkbox)
                  </span>
                )}
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ padding: '11px', borderRadius: '8px', marginTop: '4px' }}
            disabled={loading || !hasAcceptedTerms}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#cbd5e1' }}>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          <span style={{ padding: '0 10px', fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
        </div>

        <button 
          type="button" 
          onClick={handleGoogleSignup}
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
          Sign Up with Google
        </button>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
          Already have a business account?{' '}
          <Link href="/auth/login" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
