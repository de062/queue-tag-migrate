import Link from 'next/link';
import { 
  Users, 
  Stethoscope, 
  LayoutDashboard, 
  LogIn, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building
} from 'lucide-react';

export default function Home() {
  return (
    <div className="gateway-container" style={{ background: '#f8fafc' }}>
      <div className="gateway-card" style={{ maxWidth: '640px', padding: '40px' }}>
        
        <div className="gateway-header" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg
              className="brand-icon"
              style={{ width: '48px', height: '48px', color: '#2563eb' }}
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
          <h1 className="gateway-title" style={{ fontSize: '26px', fontWeight: 800, marginTop: '16px' }}>QueueTag SaaS Platform</h1>
          <p className="gateway-subtitle">Premium virtual queue management system for service providers and customers</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          
          {/* Column 1: Live Demo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              Explore Live Demos
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href="/q/abc-clinic" className="gateway-button" style={{ padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '12px', height: 'auto', textDecoration: 'none' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <Users style={{ width: '16px', height: '16px' }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Customer Portal</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>Select queues, join virtual lines & track turns.</div>
                </div>
              </Link>

              <Link href="/staff/dr-john" className="gateway-button" style={{ padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '12px', height: 'auto', textDecoration: 'none' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <Stethoscope style={{ width: '16px', height: '16px' }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Staff Console</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>Call next, skip, or pause specific queue.</div>
                </div>
              </Link>

              <Link href="/dashboard" className="gateway-button" style={{ padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '12px', height: 'auto', textDecoration: 'none' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <LayoutDashboard style={{ width: '16px', height: '16px' }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Admin Dashboard</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>Read-only monitoring grid & staff provisioning.</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Column 2: Business Onboarding */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              Business Portal
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <Link href="/login" className="gateway-button" style={{ padding: '20px 14px', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '14px', height: 'auto', textDecoration: 'none', border: '1px solid #bae6fd', background: '#f0f9ff' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#bae6fd', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building style={{ width: '18px', height: '18px' }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0369a1' }}>Business Portal</div>
                  <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', lineHeight: 1.3 }}>Log in or register your business workspace.</div>
                </div>
              </Link>

              <div style={{
                border: '1px dashed #cbd5e1',
                borderRadius: '10px',
                padding: '12px',
                background: '#f8fafc',
                fontSize: '11px',
                color: '#64748b',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px'
              }}>
                <ShieldCheck style={{ width: '16px', height: '16px', color: '#10b981', flexShrink: 0 }} />
                <span>Multi-tenant architecture: link staff login profiles to specific queue IDs for strict access isolation.</span>
              </div>

            </div>
          </div>

        </div>

        <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', marginTop: '32px', paddingTop: '16px' }}>
          QueueTag SaaS Platform • Stripe/Linear Light Premium Design
        </div>
      </div>
    </div>
  );
}
