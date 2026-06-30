'use client';

import { useState, useEffect } from 'react';
import { useQueueStore } from '@/store/queueStore';
import { useAuthStore } from '@/store/authStore';
import { Bell, ChevronDown } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface DashboardHeaderProps {
  subtext?: string;
}

export default function DashboardHeader({ subtext = 'Good morning,' }: DashboardHeaderProps) {
  const [isMounted, setIsMounted] = useState(false);
  const { user } = useAuthStore();
  const [businessName, setBusinessName] = useState('ABC Clinic');
  const [logoUrl, setLogoUrl] = useState('');

  const currentBusiness = useQueueStore((state) => state.currentBusiness);
  const locations = useQueueStore((state) => state.locations);

  useEffect(() => {
    setIsMounted(true);
    if (!user) {
      const loc = currentBusiness || locations['abc-clinic'];
      if (loc) {
        setBusinessName(loc.name);
      }
      return;
    }

    const bizRef = doc(db, 'businesses', user.uid);
    const unsubscribe = onSnapshot(bizRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusinessName(data.businessName || user.displayName || 'ABC Clinic');
        setLogoUrl(data.logoUrl || '');
      }
    }, (err) => {
      console.error('Error listening to business details in header:', err);
    });

    return () => unsubscribe();
  }, [user, currentBusiness, locations]);

  const email = user?.email || 'abcclinic@gmail.com';
  const name = user?.displayName || user?.email?.split('@')[0] || 'Admin';
  const initial = name.charAt(0).toUpperCase();

  return (
    <header style={{
      height: '70px',
      background: 'white',
      borderBottom: '1px solid #e2e8f0',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isMounted && logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={logoUrl} 
            alt="Logo" 
            style={{ 
              height: '32px', 
              maxWidth: '120px', 
              objectFit: 'contain',
              borderRadius: '4px',
              border: '1px solid #f1f5f9',
              padding: '2px',
              backgroundColor: '#f8fafc'
            }} 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>{subtext}</span>
          <strong style={{ fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isMounted ? businessName : 'ABC Clinic'}
            <ChevronDown style={{ width: '16px', height: '16px', color: '#64748b' }} />
          </strong>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div className="status-badge live" style={{ fontSize: '11px' }}>Live</div>
        
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell style={{ width: '20px', height: '20px', color: '#64748b' }} />
          <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#2563eb', color: 'white', fontSize: '9px', fontWeight: 700, borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid #e2e8f0', paddingLeft: '20px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#f1f5f9',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '14px'
          }}>
            {initial}
          </div>
          <div style={{ fontSize: '13px' }}>
            <div style={{ fontWeight: 600, color: '#334155' }}>{name}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{email}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
