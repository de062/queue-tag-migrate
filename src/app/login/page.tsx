'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, ArrowLeft, AlertCircle, Building } from 'lucide-react';
import Link from 'next/link';
import { signUp, logIn } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  
  // Tab state: 'login' | 'signup'
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Scroll/Terms state for Signup
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    // Validate email formatting
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    // Validate password complexity for Signup
    if (activeTab === 'signup') {
      const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordRegex.test(password)) {
        setPasswordError('Password must be at least 8 characters long, contain at least one number, and at least one special character.');
        setLoading(false);
        return;
      }
    }
    
    try {
      if (activeTab === 'login') {
        await logIn(email, password);
      } else {
        if (!hasAcceptedTerms) {
          setError('You must accept the Terms of Service to create an account.');
          setLoading(false);
          return;
        }
        if (!businessCategory) {
          setError('Please select a business category.');
          setLoading(false);
          return;
        }
        await signUp(email, password, businessName, businessCategory);
      }
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Auth Error:', err);
      let displayMessage = err.message || 'An error occurred during authentication.';
      if (displayMessage.includes('Invalid login credentials') || displayMessage.includes('invalid_credentials') || err.status === 400) {
        displayMessage = 'Invalid email or password.';
      } else if (displayMessage.includes('User already registered') || displayMessage.includes('already registered')) {
        displayMessage = 'This email is already registered.';
      } else if (displayMessage.includes('Password should be at least') || displayMessage.includes('weak_password')) {
        displayMessage = 'Password must be at least 6 characters.';
      } else if (displayMessage.includes('Invalid email') || displayMessage.includes('invalid_email')) {
        displayMessage = 'Please enter a valid email address.';
      }
      setError(displayMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
        Verifying session...
      </div>
    );
  }

  return (
    <div className="gateway-container" style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
      <Link href="/" className="back-link" style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
        <ArrowLeft style={{ width: '16px', height: '16px' }} />
        <span>Back to Home</span>
      </Link>

      <div className="gateway-card" style={{ maxWidth: '400px', width: '100%', padding: '40px 32px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        
        {/* Brand Logo Header */}
        <div className="gateway-header" style={{ marginBottom: '20px', textAlign: 'center' }}>
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
          <h1 className="gateway-title" style={{ fontSize: '22px', fontWeight: 800, marginTop: '12px', color: '#0f172a' }}>Business Portal</h1>
          <p className="gateway-subtitle" style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Log in or register your business workspace</p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(null); setEmailError(null); setPasswordError(null); }}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'login' ? 'white' : 'transparent',
              color: activeTab === 'login' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'login' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setError(null); setEmailError(null); setPasswordError(null); }}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'signup' ? 'white' : 'transparent',
              color: activeTab === 'signup' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'signup' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '20px',
            color: '#ef4444',
            fontSize: '13px'
          }}>
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {activeTab === 'signup' && (
            <>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Business / Enterprise Name *</label>
                <div className="form-input-wrapper">
                  <Building className="form-input-icon" style={{ width: '16px', height: '16px' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Acme Studio" 
                    style={{ paddingLeft: '38px', borderRadius: '8px' }}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
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
            </>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Email Address</label>
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
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Password</label>
            <div className="form-input-wrapper">
              <Lock className="form-input-icon" style={{ width: '16px', height: '16px' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder={activeTab === 'signup' ? "Min 8 chars, 1 number, 1 special" : "••••••••"} 
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

          {activeTab === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Terms & Conditions</label>
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
                <p style={{ margin: '0 0 8px 0' }}><strong>2. Intellectual Property Protection:</strong> All content, source code, visual designs, workflows, interfaces, and underlying ideas of the QueueTag platform are the exclusive property of QueueTag. You are prohibited from copying or cloning this platform.</p>
                <p style={{ margin: '0 0 8px 0' }}><strong>3. Account Security:</strong> Business users are responsible for maintaining the confidentiality of their credentials and all activities performed under their workspace.</p>
                <p style={{ margin: '0' }}><strong>4. Limitation of Liability:</strong> QueueTag provides real-time services 'as-is'. We are not liable for internet outages or service failures.</p>
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
          )}

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ padding: '12px', borderRadius: '8px', marginTop: '4px', background: '#2563eb', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
            disabled={loading || (activeTab === 'signup' && !hasAcceptedTerms)}
          >
            <LogIn style={{ width: '16px', height: '16px' }} />
            {loading ? 'Processing...' : activeTab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

      </div>
    </div>
  );
}
