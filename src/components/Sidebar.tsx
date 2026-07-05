'use client';

import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Settings, 
  UserPlus, 
  Bell, 
  LogOut,
  Calendar,
  Archive
} from 'lucide-react';
import { Suspense } from 'react';

import { useState, useEffect } from 'react';
import { useQueueStore } from '@/store/queueStore';
import { useAuthStore } from '@/store/authStore';

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams ? searchParams.get('tab') : null;
  const router = useRouter();
  const logOut = useAuthStore((state) => state.logOut);

  const currentBusiness = useQueueStore((state) => state.currentBusiness);
  const locations = useQueueStore((state) => state.locations);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsMounted(true), 0);
  }, []);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await logOut();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const location = currentBusiness || locations['abc-clinic'] || {
    id: 'abc-clinic',
    name: 'ABC Clinic',
    type: 'Clinic',
    planType: 'trial',
    subscriptionStatus: 'active',
    billingCycleEnd: 'Jun 29, 2026',
  };

  const planType = location.planType || 'trial';
  const subscriptionStatus = location.subscriptionStatus || 'active';
  const billingCycleEnd = location.billingCycleEnd || 'Jun 29, 2026';

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      active: pathname === '/dashboard' && tab !== 'staff'
    },
    {
      label: 'Queues',
      href: '/dashboard/queues',
      icon: () => (
        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      active: pathname === '/dashboard/queues'
    },
    {
      label: 'Manage Staff',
      href: '/dashboard/manage-staff',
      icon: UserPlus,
      active: pathname === '/dashboard/manage-staff'
    },
    {
      label: 'Analytics',
      href: '/dashboard/analytics',
      icon: BarChart3,
      active: pathname === '/dashboard/analytics'
    },
    {
      label: 'Customers',
      href: '/dashboard/customers',
      icon: Users,
      active: pathname === '/dashboard/customers'
    },
    {
      label: 'Daily Archive',
      href: '/dashboard/archive',
      icon: Archive,
      active: pathname === '/dashboard/archive'
    },
    {
      label: 'Announcements',
      href: '/dashboard/announcements',
      icon: Bell,
      active: pathname === '/dashboard/announcements'
    },
    {
      label: 'Appointments',
      href: '/dashboard/appointments',
      icon: Calendar,
      active: pathname === '/dashboard/appointments'
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      active: pathname === '/dashboard/settings'
    }
  ];

  return (
    <aside style={{
      width: '240px',
      background: 'white',
      borderRight: '1px solid #e2e8f0',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      flexShrink: 0
    }}>
      {/* Brand */}
      <div className="brand" style={{ paddingLeft: '8px' }}>
        <svg className="brand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '26px', height: '26px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <span style={{ fontSize: '22px' }}>QueueTag</span>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link 
              key={item.label}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: item.active ? '#eff6ff' : 'transparent',
                color: item.active ? '#2563eb' : '#64748b',
                fontWeight: item.active ? 600 : 500,
                fontSize: '14px',
                textDecoration: 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <Icon style={{ width: '18px', height: '18px' }} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Plan Badge */}
      <div style={{
        marginTop: 'auto',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '14px',
        fontSize: '12px'
      }}>
        <div style={{ color: '#64748b' }}>Current Plan</div>
        <div style={{ fontWeight: 700, color: '#0f172a', margin: '2px 0 6px 0' }}>
          {!isMounted ? 'Free Trial' : (subscriptionStatus === 'expired' ? 'Expired' : planType === 'premium' ? 'Premium Pro' : 'Free Trial')}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '10px' }}>
          {!isMounted 
            ? 'Valid until Jun 29, 2026' 
            : (subscriptionStatus === 'expired' 
              ? 'Subscription ended' 
              : planType === 'premium' 
                ? `Next billing: ${billingCycleEnd}` 
                : `Trial ends: ${billingCycleEnd}`)}
        </div>
        <Link 
          href="/dashboard/billing"
          style={{
            display: 'block',
            textAlign: 'center',
            width: '100%',
            background: 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '10px',
            color: '#475569',
            textDecoration: 'none'
          }}
        >
          Manage Plan
        </Link>
      </div>

      {/* Exit link */}
      <button 
        onClick={handleLogout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#ef4444',
          fontSize: '13px',
          background: 'none',
          border: 'none',
          textDecoration: 'none',
          fontWeight: 600,
          paddingLeft: '8px',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left'
        }}
      >
        <LogOut style={{ width: '16px', height: '16px' }} />
        <span>Log Out</span>
      </button>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={
      <aside style={{
        width: '240px',
        background: 'white',
        borderRight: '1px solid #e2e8f0',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        flexShrink: 0
      }}>
        <div className="brand" style={{ paddingLeft: '8px' }}>
          <span style={{ fontSize: '22px', fontWeight: 700 }}>QueueTag</span>
        </div>
      </aside>
    }>
      <SidebarContent />
    </Suspense>
  );
}
