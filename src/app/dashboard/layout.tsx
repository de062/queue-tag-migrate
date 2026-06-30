'use client';

import { useQueueStore } from '@/store/queueStore';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const currentBusiness = useQueueStore((state) => state.currentBusiness);
  const locations = useQueueStore((state) => state.locations);
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const loadPersistedBusiness = useQueueStore((state) => state.loadPersistedBusiness);

  useEffect(() => {
    setIsMounted(true);
    loadPersistedBusiness();
  }, [loadPersistedBusiness]);

  const location = currentBusiness || locations['abc-clinic'] || {
    id: 'abc-clinic',
    name: 'ABC Clinic',
    type: 'Clinic',
    subscriptionStatus: 'active',
  };

  const isExpired = location.subscriptionStatus === 'expired';
  const isBillingPage = pathname === '/dashboard/billing';

  // Prevent initial render mismatch
  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {children}
      {isExpired && !isBillingPage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '40px 32px',
            maxWidth: '460px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              margin: '0 auto 20px auto',
            }}>
              ⚠️
            </div>
            
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
              Subscription Inactive
            </h3>
            
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '22px', marginBottom: '28px' }}>
              Subscription Inactive. Please update your payment method to continue accessing your queues and analytics.
            </p>
            
            <Link 
              href="/dashboard/billing" 
              style={{
                display: 'inline-block',
                width: '100%',
                background: '#2563eb',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none',
                transition: 'background 0.2s',
                textAlign: 'center',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              }}
            >
              Go to Billing Portal
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
